/*
  SERVICIOS INTEGRALES - ASISTENTE DE RENOVACIÓN / TABLA V2.2

  PRIMERA ETAPA:
  - Agrega un checkbox a cada crédito vigente de la ficha consolidada.
  - Usa el saldo capital YA calculado por el sistema (mes siguiente).
  - Suma automáticamente saldos seleccionados.
  - Calcula automáticamente el 5% sobre el total seleccionado.
  - Suma las cuotas mensuales que se liberan.
  - Permite ingresar IMPORTE A FIRMAR y CUOTAS.
  - Calcula la comisión Creditan desde el importe firmado:
      Neto base = Importe firmado / 1.12
      Comisión = Importe firmado - Neto base
  - Calcula EN MANO FINAL.
  - Prepara el análisis de cupo.

  IMPORTANTE:
  - NO modifica app.js.
  - NO modifica ficha.js.
  - NO modifica gestion.js.
  - NO modifica historial.js.
  - NO modifica cupo.js.
  - NO modifica connector.js.
  - NO toca el recorrido estable de Creditan.
*/

(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const ficha = $("#fichaConsolidada");
  const clientCard = $("#clientCard");

  if (!ficha || !clientCard) {
    console.warn(
      "[SERVICIOS INTEGRALES] Renovación: no se encontró la ficha consolidada."
    );
    return;
  }

  const seleccionadas = new Set();

  /*
    Si Creditan todavía no entregó un saldo para una operación,
    permitimos completar SOLO ese saldo manualmente.
    Apenas el saldo automático vuelve a existir, vuelve a mandar el automático.
  */
  const saldosManuales = new Map();

  let cuilActual = "";
  let cuotaCreditan = null;
  let planCreditan = null;
  let modoSimulacion = "capital";
  let cuotaDeseada = 0;
  let ofertasAbiertas = false;
  let simulacionError = "";
  let simulandoCreditan = false;
  let timerSimulacion = null;
  let secuenciaSimulacion = 0;
  let timerSync = null;
  let bloqueCreado = false;

  /*
    NUEVO - ETAPA MOSTRAR OFERTA.
    Esto es independiente de los cálculos de renovación.
  */
  let abriendoOfertasCreditan = false;

  function soloDigitos(valor) {
    return String(valor || "").replace(/\D/g, "");
  }

  function numeroAR(valor) {
    let s = String(valor ?? "").trim();

    if (!s) return 0;

    const negativo = /^\s*-/.test(s) || s.includes("-");

    s = s
      .replace(/\s/g, "")
      .replace(/\$/g, "")
      .replace(/[^\d.,-]/g, "")
      .replace(/-/g, "");

    if (!s) return 0;

    const tieneComa = s.includes(",");
    const tienePunto = s.includes(".");

    if (tieneComa && tienePunto) {
      const ultimaComa = s.lastIndexOf(",");
      const ultimoPunto = s.lastIndexOf(".");

      if (ultimaComa > ultimoPunto) {
        // Formato AR: 1.234.567,89
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        // Formato US: 1,234,567.89
        s = s.replace(/,/g, "");
      }
    } else if (tieneComa) {
      const partes = s.split(",");

      if (partes.length > 2) {
        // 1,234,567 => separadores de miles
        s = partes.join("");
      } else {
        const [entero, decimal = ""] = partes;

        if (decimal.length === 3 && entero.length >= 1) {
          // 2,240 => probablemente separador de miles
          s = entero + decimal;
        } else {
          // 2240000,50
          s = entero + "." + decimal;
        }
      }
    } else if (tienePunto) {
      const partes = s.split(".");

      if (partes.length > 2) {
        // Formato AR sin decimales: 2.000.000
        s = partes.join("");
      } else {
        const [entero, decimal = ""] = partes;

        if (decimal.length === 3 && entero.length >= 1) {
          // 2.240 => separador de miles
          s = entero + decimal;
        } else {
          // 2240000.50
          s = entero + "." + decimal;
        }
      }
    }

    const n = Number(s);
    if (!Number.isFinite(n)) return 0;

    return negativo ? -n : n;
  }

  function numeroInput(valor) {
    const raw = String(valor ?? "").trim();
    if (!raw) return 0;

    return numeroAR(raw);
  }

  function dinero(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return "$ 0,00";

    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);
  }

  function texto(selector, fallback = "—", root = document) {
    const el = $(selector, root);
    const valor = String(el?.textContent || "").trim();
    return valor || fallback;
  }

  function leerOperacionDeLinea(linea) {
    const primerStrong = $("strong", linea);
    const match = String(primerStrong?.textContent || "").match(
      /Operaci[oó]n\s+([A-Za-z0-9-]+)/i
    );

    return match?.[1] || "";
  }

  function tarjetaPorOperacion(operacion) {
    return $$("#creditsList .credit-card").find((tarjeta) => {
      const op = texto('[data-field="operacion"]', "", tarjeta);
      return op === operacion;
    }) || null;
  }

  function mesClaveDesdeFechaAR(valor) {
    const m = String(valor || "")
      .trim()
      .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    if (!m) return null;

    return Number(m[3]) * 12 + Number(m[2]);
  }

  function saldoDesdeFilaRecomendada(tarjeta) {
    const fila = $(
      '[data-field="cuotasTable"] tr.recommended',
      tarjeta
    );

    if (!fila) return 0;

    const celdas = $$("td", fila);
    if (!celdas.length) return 0;

    return numeroAR(
      String(celdas[celdas.length - 1]?.textContent || "")
    );
  }

  function saldoAutomaticoCredito(tarjeta) {
    if (!tarjeta) return 0;

    const saldoMostrado = numeroAR(
      texto('[data-field="saldoCapital"]', "0", tarjeta)
    );

    if (saldoMostrado > 0) {
      return saldoMostrado;
    }

    const saldoRecomendado =
      saldoDesdeFilaRecomendada(tarjeta);

    if (saldoRecomendado > 0) {
      return saldoRecomendado;
    }

    const proximoPeriodo = texto(
      '[data-field="proximoPeriodo"]',
      "",
      tarjeta
    );

    const clavePrimerVencimiento =
      mesClaveDesdeFechaAR(proximoPeriodo);

    const hoy = new Date();
    const claveMesActual =
      hoy.getFullYear() * 12 + (hoy.getMonth() + 1);

    if (
      clavePrimerVencimiento !== null &&
      clavePrimerVencimiento > claveMesActual
    ) {
      const capitalOriginal = numeroAR(
        texto('[data-field="capital"]', "0", tarjeta)
      );

      if (capitalOriginal > 0) {
        return capitalOriginal;
      }
    }

    return 0;
  }

  function leerCredito(operacion) {
    const tarjeta = tarjetaPorOperacion(operacion);

    if (!tarjeta) {
      return {
        operacion,
        saldo: Number(saldosManuales.get(operacion) || 0),
        saldoAutomatico: 0,
        necesitaSaldoManual: true,
        cuota: 0
      };
    }

    const saldoAutomatico =
      saldoAutomaticoCredito(tarjeta);

    const saldoManual = Number(
      saldosManuales.get(operacion) || 0
    );

    return {
      operacion,
      saldo:
        saldoAutomatico > 0
          ? saldoAutomatico
          : saldoManual,
      saldoAutomatico,
      necesitaSaldoManual: saldoAutomatico <= 0,
      cuota: numeroAR(
        texto('[data-field="valorCuota"]', "0", tarjeta)
      )
    };
  }

  function leerCupoActual() {
    const valor = texto("#fichaCupo", "Pendiente");

    if (/pendiente/i.test(valor)) {
      return {
        disponible: false,
        valor: 0,
        texto: "Pendiente"
      };
    }

    return {
      disponible: true,
      valor: numeroAR(valor),
      texto: valor
    };
  }

  function obtenerSeleccion() {
    return [...seleccionadas].map(leerCredito);
  }

  function calcularEstado() {
    const creditos = obtenerSeleccion();

    const saldoSeleccionado = creditos.reduce(
      (total, credito) => total + credito.saldo,
      0
    );

    const cincoPorCiento = saldoSeleccionado * 0.05;
    const totalCancelacion = saldoSeleccionado + cincoPorCiento;

    const cuotasLiberadas = creditos.reduce(
      (total, credito) => total + credito.cuota,
      0
    );

    const importeFirmar = numeroInput(
      $("#siRenovacionImporteFirmar")?.value
    );

    const cuotas = Number(
      String($("#siRenovacionCuotas")?.value || "")
        .replace(/\D/g, "")
    ) || 0;

    const planCoincide = Boolean(
      planCreditan?.ok &&
      Math.abs(Number(planCreditan.capital || 0) - importeFirmar) < 0.02 &&
      Number(planCreditan.cuotas || 0) === cuotas
    );

    const netoEstimado = importeFirmar > 0
      ? importeFirmar / 1.12
      : 0;

    const netoBase = planCoincide
      ? Number(
          planCreditan.enMano ||
          planCreditan.neto ||
          netoEstimado
        )
      : netoEstimado;

    const comision = Math.max(
      0,
      importeFirmar - netoBase
    );

    const cuotaReal = planCoincide
      ? Number(planCreditan.cuota || 0)
      : (
          Number.isFinite(cuotaCreditan) &&
          cuotaCreditan !== null
            ? cuotaCreditan
            : null
        );

    const enManoFinal = importeFirmar > 0
      ? netoBase - totalCancelacion
      : 0;

    const cupo = leerCupoActual();

    const cupoProyectado = cupo.disponible
      ? cupo.valor + cuotasLiberadas
      : null;

    let margen = null;
    let estadoCupo = "PENDIENTE";

    if (
      cupo.disponible &&
      Number.isFinite(cuotaReal) &&
      cuotaReal !== null
    ) {
      margen = cupoProyectado - cuotaReal;
      estadoCupo = margen >= 0 ? "ENTRA" : "NO_ENTRA";
    }

    return {
      creditos,
      saldoSeleccionado,
      cincoPorCiento,
      totalCancelacion,
      cuotasLiberadas,
      importeFirmar,
      cuotas,
      netoBase,
      comision,
      enManoFinal,
      cupo,
      cupoProyectado,
      cuotaCreditan: cuotaReal,
      planCreditan: planCoincide ? planCreditan : null,
      simulandoCreditan,
      simulacionError,
      margen,
      estadoCupo
    };
  }

  function escribir(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  }

  function renderAnalisisCupo(estado) {
    const box = $("#siRenovacionEstadoCupo");
    if (!box) return;

    box.classList.remove(
      "si-renovacion-cupo-ok",
      "si-renovacion-cupo-no",
      "si-renovacion-cupo-pendiente"
    );

    if (!estado.cupo.disponible) {
      box.classList.add("si-renovacion-cupo-pendiente");
      box.innerHTML = `
        <strong>⚪ CUPO PENDIENTE</strong>
        <span>Calculá el cupo del recibo para evaluar la operación.</span>
      `;
      return;
    }

    if (estado.cuotaCreditan === null) {
      box.classList.add("si-renovacion-cupo-pendiente");

      if (estado.simulandoCreditan) {
        box.innerHTML = `
          <strong>🟡 CONSULTANDO CREDITAN</strong>
          <span>Buscando la cuota real en la grilla de ofertas...</span>
        `;
        return;
      }

      if (estado.simulacionError) {
        box.innerHTML = `
          <strong>⚠️ CUOTA CREDITAN NO ENCONTRADA</strong>
          <span>${estado.simulacionError}</span>
        `;
        return;
      }

      box.innerHTML = `
        <strong>⚪ CUOTA CREDITAN PENDIENTE</strong>
        <span>Primero abrí Buscar oferta con el botón MOSTRAR OFERTA.</span>
      `;
      return;
    }

    if (estado.estadoCupo === "ENTRA") {
      box.classList.add("si-renovacion-cupo-ok");
      box.innerHTML = `
        <strong>🟢 ENTRA EN CUPO</strong>
        <span>Margen restante: ${dinero(estado.margen)}</span>
      `;
      return;
    }

    box.classList.add("si-renovacion-cupo-no");
    box.innerHTML = `
      <strong>🔴 NO ENTRA EN CUPO</strong>
      <span>Excede el cupo en: ${dinero(Math.abs(estado.margen))}</span>
    `;
  }

  function renderCalculos() {
    if (!bloqueCreado) return;

    const estado = calcularEstado();

    escribir(
      "siRenovacionSeleccionCantidad",
      `${estado.creditos.length} seleccionado${estado.creditos.length === 1 ? "" : "s"}`
    );

    escribir(
      "siRenovacionSaldoSeleccionado",
      dinero(estado.saldoSeleccionado)
    );

    escribir(
      "siRenovacionCinco",
      dinero(estado.cincoPorCiento)
    );

    escribir(
      "siRenovacionTotalCancelar",
      dinero(estado.totalCancelacion)
    );

    escribir(
      "siRenovacionCuotasLiberadas",
      dinero(estado.cuotasLiberadas)
    );

    escribir(
      "siRenovacionComision",
      estado.importeFirmar > 0
        ? dinero(estado.comision)
        : "$ 0,00"
    );

    escribir(
      "siRenovacionNetoBase",
      estado.importeFirmar > 0
        ? dinero(estado.netoBase)
        : "$ 0,00"
    );

    escribir(
      "siRenovacionEnManoFinal",
      estado.importeFirmar > 0
        ? dinero(estado.enManoFinal)
        : "$ 0,00"
    );

    escribir(
      "siRenovacionCuotaCreditan",
      estado.cuotaCreditan === null
        ? (
            estado.simulandoCreditan
              ? "Consultando Creditan..."
              : "Pendiente Creditan"
          )
        : dinero(estado.cuotaCreditan)
    );

    escribir(
      "siRenovacionCupoActual",
      estado.cupo.disponible
        ? dinero(estado.cupo.valor)
        : "Pendiente"
    );

    escribir(
      "siRenovacionCupoLiberado",
      dinero(estado.cuotasLiberadas)
    );

    escribir(
      "siRenovacionCupoProyectado",
      estado.cupoProyectado === null
        ? "Pendiente"
        : dinero(estado.cupoProyectado)
    );

    escribir(
      "siRenovacionNuevaCuota",
      estado.cuotaCreditan === null
        ? (
            estado.simulandoCreditan
              ? "Consultando Creditan..."
              : "Pendiente Creditan"
          )
        : dinero(estado.cuotaCreditan)
    );

    renderAnalisisCupo(estado);
  }
  function quitarEditorSaldoManual(linea) {
    const editor = $(
      ".si-renovacion-saldo-manual-wrap",
      linea
    );

    if (editor) editor.remove();
  }

  function asegurarEditorSaldoManual(
    linea,
    operacion,
    mostrar
  ) {
    if (!mostrar) {
      quitarEditorSaldoManual(linea);
      return;
    }

    let wrap = $(
      ".si-renovacion-saldo-manual-wrap",
      linea
    );

    if (!wrap) {
      wrap = document.createElement("span");
      wrap.className =
        "si-renovacion-saldo-manual-wrap";

      const etiqueta = document.createElement("span");
      etiqueta.className =
        "si-renovacion-saldo-manual-label";
      etiqueta.textContent = "Saldo a cancelar:";

      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "decimal";
      input.autocomplete = "off";
      input.className =
        "si-renovacion-saldo-manual";
      input.placeholder = "Ej.: 213330,79";
      input.dataset.operacion = operacion;

      const guardado = Number(
        saldosManuales.get(operacion) || 0
      );

      input.value = guardado > 0
        ? new Intl.NumberFormat("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(guardado)
        : "";

      input.addEventListener("input", () => {
        const valor = numeroInput(input.value);

        if (valor > 0) {
          saldosManuales.set(
            operacion,
            valor
          );
        } else {
          saldosManuales.delete(
            operacion
          );
        }

        renderCalculos();
      });

      input.addEventListener("blur", () => {
        const valor = numeroInput(input.value);

        if (valor > 0) {
          input.value =
            new Intl.NumberFormat("es-AR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }).format(valor);
        }

        renderCalculos();
      });

      wrap.appendChild(etiqueta);
      wrap.appendChild(input);
      linea.appendChild(wrap);
    }
  }

  function actualizarCheckboxVisual(input, linea) {
    const activa = input.checked;

    linea.classList.toggle(
      "si-renovacion-linea-seleccionada",
      activa
    );
  }

  function sincronizarCheckboxes() {
    const detalle = $("#fichaDetalleCreditos");

    if (!detalle) return;

    const lineas = $$(
      ".ficha-credito-linea",
      detalle
    );

    for (const linea of lineas) {
      const operacion =
        leerOperacionDeLinea(linea);

      if (!operacion) continue;

      let input = $(
        `.si-renovacion-check[data-operacion="${CSS.escape(operacion)}"]`,
        linea
      );

      if (!input) {
        const selector =
          document.createElement("label");

        selector.className =
          "si-renovacion-selector";

        selector.title =
          `Seleccionar operación ${operacion} para cancelar`;

        input =
          document.createElement("input");

        input.type = "checkbox";
        input.className =
          "si-renovacion-check";
        input.dataset.operacion =
          operacion;

        input.setAttribute(
          "aria-label",
          `Seleccionar operación ${operacion} para cancelar`
        );

        const marca =
          document.createElement("span");

        marca.className =
          "si-renovacion-check-visual";

        marca.setAttribute(
          "aria-hidden",
          "true"
        );

        selector.appendChild(input);
        selector.appendChild(marca);

        linea.prepend(selector);

        input.addEventListener(
          "change",
          () => {
            if (input.checked) {
              seleccionadas.add(
                operacion
              );
            } else {
              seleccionadas.delete(
                operacion
              );
            }

            actualizarCheckboxVisual(
              input,
              linea
            );

            const creditoActual =
              leerCredito(operacion);

            asegurarEditorSaldoManual(
              linea,
              operacion,
              input.checked &&
                creditoActual.necesitaSaldoManual
            );

            renderCalculos();
          }
        );
      }

      input.checked =
        seleccionadas.has(operacion);

      actualizarCheckboxVisual(
        input,
        linea
      );

      const creditoActual =
        leerCredito(operacion);

      asegurarEditorSaldoManual(
        linea,
        operacion,
        input.checked &&
          creditoActual.necesitaSaldoManual
      );
    }

    /*
      Si desapareció un crédito porque se consultó otro cliente,
      también limpiamos cualquier selección que ya no exista.
    */
    const operacionesActuales =
      new Set(
        lineas
          .map(leerOperacionDeLinea)
          .filter(Boolean)
      );

    for (
      const op of [...seleccionadas]
    ) {
      if (
        !operacionesActuales.has(op)
      ) {
        seleccionadas.delete(op);
      }
    }

    renderCalculos();
  }

  function crearRequestIdSimulacion() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID ===
        "function"
    ) {
      return window.crypto.randomUUID();
    }

    return `sim-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
  }

  /*
    ==================================================
    NUEVO CANAL - MOSTRAR OFERTA

    Este canal NO hace una simulación.

    Solamente pide a la extensión que haga click
    en el botón Mostrar ofertas de Creditan.

    Los cálculos, selección de créditos, saldos
    y toda la lógica original permanecen separados.
    ==================================================
  */

  function abrirOfertasCreditan(
    timeout = 12000
  ) {
    return new Promise((resolve) => {
      const requestId =
        crearRequestIdSimulacion();

      let terminado = false;

      const finalizar = (
        resultado
      ) => {
        if (terminado) return;

        terminado = true;

        clearTimeout(timer);

        window.removeEventListener(
          "message",
          onMessage
        );

        resolve(resultado);
      };

      const onMessage = (event) => {
        if (
          event.source !== window
        ) {
          return;
        }

        const data =
          event.data;

        if (
          !data ||
          data.source !==
            "SERVICIOS_INTEGRALES_SIMULADOR_BRIDGE"
        ) {
          return;
        }

        if (
          data.type !==
            "RESPUESTA_ABRIR_OFERTAS_CREDITAN" ||
          data.requestId !==
            requestId
        ) {
          return;
        }

        finalizar(
          data.resultado || {
            ok: false,
            code:
              "RESPUESTA_ABRIR_OFERTAS_INVALIDA",
            message:
              "La extensión respondió sin información válida."
          }
        );
      };

      window.addEventListener(
        "message",
        onMessage
      );

      const timer =
        setTimeout(() => {
          finalizar({
            ok: false,
            code:
              "ABRIR_OFERTAS_BRIDGE_NO_DISPONIBLE",
            message:
              "No se detectó la extensión del Simulador Creditan."
          });
        }, timeout);

      window.postMessage({
        source:
          "SERVICIOS_INTEGRALES_SIMULADOR",

        type:
          "ABRIR_OFERTAS_CREDITAN",

        requestId
      }, "*");
    });
  }

  /*
    Acción del nuevo botón MOSTRAR OFERTA.
  */

  async function ejecutarAbrirOfertasCreditan() {
    if (abriendoOfertasCreditan) {
      return;
    }

    const boton =
      $("#siRenovacionMostrarOferta");

    const estado =
      $("#siRenovacionMostrarOfertaEstado");

    if (!boton) {
      return;
    }

    abriendoOfertasCreditan = true;

    boton.disabled = true;
    boton.textContent =
      "ABRIENDO OFERTA...";

    if (estado) {
      estado.textContent =
        "Abriendo Buscar oferta en Creditan...";
    }

    try {
      const resultado =
        await abrirOfertasCreditan();

      if (!resultado?.ok) {
        if (estado) {
          estado.textContent =
            resultado?.message ||
            "No se pudo abrir Buscar oferta.";
        }

        console.warn(
          "[SERVICIOS INTEGRALES] MOSTRAR OFERTA:",
          resultado
        );

        return;
      }

      if (estado) {
        estado.textContent =
          "Buscar oferta abierto. Cargando importe y cuotas en Creditan...";
      }

      console.info(
        "[SERVICIOS INTEGRALES] MOSTRAR OFERTA correcto:",
        resultado
      );

      /*
        ÚNICA ETAPA NUEVA:
        una vez que Buscar oferta ya está abierto,
        usamos el canal de simulación EXISTENTE para
        enviar Importe a firmar + Cuotas a Creditan.

        Ese canal ya se encarga de completar Solicita,
        completar Cuotas, esperar el refresco de GeneXus
        y devolver la cuota real.
      */
      ofertasAbiertas = true;
      if (modoSimulacion === "cuota") await ejecutarSimulacionInversa();
      else await ejecutarSimulacionCreditan();

      if (estado) {
        estado.textContent =
          planCreditan?.ok
            ? "Oferta cargada y cuota recibida desde Creditan."
            : (
                simulacionError ||
                "Buscar oferta abierto en Creditan."
              );
      }
    } catch (error) {
      if (estado) {
        estado.textContent =
          "No se pudo abrir Buscar oferta.";
      }

      console.error(
        "[SERVICIOS INTEGRALES] Error MOSTRAR OFERTA:",
        error
      );
    } finally {
      abriendoOfertasCreditan = false;

      boton.disabled = false;
      boton.textContent =
        "MOSTRAR OFERTA";
    }
  }

  /*
    ==================================================
    SIMULADOR ORIGINAL

    Lo conservamos completo.

    En esta primera etapa NO lo vamos a disparar
    automáticamente al escribir importe/cuotas.
    ==================================================
  */

  function consultarPlanCreditan(
    capital,
    cuotas,
    timeout = 22000
  ) {
    return new Promise((resolve) => {
      const requestId =
        crearRequestIdSimulacion();

      let terminado = false;

      const finalizar = (
        resultado
      ) => {
        if (terminado) return;

        terminado = true;

        clearTimeout(timer);

        window.removeEventListener(
          "message",
          onMessage
        );

        resolve(resultado);
      };

      const onMessage = (event) => {
        if (
          event.source !== window
        ) {
          return;
        }

        const data =
          event.data;

        if (
          !data ||
          data.source !==
            "SERVICIOS_INTEGRALES_SIMULADOR_BRIDGE"
        ) {
          return;
        }

        if (
          data.type !==
            "RESPUESTA_SIMULACION_CREDITAN" ||
          data.requestId !==
            requestId
        ) {
          return;
        }

        finalizar(
          data.resultado || {
            ok: false,
            code:
              "RESPUESTA_SIMULACION_INVALIDA"
          }
        );
      };

      window.addEventListener(
        "message",
        onMessage
      );

      const timer =
        setTimeout(() => {
          finalizar({
            ok: false,
            code:
              "SIMULADOR_BRIDGE_NO_DISPONIBLE",
            message:
              "No se detectó la extensión del Simulador Creditan."
          });
        }, timeout);

      window.postMessage({
        source:
          "SERVICIOS_INTEGRALES_SIMULADOR",

        type:
          "SIMULAR_PLAN_CREDITAN",

        requestId,

        payload: {
          capital,
          cuotas
        }
      }, "*");
    });
  }

  // Búsqueda inversa: todas las cuotas se verifican contra la grilla REAL.
  // Nunca se publica un capital estimado sin confirmación de Creditan.
  async function ejecutarSimulacionInversa() {
    const cuotas = Number($("#siRenovacionCuotas")?.value || 0);
    const objetivo = numeroInput($("#siRenovacionCuotaDeseada")?.value);
    if (!Number.isInteger(cuotas) || cuotas <= 0 || objetivo <= 0) {
      simulacionError = "Ingresá cantidad de cuotas y valor de cuota deseado.";
      renderCalculos();
      return;
    }
    const miSecuencia = ++secuenciaSimulacion;
    clearTimeout(timerSimulacion);
    planCreditan = null;
    cuotaCreditan = null;
    simulacionError = "";
    simulandoCreditan = true;
    renderCalculos();
    const estadoOferta = $("#siRenovacionMostrarOfertaEstado");
    const consultar = async (capital) => {
      const importe = Math.max(1, Math.round(capital));
      const r = await consultarPlanCreditan(importe, cuotas, 28000);
      if (miSecuencia !== secuenciaSimulacion) throw new Error("CONSULTA_CANCELADA");
      if (!r?.ok || Math.abs(Number(r.capital) - importe) >= .02 || Number(r.cuotas) !== cuotas || Number(r.cuota) <= 0) {
        throw new Error(r?.message || "Creditan no devolvió una oferta verificable para ese importe.");
      }
      return r;
    };
    try {
      // Primer importe de referencia: el último capital ingresado o $1.000.000.
      const referencia = numeroInput($("#siRenovacionImporteFirmar")?.value) || 1000000;
      let actual = await consultar(referencia);
      let mejor = actual.cuota <= objetivo + .005 ? actual : null;
      let inferior = actual.cuota <= objetivo ? Number(actual.capital) : 0;
      let superior = actual.cuota > objetivo ? Number(actual.capital) : 0;
      if (estadoOferta) estadoOferta.textContent = "Buscando capital con cuotas reales de Creditan...";
      // Acercamiento proporcional: sólo sirve para proponer un nuevo capital.
      // El resultado final siempre se verifica con una consulta real.
      let candidato = Math.round(Number(actual.capital) * objetivo / Number(actual.cuota));
      if (Math.abs(candidato - Number(actual.capital)) < 1) candidato += actual.cuota <= objetivo ? 1 : -1;
      if (candidato > 0 && candidato !== Number(actual.capital)) {
        actual = await consultar(candidato);
        if (actual.cuota <= objetivo + .005 && (!mejor || actual.capital > mejor.capital)) mejor = actual;
        if (actual.cuota <= objetivo) inferior = Math.max(inferior, Number(actual.capital));
        else superior = superior ? Math.min(superior, Number(actual.capital)) : Number(actual.capital);
      }
      // Ajuste con un máximo de 6 consultas adicionales; sin extrapolar resultados.
      for (let i = 0; i < 6 && miSecuencia === secuenciaSimulacion; i++) {
        if (mejor && Math.abs(mejor.cuota - objetivo) <= .01) break;
        let siguiente;
        if (inferior > 0 && superior > inferior + 1) siguiente = Math.round((inferior + superior) / 2);
        else if (!inferior && superior > 1) siguiente = Math.round(superior / 2);
        else if (inferior > 0 && !superior) siguiente = Math.round(inferior * 1.08);
        else break;
        if (siguiente <= 0 || siguiente === Number(actual.capital)) break;
        actual = await consultar(siguiente);
        if (actual.cuota <= objetivo + .005 && (!mejor || actual.capital > mejor.capital)) mejor = actual;
        if (actual.cuota <= objetivo) inferior = Math.max(inferior, Number(actual.capital));
        else superior = superior ? Math.min(superior, Number(actual.capital)) : Number(actual.capital);
      }
      if (miSecuencia !== secuenciaSimulacion) return;
      if (!mejor) throw new Error("No se encontró una oferta real que no supere la cuota indicada.");
      // La búsqueda inversa prueba varios capitales. El último capital consultado
      // puede NO ser el mejor: dejamos los filtros REALES de Creditan exactamente
      // con el capital elegido y la cantidad de cuotas ingresada en SI.
      if (estadoOferta) estadoOferta.textContent = "Cargando el importe definitivo y las cuotas en Creditan...";
      const definitivo = await consultar(Number(mejor.capital));
      if (miSecuencia !== secuenciaSimulacion) return;
      if (Number(definitivo.cuota) > objetivo + .005) {
        throw new Error("La cuota definitiva de Creditan supera la cuota deseada. Revisá la oferta.");
      }
      mejor = definitivo;
      $("#siRenovacionImporteFirmar").value = new Intl.NumberFormat("es-AR", {maximumFractionDigits: 0}).format(mejor.capital);
      planCreditan = mejor;
      cuotaCreditan = Number(mejor.cuota);
      cuotaDeseada = objetivo;
      simulacionError = "";
      if (estadoOferta) estadoOferta.textContent = "Importe y cuotas cargados en Creditan. La cuota real se muestra en la grilla de ofertas.";
    } catch (error) {
      if (miSecuencia !== secuenciaSimulacion) return;
      planCreditan = null;
      cuotaCreditan = null;
      simulacionError = error?.message || "No se pudo consultar Creditan.";
      if (estadoOferta) estadoOferta.textContent = simulacionError;
    } finally {
      if (miSecuencia === secuenciaSimulacion) {
        simulandoCreditan = false;
        renderCalculos();
      }
    }
  }

  async function ejecutarSimulacionCreditan() {
    const importeFirmar =
      numeroInput(
        $("#siRenovacionImporteFirmar")?.value
      );

    const cuotas =
      Number(
        String(
          $("#siRenovacionCuotas")?.value ||
            ""
        ).replace(/\D/g, "")
      ) || 0;

    if (
      !Number.isFinite(
        importeFirmar
      ) ||
      importeFirmar <= 0 ||
      !Number.isInteger(
        cuotas
      ) ||
      cuotas <= 0
    ) {
      planCreditan = null;
      cuotaCreditan = null;
      simulacionError = "";
      simulandoCreditan = false;

      renderCalculos();
      return;
    }

    const miSecuencia =
      ++secuenciaSimulacion;

    planCreditan = null;
    cuotaCreditan = null;
    simulacionError = "";
    simulandoCreditan = true;

    renderCalculos();

    const resultado =
      await consultarPlanCreditan(
        importeFirmar,
        cuotas
      );

    /*
      Si el usuario cambió importe/cuotas mientras Creditan respondía,
      ignoramos la respuesta vieja.
    */
    if (
      miSecuencia !==
      secuenciaSimulacion
    ) {
      return;
    }

    simulandoCreditan = false;

    if (!resultado?.ok) {
      planCreditan = null;
      cuotaCreditan = null;

      simulacionError =
        resultado?.message ||
        "Creditan no devolvió una cuota para esta simulación.";

      renderCalculos();
      return;
    }

    if (
      Math.abs(
        Number(
          resultado.capital || 0
        ) -
        importeFirmar
      ) >= 0.02 ||
      Number(
        resultado.cuotas || 0
      ) !== cuotas
    ) {
      planCreditan = null;
      cuotaCreditan = null;

      simulacionError =
        "Creditan respondió con un plan distinto al solicitado.";

      renderCalculos();
      return;
    }

    planCreditan =
      resultado;

    cuotaCreditan =
      Number(
        resultado.cuota || 0
      );

    simulacionError = "";

    renderCalculos();

    console.info(
      "[SERVICIOS INTEGRALES] Plan real recibido desde Creditan:",
      resultado
    );
  }

  function programarSimulacionCreditan() {
    clearTimeout(
      timerSimulacion
    );

    secuenciaSimulacion++;

    planCreditan = null;
    cuotaCreditan = null;
    simulacionError = "";
    simulandoCreditan = false;

    renderCalculos();

    const importeFirmar =
      numeroInput(
        $("#siRenovacionImporteFirmar")?.value
      );

    const cuotas =
      Number(
        String(
          $("#siRenovacionCuotas")?.value ||
            ""
        ).replace(/\D/g, "")
      ) || 0;

    if (
      !Number.isFinite(
        importeFirmar
      ) ||
      importeFirmar <= 0 ||
      !Number.isInteger(
        cuotas
      ) ||
      cuotas <= 0
    ) {
      return;
    }

    timerSimulacion =
      setTimeout(() => {
        ejecutarSimulacionCreditan();
      }, 1200);
  }
  function asegurarEstilos() {
    if ($("#si-renovacion-style")) return;

    const style = document.createElement("style");
    style.id = "si-renovacion-style";

    style.textContent = `
      .ficha-credito-linea{
        display:flex;
        align-items:flex-start;
        gap:8px;
      }

      .si-renovacion-selector{
        flex:0 0 auto;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        margin-top:1px;
        cursor:pointer;
      }

      .si-renovacion-check{
        position:absolute;
        opacity:0;
        pointer-events:none;
      }

      .si-renovacion-check-visual{
        width:22px;
        height:22px;
        border:1.5px solid #59a96d;
        border-radius:5px;
        background:#fff;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        box-sizing:border-box;
        transition:.12s ease;
      }

      .si-renovacion-check:checked + .si-renovacion-check-visual{
        background:#14804a;
        border-color:#14804a;
      }

      .si-renovacion-check:checked + .si-renovacion-check-visual::after{
        content:"✓";
        color:#fff;
        font-size:15px;
        font-weight:900;
        line-height:1;
      }

      .si-renovacion-check:focus-visible + .si-renovacion-check-visual{
        outline:3px solid rgba(20,128,74,.17);
        outline-offset:2px;
      }

      .ficha-credito-linea.si-renovacion-linea-seleccionada{
        color:#0b6239;
      }

      .si-renovacion-saldo-manual-wrap{
        display:inline-flex;
        align-items:center;
        gap:6px;
        margin-left:8px;
        flex-wrap:wrap;
      }

      .si-renovacion-saldo-manual-label{
        color:#9a5b00;
        font-size:10px;
        font-weight:800;
      }

      .si-renovacion-saldo-manual{
        width:145px;
        min-height:28px;
        box-sizing:border-box;
        border:1px solid #e2b14a;
        border-radius:7px;
        background:#fffaf0;
        color:#17231d;
        padding:4px 7px;
        font:inherit;
        font-size:11px;
        font-weight:800;
      }

      .si-renovacion{
        margin-top:18px;
        padding-top:16px;
        border-top:1px solid rgba(16,92,53,.14);
      }

      .si-renovacion-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        margin-bottom:12px;
      }

      .si-renovacion-title{
        color:#0d633b;
        font-size:14px;
        font-weight:900;
        margin-bottom:3px;
      }

      .si-renovacion-help{
        color:#617069;
        font-size:12px;
        line-height:1.45;
      }

      .si-renovacion-count{
        flex:none;
        border-radius:999px;
        background:#edf8f2;
        color:#0d633b;
        padding:6px 9px;
        font-size:11px;
        font-weight:900;
      }

      .si-renovacion-cancelacion-grid,
      .si-renovacion-operacion-grid,
      .si-renovacion-cupo-grid{
        display:grid;
        gap:9px;
      }

      .si-renovacion-cancelacion-grid{
        grid-template-columns:repeat(4,minmax(0,1fr));
        margin-bottom:12px;
      }

      .si-renovacion-operacion-grid{
        grid-template-columns:repeat(3,minmax(0,1fr));
      }

      .si-renovacion-cupo-grid{
        grid-template-columns:repeat(4,minmax(0,1fr));
        margin-top:10px;
      }

      .si-renovacion-box{
        border:1px solid rgba(16,92,53,.15);
        border-radius:11px;
        background:#fbfefc;
        padding:10px 11px;
        min-width:0;
      }

      .si-renovacion-box span,
      .si-renovacion-field span{
        display:block;
        color:#68766e;
        font-size:10px;
        margin-bottom:4px;
      }

      .si-renovacion-box strong{
        display:block;
        color:#17231d;
        font-size:14px;
        overflow-wrap:anywhere;
      }

      .si-renovacion-box.destacado{
        background:#edf8f2;
        border-color:#b8ddc6;
      }

      .si-renovacion-box.destacado strong{
        color:#0d633b;
        font-size:16px;
      }

      .si-renovacion-field{
        display:block;
        min-width:0;
      }

      .si-renovacion-field input{
        width:100%;
        min-height:42px;
        box-sizing:border-box;
        border:1px solid rgba(16,92,53,.20);
        border-radius:10px;
        background:#fff;
        color:#17231d;
        padding:9px 10px;
        font:inherit;
        font-weight:800;
        outline:none;
      }

      .si-renovacion-field input:focus{
        border-color:#1d8b55;
        box-shadow:0 0 0 3px rgba(29,139,85,.10);
      }

      /*
        NUEVO - BOTÓN MOSTRAR OFERTA.
        Está separado del resto de la operación.
      */

      .si-renovacion-oferta-acciones{
        display:flex;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
        margin:0 0 12px;
      }

      .si-renovacion-mostrar-oferta{
        min-height:42px;
        border:0;
        border-radius:10px;
        background:#14804a;
        color:#fff;
        padding:10px 18px;
        font:inherit;
        font-size:12px;
        font-weight:900;
        cursor:pointer;
        box-shadow:0 2px 8px rgba(20,128,74,.16);
        transition:.12s ease;
      }

      .si-renovacion-mostrar-oferta:hover:not(:disabled){
        background:#0d633b;
      }

      .si-renovacion-mostrar-oferta:disabled{
        opacity:.65;
        cursor:wait;
      }

      .si-renovacion-mostrar-oferta-estado{
        color:#617069;
        font-size:11px;
        font-weight:700;
        line-height:1.35;
      }

      .si-renovacion-subtitle{
        margin:14px 0 7px;
        color:#0d633b;
        font-size:12px;
        font-weight:900;
        letter-spacing:.02em;
      }

      .si-renovacion-nota{
        margin-top:8px;
        color:#68766e;
        font-size:10px;
        line-height:1.45;
      }

      .si-renovacion-cupo-estado{
        margin-top:10px;
        border-radius:11px;
        padding:10px 12px;
        display:grid;
        gap:3px;
        border:1px solid;
      }

      .si-renovacion-cupo-estado strong{
        font-size:12px;
      }

      .si-renovacion-cupo-estado span{
        font-size:11px;
        line-height:1.4;
      }

      .si-renovacion-cupo-pendiente{
        background:#fffaf0;
        border-color:#ead99e;
        color:#665a34;
      }

      .si-renovacion-cupo-ok{
        background:#edf8f2;
        border-color:#a9d9bd;
        color:#0d633b;
      }

      .si-renovacion-cupo-no{
        background:#fff1f0;
        border-color:#efb0aa;
        color:#b42318;
      }

      @media (max-width:900px){
        .si-renovacion-cancelacion-grid,
        .si-renovacion-cupo-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .si-renovacion-operacion-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }

      @media (max-width:620px){
        .si-renovacion-head{
          flex-direction:column;
        }

        .si-renovacion-cancelacion-grid,
        .si-renovacion-operacion-grid,
        .si-renovacion-cupo-grid{
          grid-template-columns:1fr;
        }

        .ficha-credito-linea{
          align-items:flex-start;
        }

        .si-renovacion-oferta-acciones{
          align-items:stretch;
          flex-direction:column;
        }

        .si-renovacion-mostrar-oferta{
          width:100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function asegurarBloque() {
    let bloque =
      $("#siRenovacionBloque");

    if (bloque) {
      bloqueCreado = true;
      return bloque;
    }

    const detalle =
      $("#fichaDetalleCreditos");

    if (!detalle) {
      return null;
    }

    bloque =
      document.createElement(
        "section"
      );

    bloque.id =
      "siRenovacionBloque";

    bloque.className =
      "si-renovacion";

    bloque.innerHTML = `
      <div class="si-renovacion-head">
        <div>
          <div class="si-renovacion-title">
            ASISTENTE DE RENOVACIÓN / SIMULADOR
          </div>

          <div class="si-renovacion-help">
            Tildá arriba los créditos que quieras cancelar.
            El saldo y las cuotas se toman automáticamente
            de la ficha actual.
          </div>
        </div>

        <span
          id="siRenovacionSeleccionCantidad"
          class="si-renovacion-count"
        >
          0 seleccionados
        </span>
      </div>

      <div class="si-renovacion-cancelacion-grid">

        <div class="si-renovacion-box">
          <span>Saldo capital seleccionado</span>
          <strong id="siRenovacionSaldoSeleccionado">
            $ 0,00
          </strong>
        </div>

        <div class="si-renovacion-box">
          <span>5% cancelación</span>
          <strong id="siRenovacionCinco">
            $ 0,00
          </strong>
        </div>

        <div class="si-renovacion-box">
          <span>Total a cancelar</span>
          <strong id="siRenovacionTotalCancelar">
            $ 0,00
          </strong>
        </div>

        <div class="si-renovacion-box">
          <span>Cuotas que se liberan</span>
          <strong id="siRenovacionCuotasLiberadas">
            $ 0,00
          </strong>
        </div>

      </div>

      <div class="si-renovacion-subtitle">
        OPERACIÓN A REALIZAR
      </div>

      <!--
        NUEVO:
        Este botón solamente abre Buscar oferta
        en la pestaña de Creditan.
      -->

      <div class="si-renovacion-oferta-acciones">

        <button
          id="siRenovacionMostrarOferta"
          class="si-renovacion-mostrar-oferta"
          type="button"
        >
          MOSTRAR OFERTA
        </button>

        <span
          id="siRenovacionMostrarOfertaEstado"
          class="si-renovacion-mostrar-oferta-estado"
        >
          Abre Buscar oferta en Creditan.
        </span>

      </div>

      <div class="si-renovacion-operacion-grid">

        <label class="si-renovacion-field">
          <span>Importe a firmar</span>

          <input
            id="siRenovacionImporteFirmar"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="Ej.: 2240000"
          >
        </label>

        <label class="si-renovacion-field">
          <span>Cuotas</span>

          <input
            id="siRenovacionCuotas"
            type="number"
            inputmode="numeric"
            min="1"
            max="99"
            step="1"
            autocomplete="off"
            placeholder="Ej.: 12"
          >
        </label>

        <label class="si-renovacion-field">
          <span>Valor de cuota deseado (editable)</span>
          <input id="siRenovacionCuotaDeseada" type="text" inputmode="decimal"
                 autocomplete="off" placeholder="Ej.: 213.546,50">
        </label>

        <div class="si-renovacion-box">
          <span>Importe de cuota real</span>

          <strong id="siRenovacionCuotaCreditan">
            Pendiente Creditan
          </strong>
        </div>

        <div class="si-renovacion-box">
          <span>Comisión Creditan</span>

          <strong id="siRenovacionComision">
            $ 0,00
          </strong>
        </div>

        <div class="si-renovacion-box">
          <span>
            Neto base antes de cancelaciones
          </span>

          <strong id="siRenovacionNetoBase">
            $ 0,00
          </strong>
        </div>

        <div class="si-renovacion-box destacado">
          <span>EN MANO FINAL</span>

          <strong id="siRenovacionEnManoFinal">
            $ 0,00
          </strong>
        </div>

      </div>

      <div class="si-renovacion-nota">
        El 5% se calcula sobre la suma total de saldos
        seleccionados. En esta etapa, MOSTRAR OFERTA
        solamente abre la grilla real de Creditan.
      </div>

      <div class="si-renovacion-subtitle">
        ANÁLISIS DE CUPO
      </div>

      <div class="si-renovacion-cupo-grid">

        <div class="si-renovacion-box">
          <span>Cupo actual</span>

          <strong id="siRenovacionCupoActual">
            Pendiente
          </strong>
        </div>

        <div class="si-renovacion-box">
          <span>+ Cuotas liberadas</span>

          <strong id="siRenovacionCupoLiberado">
            $ 0,00
          </strong>
        </div>

        <div class="si-renovacion-box destacado">
          <span>
            Cupo disponible proyectado
          </span>

          <strong id="siRenovacionCupoProyectado">
            Pendiente
          </strong>
        </div>

        <div class="si-renovacion-box">
          <span>Nueva cuota Creditan</span>

          <strong id="siRenovacionNuevaCuota">
            Pendiente Creditan
          </strong>
        </div>

      </div>

      <div
        id="siRenovacionEstadoCupo"
        class="
          si-renovacion-cupo-estado
          si-renovacion-cupo-pendiente
        "
      >
        <strong>⚪ PENDIENTE</strong>

        <span>
          Completá la operación para analizarla.
        </span>
      </div>
    `;

    /*
      Conservamos la ubicación original
      del bloque de renovación.
    */

    const observaciones =
      $("#fichaObservacionesBloque");

    if (observaciones) {
      observaciones.insertAdjacentElement(
        "beforebegin",
        bloque
      );
    } else {
      detalle.insertAdjacentElement(
        "afterend",
        bloque
      );
    }

    const inputFirmar =
      $("#siRenovacionImporteFirmar");

    const inputCuotas =
      $("#siRenovacionCuotas");

    /*
      IMPORTANTE - ETAPA 1

      Conservamos todos los cálculos visuales,
      pero NO disparamos automáticamente el
      simulador Creditan mientras escribimos.

      Esto evita que Creditan empiece a tocar
      Buscar oferta sin que nosotros se lo
      pidamos expresamente.
    */

    inputFirmar?.addEventListener(
      "input",
      () => {
        /*
          Si había una cuota anterior,
          queda invalidada al cambiar el importe.
        */

        modoSimulacion = "capital";
        const cuotaInput = $("#siRenovacionCuotaDeseada");
        if (cuotaInput) cuotaInput.value = "";
        cuotaDeseada = 0;
        secuenciaSimulacion++;

        clearTimeout(
          timerSimulacion
        );

        planCreditan = null;
        cuotaCreditan = null;
        simulacionError = "";
        simulandoCreditan = false;

        renderCalculos();
        if (ofertasAbiertas && numeroInput(inputFirmar.value) > 0 && Number(inputCuotas?.value) > 0) {
          timerSimulacion = setTimeout(ejecutarSimulacionCreditan, 1000);
        }
      }
    );

    inputCuotas?.addEventListener(
      "input",
      () => {
        /*
          Igual que con el importe:
          cambiar las cuotas invalida cualquier
          resultado anterior.
        */

        secuenciaSimulacion++;

        clearTimeout(
          timerSimulacion
        );

        planCreditan = null;
        cuotaCreditan = null;
        simulacionError = "";
        simulandoCreditan = false;

        renderCalculos();
        if (ofertasAbiertas && Number(inputCuotas.value) > 0) {
          timerSimulacion = setTimeout(
            modoSimulacion === "cuota" ? ejecutarSimulacionInversa : ejecutarSimulacionCreditan,
            1000
          );
        }
      }
    );

    /*
      Formateamos el importe al salir,
      igual que en el funcionamiento original.

      NO hacemos ninguna consulta a Creditan acá.
    */

    const inputCuotaDeseada = $("#siRenovacionCuotaDeseada");
    inputCuotaDeseada?.addEventListener("input", () => {
      modoSimulacion = "cuota";
      cuotaDeseada = numeroInput(inputCuotaDeseada.value);
      secuenciaSimulacion++;
      clearTimeout(timerSimulacion);
      planCreditan = null;
      cuotaCreditan = null;
      simulacionError = "";
      simulandoCreditan = false;
      // No conservar un capital anterior como si fuera el resultado inverso.
      if (inputFirmar) inputFirmar.value = "";
      renderCalculos();
      if (ofertasAbiertas && cuotaDeseada > 0 && Number(inputCuotas?.value) > 0) {
        timerSimulacion = setTimeout(ejecutarSimulacionInversa, 1000);
      }
    });
    inputCuotaDeseada?.addEventListener("blur", () => {
      const n = numeroInput(inputCuotaDeseada.value);
      if (n > 0) inputCuotaDeseada.value = new Intl.NumberFormat("es-AR", {
        minimumFractionDigits: 2, maximumFractionDigits: 2
      }).format(n);
    });

    inputFirmar?.addEventListener(
      "blur",
      () => {
        const valor =
          numeroInput(
            inputFirmar.value
          );

        if (valor > 0) {
          inputFirmar.value =
            new Intl.NumberFormat(
              "es-AR",
              {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
              }
            ).format(valor);
        }

        renderCalculos();
      }
    );

    /*
      NUEVO:
      conectamos únicamente el botón
      MOSTRAR OFERTA.
    */

    $("#siRenovacionMostrarOferta")
      ?.addEventListener(
        "click",
        ejecutarAbrirOfertasCreditan
      );

    bloqueCreado = true;

    /*
      Muy importante:
      después de crear el bloque volvemos
      a dibujar todos los cálculos.
    */

    renderCalculos();

    return bloque;
  }
  function limpiarParaNuevoCliente(nuevoCuil) {
    /*
      Limpiamos solamente el estado propio
      del asistente de renovación.

      NO tocamos la ficha.
      NO tocamos los créditos.
      NO tocamos Creditan.
    */

    seleccionadas.clear();
    modoSimulacion = "capital";
    cuotaDeseada = 0;
    ofertasAbiertas = false;
    saldosManuales.clear();

    cuotaCreditan = null;
    planCreditan = null;

    simulacionError = "";
    simulandoCreditan = false;

    secuenciaSimulacion++;

    clearTimeout(
      timerSimulacion
    );

    cuilActual =
      nuevoCuil;

    const inputFirmar =
      $("#siRenovacionImporteFirmar");

    const inputCuotas =
      $("#siRenovacionCuotas");

    if (inputFirmar) {
      inputFirmar.value = "";
    }

    if (inputCuotas) {
      inputCuotas.value = "";
    }
    const inputCuotaDeseada = $("#siRenovacionCuotaDeseada");
    if (inputCuotaDeseada) inputCuotaDeseada.value = "";

    /*
      También restauramos solamente
      el estado visual del botón nuevo.
    */

    const botonOferta =
      $("#siRenovacionMostrarOferta");

    const estadoOferta =
      $("#siRenovacionMostrarOfertaEstado");

    abriendoOfertasCreditan = false;

    if (botonOferta) {
      botonOferta.disabled = false;
      botonOferta.textContent =
        "MOSTRAR OFERTA";
    }

    if (estadoOferta) {
      estadoOferta.textContent =
        "Abre Buscar oferta en Creditan.";
    }

    sincronizarCheckboxes();
    renderCalculos();
  }

  function sincronizarTodo() {
    /*
      Primero nos aseguramos de que exista
      el bloque completo del asistente.
    */

    asegurarBloque();

    /*
      Detectamos el CUIL actual de la ficha.
    */

    const nuevoCuil =
      soloDigitos(
        texto(
          "#fichaCuil",
          ""
        )
      );

    /*
      Si cambió el cliente, limpiamos solamente
      la selección y la simulación anterior.
    */

    if (
      nuevoCuil &&
      nuevoCuil !== cuilActual
    ) {
      limpiarParaNuevoCliente(
        nuevoCuil
      );
    }

    /*
      Volvemos a sincronizar los checks
      contra los créditos que realmente
      están visibles en la ficha.
    */

    sincronizarCheckboxes();

    /*
      Y refrescamos los números del simulador.
    */

    renderCalculos();
  }

  function programarSync() {
    clearTimeout(
      timerSync
    );

    timerSync =
      setTimeout(
        sincronizarTodo,
        80
      );
  }

  /*
    ==================================================
    API PÚBLICA DEL ASISTENTE DE RENOVACIÓN

    Conservamos la interfaz original para no romper
    ninguna otra parte de Servicios Integrales.
    ==================================================
  */

  window.ServiciosIntegralesRenovacion = {
    /*
      Permite colocar una cuota Creditan
      desde afuera si alguna integración
      necesita hacerlo.
    */

    setCuotaCreditan(valor) {
      const n =
        Number(valor);

      planCreditan = null;
      simulacionError = "";
      simulandoCreditan = false;

      if (
        !Number.isFinite(n) ||
        n < 0
      ) {
        cuotaCreditan = null;
      } else {
        cuotaCreditan = n;
      }

      renderCalculos();
    },

    /*
      Limpia solamente la cuota Creditan.
    */

    resetCuotaCreditan() {
      planCreditan = null;
      cuotaCreditan = null;
      simulacionError = "";
      simulandoCreditan = false;

      renderCalculos();
    },

    /*
      La simulación automática queda PAUSADA
      en esta etapa.

      No la eliminamos del archivo.
      Simplemente evitamos que otra parte pueda
      dispararla accidentalmente mientras
      probamos MOSTRAR OFERTA.
    */

    simularAhora() {
      return Promise.resolve({
        ok: false,
        code:
          "CUOTA_CREDITAN_PAUSADA",
        message:
          "La consulta automática está pausada durante la etapa MOSTRAR OFERTA."
      });
    },

    /*
      Devuelve el estado actual completo
      del asistente.
    */

    getEstado() {
      return calcularEstado();
    }
  };

  /*
    ==================================================
    INICIALIZACIÓN
    ==================================================
  */

  asegurarEstilos();

  /*
    Observamos cambios en la ficha consolidada.

    Esto es lo que permite que aparezcan los checks
    cuando los créditos se cargan o actualizan.
  */

  const observerFicha =
    new MutationObserver(
      programarSync
    );

  observerFicha.observe(
    ficha,
    {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "class"
      ]
    }
  );

  /*
    También observamos el bloque del cliente,
    igual que en la versión funcional.
  */

  const observerCliente =
    new MutationObserver(
      programarSync
    );

  observerCliente.observe(
    clientCard,
    {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "class"
      ]
    }
  );

  /*
    Primera sincronización.
  */

  programarSync();

  console.info(
    "[SERVICIOS INTEGRALES] Tabla de renovación + selección de créditos + MOSTRAR OFERTA activa."
  );
})();
