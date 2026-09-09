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
  actualizarFicha();

  console.info(
    "[SERVICIOS INTEGRALES] Ficha interna consolidada V1.0 activa."
  );
})();
