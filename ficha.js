/*
  SERVICIOS INTEGRALES - FICHA INTERNA CONSOLIDADA
  V1.0

  IMPORTANTE:
  - NO modifica app.js.
  - NO modifica connector.js.
  - NO modifica cupo.js.
  - NO consulta Creditan.
  - NO recalcula cuotas ni saldos.
  - Solo lee los datos que los módulos existentes YA mostraron en pantalla.
*/

(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const ficha = $("#fichaConsolidada");
  const clientCard = $("#clientCard");
  const cuilInput = $("#cuilInput");
  const resultCard = $("#resultCard");
  const cupoFinal = $("#cupoFinal");

  if (!ficha || !clientCard) {
    console.warn(
      "[SERVICIOS INTEGRALES] Ficha consolidada: no se encontró la estructura HTML."
    );
    return;
  }

  let ultimoCupo = {
    cuil: "",
    texto: "Pendiente",
    negativo: false
  };

  function soloDigitos(valor) {
    return String(valor || "").replace(/\D/g, "");
  }

  function texto(selector, fallback = "—") {
    const el = $(selector);
    const valor = String(el?.textContent || "").trim();
    return valor || fallback;
  }

  function escribir(selector, valor) {
    const el = $(selector);
    if (el) el.textContent = valor;
  }

  function fichaClienteVisible() {
    return !clientCard.classList.contains("hidden");
  }

  function ocultarFicha() {
    ficha.classList.add("hidden");
  }

  function leerCupoActual() {
    if (!resultCard || !cupoFinal) return;

    /*
      El cupo solo se considera disponible cuando el calculador
      ya mostró su tarjeta de resultado.
    */
    if (!resultCard.classList.contains("show")) {
      return;
    }

    const cuilActual = soloDigitos(cuilInput?.value);

    ultimoCupo = {
      cuil: cuilActual.length === 11 ? cuilActual : "",
      texto: String(cupoFinal.textContent || "").trim() || "Pendiente",
      negativo: resultCard.classList.contains("negative")
    };

    actualizarFicha();
  }

  function asegurarDetalleCreditos() {
    let contenedor = $("#fichaDetalleCreditos");

    if (!contenedor) {
      contenedor = document.createElement("div");
      contenedor.id = "fichaDetalleCreditos";
      contenedor.className = "ficha-detalle-creditos";

      const resumen = ficha.querySelector(".ficha-resumen-grid");
      if (resumen) {
        resumen.insertAdjacentElement("afterend", contenedor);
      } else {
        ficha.appendChild(contenedor);
      }
    }

    return contenedor;
  }

  function cuotaActualDesdeTarjeta(tarjeta) {
    /*
      El Estado de Cuenta ya marca con la clase "recommended"
      la cuota de referencia del mes. Nosotros solo la leemos.

      Si no existe una fila recomendada, el crédito todavía no comenzó
      a descontarse y mostramos 0 de N, tal como definimos.
    */
    const filaRecomendada = tarjeta.querySelector(
      '[data-field="cuotasTable"] tr.recommended'
    );

    if (!filaRecomendada) return "0";

    const primeraCelda = filaRecomendada.querySelector("td");
    const valor = String(primeraCelda?.textContent || "").trim();

    return /^\d+$/.test(valor) ? valor : "0";
  }

  function renderDetalleCreditos() {
    const contenedor = asegurarDetalleCreditos();
    const tarjetas = Array.from(
      document.querySelectorAll("#creditsList .credit-card")
    );

    contenedor.innerHTML = "";

    if (!tarjetas.length) {
      contenedor.classList.add("hidden");
      return;
    }

    for (const tarjeta of tarjetas) {
      const operacion = String(
        tarjeta.querySelector('[data-field="operacion"]')?.textContent || "—"
      ).trim();

      const valorCuota = String(
        tarjeta.querySelector('[data-field="valorCuota"]')?.textContent || "$ 0,00"
      ).trim();

      const cuotasTotales = String(
        tarjeta.querySelector('[data-field="cuotas"]')?.textContent || "—"
      ).trim();

      const saldoCapital = String(
        tarjeta.querySelector('[data-field="saldoCapital"]')?.textContent || "$ 0,00"
      ).trim();

      const cuotaActual = cuotaActualDesdeTarjeta(tarjeta);

      const linea = document.createElement("div");
      linea.className = "ficha-credito-linea";

      const operacionStrong = document.createElement("strong");
      operacionStrong.textContent = `Operación ${operacion}`;

      const cuotaStrong = document.createElement("strong");
      cuotaStrong.textContent = valorCuota;

      const progresoStrong = document.createElement("strong");
      progresoStrong.textContent = `${cuotaActual} de ${cuotasTotales}`;

      const saldoStrong = document.createElement("strong");
      saldoStrong.textContent = saldoCapital;

      linea.append("• ");
      linea.appendChild(operacionStrong);
      linea.append(" - Valor cuota ");
      linea.appendChild(cuotaStrong);
      linea.append(" - cuota ");
      linea.appendChild(progresoStrong);
      linea.append(" - Saldo capital ");
      linea.appendChild(saldoStrong);

      contenedor.appendChild(linea);
    }

    contenedor.classList.remove("hidden");
  }

  function actualizarFicha() {
    /*
      Si Estado de Cuenta todavía no terminó, la ficha permanece oculta.
    */
    if (!fichaClienteVisible()) {
      ocultarFicha();
      return;
    }

    /*
      TODOS estos valores se copian literalmente del Estado de Cuenta
      ya renderizado por app.js.
    */
    const nombre = texto("#clientName", "CLIENTE");
    const cuil = texto("#clientCuil", "—");
    const organismo = texto("#clientOrganismo", "—");
    const vigentes = texto("#vigentesCount", "0");
    const totalCuotas = texto("#cuotaTotal", "$ 0,00");
    const saldoTotal = texto("#saldoTotal", "$ 0,00");

    const cuilCliente = soloDigitos(cuil);
    const cupoPerteneceAlCliente =
      cuilCliente.length === 11 &&
      ultimoCupo.cuil === cuilCliente;

    escribir("#fichaNombre", nombre);
    escribir("#fichaCuil", cuil);
    escribir("#fichaOrganismo", organismo);
    escribir("#fichaVigentes", vigentes);
    escribir("#fichaCuotasTotal", totalCuotas);
    escribir("#fichaSaldoTotal", saldoTotal);
    escribir(
      "#fichaCupo",
      cupoPerteneceAlCliente ? ultimoCupo.texto : "Pendiente"
    );

    const fichaCupo = $(".ficha-cupo");

    if (fichaCupo) {
      fichaCupo.classList.toggle(
        "negative",
        cupoPerteneceAlCliente && ultimoCupo.negativo
      );
    }

    /*
      El detalle se arma leyendo las tarjetas YA renderizadas.
      No recalcula ni modifica ningún dato.
    */
    renderDetalleCreditos();

    ficha.classList.remove("hidden");
  }

  /*
    Observamos solamente el RESULTADO VISUAL del Estado de Cuenta.
    No interceptamos la consulta ni modificamos sus datos.
  */
  const estadoObserver = new MutationObserver(() => {
    actualizarFicha();
  });

  estadoObserver.observe(clientCard, {
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    subtree: true
  });

  /*
    Observamos solamente el RESULTADO VISUAL del Calculador de Cupo.
  */
  if (resultCard) {
    const cupoObserver = new MutationObserver(() => {
      leerCupoActual();
    });

    cupoObserver.observe(resultCard, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true
    });
  }

  /*
    Cuando se pulsa Limpiar, app.js oculta clientCard.
    El observer anterior detecta eso y oculta también la ficha.
  */
  /*
    Estilo aislado de las nuevas líneas.
    Se inyecta desde ficha.js para no modificar styles.css.
  */
  if (!document.getElementById("si-ficha-detalle-style")) {
    const style = document.createElement("style");
    style.id = "si-ficha-detalle-style";
    style.textContent = `
      .ficha-detalle-creditos{
        margin-top:18px;
        padding-top:16px;
        border-top:1px solid rgba(16,92,53,.14);
        display:grid;
        gap:8px;
      }
      .ficha-detalle-creditos.hidden{
        display:none;
      }
      .ficha-credito-linea{
        font-size:15px;
        line-height:1.45;
        color:#17231d;
      }
      .ficha-credito-linea strong{
        font-weight:800;
      }
      @media (max-width:760px){
        .ficha-credito-linea{
          font-size:14px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  actualizarFicha();

  console.info(
    "[SERVICIOS INTEGRALES] Ficha interna consolidada V1.1 activa."
  );
})();
