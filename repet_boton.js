
/*
  SERVICIOS INTEGRALES - BOTÓN RePET V1

  Archivo: repet_boton.js

  FUNCIÓN:
  - Agrega el botón DESCARGAR RePET.
  - Lo coloca junto a PDF CLIENTE y UIF.
  - Obtiene el nombre del cliente consultado.
  - Envía la solicitud al bridge RePET.
  - Recibe el resultado de la consulta.

  La impresión oficial se realiza desde
  repet_bridge.js, dentro de RePET.

  NO modifica los PDF existentes.
  NO modifica UIF ni Creditan.
*/

(() => {
  "use strict";

  const LOG =
    "[SERVICIOS INTEGRALES][BOTÓN RePET]";

  const SOURCE_APP =
    "SERVICIOS_INTEGRALES";

  const SOURCE_BRIDGE =
    "SERVICIOS_INTEGRALES_REPET_BRIDGE";

  let consultaEnCurso = false;

  /*
    ----------------------------------------
    UTILIDADES
    ----------------------------------------
  */

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function limpiarNombre(valor) {
    return String(valor || "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function generarRequestId() {
    return (
      "REPET_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 10)
    );
  }

  /*
    ----------------------------------------
    OBTENER NOMBRE DEL CLIENTE

    Se busca primero en la ficha visible.
    No se toma un nombre escrito manualmente
    si existe una ficha consolidada.
    ----------------------------------------
  */

  function obtenerNombreActual() {
    const candidatos = [
      "#fichaNombre",
      "#fichaNombreCompleto",
      "#nombreCliente",
      "#clienteNombre"
    ];

    for (const selector of candidatos) {
      const elemento = $(selector);

      if (!elemento) {
        continue;
      }

      const valor =
        elemento.value !== undefined
          ? elemento.value
          : elemento.textContent;

      const nombre = limpiarNombre(valor);

      if (
        nombre.length >= 3 &&
        !nombre.includes("SIN DATOS")
      ) {
        return nombre;
      }
    }

    /*
      Respaldo: buscar el nombre dentro
      de la ficha consolidada.
    */

    const ficha = $("#fichaConsolidada");

    if (ficha) {
      const elemento =
        ficha.querySelector(
          "[data-cliente-nombre]"
        );

      if (elemento) {
        return limpiarNombre(
          elemento.dataset.clienteNombre ||
          elemento.textContent
        );
      }
    }

    return "";
  }

  /*
    ----------------------------------------
    VERIFICAR CLIENTE CONSULTADO
    ----------------------------------------
  */

  function clienteConsultado() {
    const ficha = $("#fichaConsolidada");

    return Boolean(
      ficha &&
      !ficha.classList.contains("hidden")
    );
  }

  /*
    ----------------------------------------
    ESTADO VISUAL DEL BOTÓN
    ----------------------------------------
  */

  function estadoBoton(boton, cargando) {
    if (!boton) {
      return;
    }

    boton.disabled = cargando;

    boton.textContent = cargando
      ? "⏳ CONSULTANDO RePET..."
      : "📄 DESCARGAR RePET";
  }

  /*
    ----------------------------------------
    CONSULTAR RePET
    ----------------------------------------
  */

  function consultarRepet() {
    if (consultaEnCurso) {
      return;
    }

    if (!clienteConsultado()) {
      alert(
        "Primero consultá un cliente para realizar la búsqueda RePET."
      );

      return;
    }

    const nombre = obtenerNombreActual();

    if (!nombre) {
      alert(
        "No pude obtener el nombre completo del cliente desde la ficha."
      );

      console.warn(
        LOG,
        "No se encontró el nombre del cliente."
      );

      return;
    }

    const boton = $("#siRepetBtn");
    const requestId = generarRequestId();

    consultaEnCurso = true;
    estadoBoton(boton, true);

    console.info(
      LOG,
      "Iniciando consulta:",
      nombre
    );

    let terminado = false;
    let timeoutId = null;

    const finalizar = () => {
      if (terminado) {
        return false;
      }

      terminado = true;

      window.removeEventListener(
        "message",
        recibirRespuesta
      );

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      consultaEnCurso = false;
      estadoBoton(boton, false);

      return true;
    };

    /*
      Esperar únicamente la respuesta
      correspondiente a esta consulta.
    */

    const recibirRespuesta = event => {
      if (event.source !== window) {
        return;
      }

      const data = event.data;

      if (
        !data ||
        data.source !== SOURCE_BRIDGE ||
        data.type !== "RESPUESTA_REPET" ||
        data.requestId !== requestId
      ) {
        return;
      }

      if (!finalizar()) {
        return;
      }

      const resultado = data.resultado || {};

      console.info(
        LOG,
        "Respuesta RePET:",
        resultado
      );

      if (resultado.ok) {
        /*
          repet_bridge.js abre automáticamente
          la impresión de la página oficial.

          No mostramos un alert de éxito
          porque podría interrumpir el
          cuadro de impresión de Edge.
        */

        return;
      }

      alert(
        "No se pudo completar la consulta RePET.\n\n" +
        String(
          resultado.message ||
          resultado.code ||
          "Error desconocido."
        )
      );
    };

    window.addEventListener(
      "message",
      recibirRespuesta
    );

    /*
      Timeout de seguridad.
    */

    timeoutId = setTimeout(() => {
      if (!finalizar()) {
        return;
      }

      alert(
        "La consulta RePET tardó más de lo esperado. Revisá la pestaña de RePET."
      );
    }, 30000);

    /*
      Enviar solicitud a la extensión.
    */

    window.postMessage(
      {
        source: SOURCE_APP,
        type: "CONSULTAR_REPET",
        requestId,
        payload: {
          nombre
        }
      },
      "*"
    );
  }

  /*
    ----------------------------------------
    ESTILOS DEL BOTÓN
    ----------------------------------------
  */

  function asegurarEstilos() {
    if ($("#si-repet-boton-style")) {
      return;
    }

    const style =
      document.createElement("style");

    style.id = "si-repet-boton-style";

    style.textContent = `
      #siRepetBtn {
        min-height: 42px;
        border: 0;
        border-radius: 10px;
        background: #17231d;
        color: #ffffff;
        padding: 10px 18px;
        font: inherit;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
        white-space: nowrap;
        box-shadow:
          0 2px 8px rgba(23,35,29,.14);
      }

      #siRepetBtn:hover:not(:disabled) {
        background: #0d633b;
      }

      #siRepetBtn:disabled {
        opacity: .65;
        cursor: wait;
      }

      @media (max-width: 620px) {
        #siRepetBtn {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /*
    ----------------------------------------
    CREAR BOTÓN

    Orden esperado:

    PDF CLIENTE | UIF | RePET       PDF JUAN
    ----------------------------------------
  */

  function asegurarBoton() {
    if ($("#siRepetBtn")) {
      return true;
    }

    const grupoIzquierdo =
      $("#siPdfClienteUifGrupo");

    const botonUif =
      $("#siUifBtn");

    if (
      !grupoIzquierdo ||
      !botonUif
    ) {
      return false;
    }

    const boton =
      document.createElement("button");

    boton.id = "siRepetBtn";
    boton.type = "button";
    boton.textContent =
      "📄 DESCARGAR RePET";

    boton.addEventListener(
      "click",
      consultarRepet
    );

    /*
      Insertar inmediatamente
      después del botón UIF.
    */

    botonUif.insertAdjacentElement(
      "afterend",
      boton
    );

    console.info(
      LOG,
      "Botón RePET agregado."
    );

    return true;
  }

  /*
    ----------------------------------------
    INICIAR
    ----------------------------------------
  */

  function iniciar() {
    asegurarEstilos();

    if (asegurarBoton()) {
      return;
    }

    /*
      Esperamos a que uif_boton.js
      termine de crear el grupo.
    */

    const observer =
      new MutationObserver(() => {
        if (asegurarBoton()) {
          observer.disconnect();
        }
      });

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  iniciar();

  console.info(
    LOG,
    "RePET Botón V1 activo."
  );
})();