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
  - La CUOTA REAL de Creditan queda pendiente para la siguiente etapa,
    donde la traeremos automáticamente desde el puente.

  IMPORTANTE:
  - NO modifica app.js.
  - NO modifica ficha.js.
  - NO modifica gestion.js.
  - NO modifica historial.js.
  - NO modifica cupo.js.
  - NO modifica connector.js.
  - NO toca la extensión de Creditan.
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
  let simulacionError = "";
  let simulandoCreditan = false;
  let timerSimulacion = null;
  let secuenciaSimulacion = 0;
  let timerSync = null;
  let bloqueCreado = false;

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
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        s = s.replace(/,/g, "");
      }
    } else if (tieneComa) {
      const partes = s.split(",");

      if (partes.length > 2) {
        s = partes.join("");
      } else {
        const [entero, decimal = ""] = partes;

        if (decimal.length === 3 && entero.length >= 1) {
          s = entero + decimal;
        } else {
          s = entero + "." + decimal;
        }
      }
    } else if (tienePunto) {
      const partes = s.split(".");

      if (partes.length > 2) {
        s = partes.join("");
      } else {
        const [entero, decimal = ""] = partes;

        if (decimal.length === 3 && entero.length >= 1) {
          s = entero + decimal;
        } else {
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
        <span>Ingresá importe a firmar y cuotas.</span>
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
      estado.importeFirmar > 0 ? dinero(estado.comision) : "$ 0,00"
    );

    escribir(
      "siRenovacionNetoBase",
      estado.importeFirmar > 0 ? dinero(estado.netoBase) : "$ 0,00"
    );

    escribir(
      "siRenovacionEnManoFinal",
      estado.importeFirmar > 0 ? dinero(estado.enManoFinal) : "$ 0,00"
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
    linea.classList.toggle("si-renovacion-linea-seleccionada", activa);
  }

  function sincronizarCheckboxes() {
    const detalle = $("#fichaDetalleCreditos");
    if (!detalle) return;

    const lineas = $$(".ficha-credito-linea", detalle);

    for (const linea of lineas) {
      const operacion = leerOperacionDeLinea(linea);
      if (!operacion) continue;

      let input = $(
        `.si-renovacion-check[data-operacion="${CSS.escape(operacion)}"]`,
        linea
      );

      if (!input) {
        const selector = document.createElement("label");
        selector.className = "si-renovacion-selector";
        selector.title = `Seleccionar operación ${operacion} para cancelar`;

        input = document.createElement("input");
        input.type = "checkbox";
        input.className = "si-renovacion-check";
        input.dataset.operacion = operacion;
        input.setAttribute(
          "aria-label",
          `Seleccionar operación ${operacion} para cancelar`
        );

        const marca = document.createElement("span");
        marca.className = "si-renovacion-check-visual";
        marca.setAttribute("aria-hidden", "true");

        selector.appendChild(input);
        selector.appendChild(marca);

        linea.prepend(selector);

        input.addEventListener("change", () => {
          if (input.checked) {
            seleccionadas.add(operacion);
          } else {
            seleccionadas.delete(operacion);
          }

          actualizarCheckboxVisual(input, linea);

          const creditoActual =
            leerCredito(operacion);

          asegurarEditorSaldoManual(
            linea,
            operacion,
            input.checked &&
              creditoActual.necesitaSaldoManual
          );

          renderCalculos();
        });
      }

      input.checked = seleccionadas.has(operacion);
      actualizarCheckboxVisual(input, linea);

      const creditoActual = leerCredito(operacion);

      asegurarEditorSaldoManual(
        linea,
        operacion,
        input.checked &&
          creditoActual.necesitaSaldoManual
      );
    }

    const operacionesActuales = new Set(
      lineas.map(leerOperacionDeLinea).filter(Boolean)
    );

    for (const op of [...seleccionadas]) {
      if (!operacionesActuales.has(op)) {
        seleccionadas.delete(op);
      }
    }

    renderCalculos();
  }

  function crearRequestIdSimulacion() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return `sim-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function abrirOfertasCreditan(timeout = 12000) {
    return new Promise((resolve) => {
      const requestId = crearRequestIdSimulacion();
      let terminado = false;

      const finalizar = (resultado) => {
        if (terminado) return;
        terminado = true;
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(resultado);
      };

      const onMessage = (event) => {
        if (event.source !== window) return;

        const data = event.data;

        if (
          !data ||
          data.source !== "SERVICIOS_INTEGRALES_SIMULADOR_BRIDGE" ||
          data.type !== "RESPUESTA_ABRIR_OFERTAS_CREDITAN" ||
          data.requestId !== requestId
        ) {
          return;
        }

        finalizar(
          data.resultado || {
            ok: false,
            code: "RESPUESTA_ABRIR_OFERTAS_INVALIDA"
          }
        );
      };

      window.addEventListener("message", onMessage);

      const timer = setTimeout(() => {
        finalizar({
          ok: false,
          code: "ABRIR_OFERTAS_BRIDGE_NO_DISPONIBLE",
          message:
            "No se detectó la extensión del Simulador Creditan."
        });
      }, timeout);

      window.postMessage({
        source: "SERVICIOS_INTEGRALES_SIMULADOR",
        type: "ABRIR_OFERTAS_CREDITAN",
        requestId
      }, "*");
    });
  }

  async function ejecutarAbrirOfertasCreditan() {
    const boton = $("#siRenovacionMostrarOferta");
    if (!boton) return;

    const textoOriginal = boton.textContent;

    boton.disabled = true;
    boton.textContent = "ABRIENDO OFERTA...";

    try {
      const resultado = await abrirOfertasCreditan();

      if (!resultado?.ok) {
        console.warn(
          "[SERVICIOS INTEGRALES] No se pudo abrir Mostrar ofertas:",
          resultado
        );
        return;
      }

      console.info(
        "[SERVICIOS INTEGRALES] Buscar oferta abierto en Creditan."
      );
    } finally {
      boton.disabled = false;
      boton.textContent = textoOriginal;
    }
  }
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
  - La CUOTA REAL de Creditan queda pendiente para la siguiente etapa,
    donde la traeremos automáticamente desde el puente.

  IMPORTANTE:
  - NO modifica app.js.
  - NO modifica ficha.js.
  - NO modifica gestion.js.
  - NO modifica historial.js.
  - NO modifica cupo.js.
  - NO modifica connector.js.
  - NO toca la extensión de Creditan.
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
  let simulacionError = "";
  let simulandoCreditan = false;
  let timerSimulacion = null;
  let secuenciaSimulacion = 0;
  let timerSync = null;
  let bloqueCreado = false;

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
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        s = s.replace(/,/g, "");
      }
    } else if (tieneComa) {
      const partes = s.split(",");

      if (partes.length > 2) {
        s = partes.join("");
      } else {
        const [entero, decimal = ""] = partes;

        if (decimal.length === 3 && entero.length >= 1) {
          s = entero + decimal;
        } else {
          s = entero + "." + decimal;
        }
      }
    } else if (tienePunto) {
      const partes = s.split(".");

      if (partes.length > 2) {
        s = partes.join("");
      } else {
        const [entero, decimal = ""] = partes;

        if (decimal.length === 3 && entero.length >= 1) {
          s = entero + decimal;
        } else {
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
        <span>Ingresá importe a firmar y cuotas.</span>
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
      estado.importeFirmar > 0 ? dinero(estado.comision) : "$ 0,00"
    );

    escribir(
      "siRenovacionNetoBase",
      estado.importeFirmar > 0 ? dinero(estado.netoBase) : "$ 0,00"
    );

    escribir(
      "siRenovacionEnManoFinal",
      estado.importeFirmar > 0 ? dinero(estado.enManoFinal) : "$ 0,00"
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
    linea.classList.toggle("si-renovacion-linea-seleccionada", activa);
  }

  function sincronizarCheckboxes() {
    const detalle = $("#fichaDetalleCreditos");
    if (!detalle) return;

    const lineas = $$(".ficha-credito-linea", detalle);

    for (const linea of lineas) {
      const operacion = leerOperacionDeLinea(linea);
      if (!operacion) continue;

      let input = $(
        `.si-renovacion-check[data-operacion="${CSS.escape(operacion)}"]`,
        linea
      );

      if (!input) {
        const selector = document.createElement("label");
        selector.className = "si-renovacion-selector";
        selector.title = `Seleccionar operación ${operacion} para cancelar`;

        input = document.createElement("input");
        input.type = "checkbox";
        input.className = "si-renovacion-check";
        input.dataset.operacion = operacion;
        input.setAttribute(
          "aria-label",
          `Seleccionar operación ${operacion} para cancelar`
        );

        const marca = document.createElement("span");
        marca.className = "si-renovacion-check-visual";
        marca.setAttribute("aria-hidden", "true");

        selector.appendChild(input);
        selector.appendChild(marca);

        linea.prepend(selector);

        input.addEventListener("change", () => {
          if (input.checked) {
            seleccionadas.add(operacion);
          } else {
            seleccionadas.delete(operacion);
          }

          actualizarCheckboxVisual(input, linea);

          const creditoActual =
            leerCredito(operacion);

          asegurarEditorSaldoManual(
            linea,
            operacion,
            input.checked &&
              creditoActual.necesitaSaldoManual
          );

          renderCalculos();
        });
      }

      input.checked = seleccionadas.has(operacion);
      actualizarCheckboxVisual(input, linea);

      const creditoActual = leerCredito(operacion);

      asegurarEditorSaldoManual(
        linea,
        operacion,
        input.checked &&
          creditoActual.necesitaSaldoManual
      );
    }

    const operacionesActuales = new Set(
      lineas.map(leerOperacionDeLinea).filter(Boolean)
    );

    for (const op of [...seleccionadas]) {
      if (!operacionesActuales.has(op)) {
        seleccionadas.delete(op);
      }
    }

    renderCalculos();
  }

  function crearRequestIdSimulacion() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return `sim-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function abrirOfertasCreditan(timeout = 12000) {
    return new Promise((resolve) => {
      const requestId = crearRequestIdSimulacion();
      let terminado = false;

      const finalizar = (resultado) => {
        if (terminado) return;
        terminado = true;
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(resultado);
      };

      const onMessage = (event) => {
        if (event.source !== window) return;

        const data = event.data;

        if (
          !data ||
          data.source !== "SERVICIOS_INTEGRALES_SIMULADOR_BRIDGE" ||
          data.type !== "RESPUESTA_ABRIR_OFERTAS_CREDITAN" ||
          data.requestId !== requestId
        ) {
          return;
        }

        finalizar(
          data.resultado || {
            ok: false,
            code: "RESPUESTA_ABRIR_OFERTAS_INVALIDA"
          }
        );
      };

      window.addEventListener("message", onMessage);

      const timer = setTimeout(() => {
        finalizar({
          ok: false,
          code: "ABRIR_OFERTAS_BRIDGE_NO_DISPONIBLE",
          message:
            "No se detectó la extensión del Simulador Creditan."
        });
      }, timeout);

      window.postMessage({
        source: "SERVICIOS_INTEGRALES_SIMULADOR",
        type: "ABRIR_OFERTAS_CREDITAN",
        requestId
      }, "*");
    });
  }

  async function ejecutarAbrirOfertasCreditan() {
    const boton = $("#siRenovacionMostrarOferta");
    if (!boton) return;

    const textoOriginal = boton.textContent;

    boton.disabled = true;
    boton.textContent = "ABRIENDO OFERTA...";

    try {
      const resultado = await abrirOfertasCreditan();

      if (!resultado?.ok) {
        console.warn(
          "[SERVICIOS INTEGRALES] No se pudo abrir Mostrar ofertas:",
          resultado
        );
        return;
      }

      console.info(
        "[SERVICIOS INTEGRALES] Buscar oferta abierto en Creditan."
      );
    } finally {
      boton.disabled = false;
      boton.textContent = textoOriginal;
    }
  }
