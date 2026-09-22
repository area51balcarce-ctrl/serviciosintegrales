/*
  SERVICIOS INTEGRALES - BOTÓN UIF V1

  Nombre del archivo:
  uif_boton.js

  FUNCIÓN:
  - Agrega el botón "DESCARGAR UIF".
  - Lo coloca inmediatamente al lado del botón
    "DESCARGAR PDF PARA CLIENTE".
  - Toma automáticamente el CUIL del cliente
    actualmente consultado.
  - Envía la consulta al bridge UIF de la extensión.
  - Espera la respuesta de UIF.

  IMPORTANTE:
  - NO modifica resumen_cliente.js.
  - NO modifica resumen_juan.js.
  - NO modifica renovacion.js.
  - NO modifica Creditan.
  - NO genera todavía la impresión/PDF.
  - Esta V1 sirve para probar el circuito completo
    Servicios Integrales -> Extensión -> UIF.
*/

(() => {
  "use strict";

  const SOURCE_APP =
    "SERVICIOS_INTEGRALES";

  const SOURCE_BRIDGE =
    "SERVICIOS_INTEGRALES_UIF_BRIDGE";

  const PREFIJO_LOG =
    "[SERVICIOS INTEGRALES][BOTÓN UIF]";

  let consultaEnCurso = false;

  /*
    --------------------------------------------------
    UTILIDADES
    --------------------------------------------------
  */

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function limpiarCuil(valor) {
    return String(valor || "")
      .replace(/\D/g, "")
      .trim();
  }

  function generarRequestId() {
    return (
      "UIF_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 10)
    );
  }

  /*
    --------------------------------------------------
    OBTENER CUIL ACTUAL

    Primero usamos la ficha consolidada porque
    corresponde al cliente que ya fue consultado.

    Como respaldo usamos el campo principal.
    --------------------------------------------------
  */

  function obtenerCuilActual() {
    const ficha =
      $("#fichaCuil");

    if (ficha) {
      const cuilFicha =
        limpiarCuil(
          ficha.textContent
        );

      if (cuilFicha.length === 11) {
        return cuilFicha;
      }
    }

    const input =
      $("#cuilInput");

    if (input) {
      const cuilInput =
        limpiarCuil(
          input.value
        );

      if (cuilInput.length === 11) {
        return cuilInput;
      }
    }

    return "";
  }

  /*
    --------------------------------------------------
    COMPROBAR QUE HAY CLIENTE CONSULTADO
    --------------------------------------------------
  */

  function clienteConsultado() {
    const ficha =
      $("#fichaConsolidada");

    if (!ficha) {
      return false;
    }

    return !ficha.classList.contains(
      "hidden"
    );
  }

  /*
    --------------------------------------------------
    CAMBIAR ESTADO VISUAL DEL BOTÓN
    --------------------------------------------------
  */

  function estadoBoton(
    boton,
    cargando
  ) {
    if (!boton) {
      return;
    }

    if (cargando) {
      boton.disabled = true;

      boton.textContent =
        "⏳ CONSULTANDO UIF...";

      return;
    }

    boton.disabled = false;

    boton.textContent =
      "📄 DESCARGAR UIF";
  }

  /*
    --------------------------------------------------
    CONSULTAR UIF

    En esta primera prueba:

    1) toma el CUIL
    2) envía CONSULTAR_UIF
    3) la extensión abre/busca UIF
    4) carga el CUIL
    5) pulsa Buscar
    6) espera el resultado
    7) vuelve acá

    TODAVÍA no ejecutamos impresión.
    Primero comprobamos que este circuito
    funcione perfectamente.
    --------------------------------------------------
  */

  function consultarUif() {
    if (consultaEnCurso) {
      return;
    }

    if (!clienteConsultado()) {
      alert(
        "Primero consultá un cliente para realizar la consulta UIF."
      );

      return;
    }

    const cuil =
      obtenerCuilActual();

    if (cuil.length !== 11) {
      alert(
        "No pude obtener correctamente el CUIL del cliente."
      );

      return;
    }

    const boton =
      $("#siUifBtn");

    const requestId =
      generarRequestId();

    consultaEnCurso = true;

    estadoBoton(
      boton,
      true
    );

    console.info(
      PREFIJO_LOG,
      "Iniciando consulta UIF:",
      cuil
    );

    /*
      ------------------------------------------------
      ESCUCHAR LA RESPUESTA CORRESPONDIENTE
      A ESTA CONSULTA
      ------------------------------------------------
    */

    const listenerRespuesta =
      (event) => {
        if (
          event.source !== window
        ) {
          return;
        }

        const data =
          event.data;

        if (
          !data ||
          data.source !== SOURCE_BRIDGE
        ) {
          return;
        }

        if (
          data.type !==
          "RESPUESTA_UIF"
        ) {
          return;
        }

        if (
          data.requestId !==
          requestId
        ) {
          return;
        }

        /*
          Ya recibimos la respuesta correcta.
        */

        window.removeEventListener(
          "message",
          listenerRespuesta
        );

        consultaEnCurso = false;

        estadoBoton(
          boton,
          false
        );

        const resultado =
          data.resultado || {};

        console.info(
          PREFIJO_LOG,
          "Respuesta recibida:",
          resultado
        );

        /*
          ------------------------------------------------
          RESULTADO CORRECTO

          En esta V1 solamente confirmamos
          que todo el recorrido funcionó.

          En el próximo paso reemplazaremos
          este alert por la impresión real
          de la página UIF.
          ------------------------------------------------
        */

        if (resultado.ok) {
          alert(
            "Consulta UIF realizada correctamente.\n\n" +
            String(
              resultado.resultado ||
              "UIF devolvió el resultado."
            )
          );

          return;
        }

        /*
          Error devuelto por alguno de los
          módulos UIF.
        */

        alert(
          "No se pudo completar la consulta UIF.\n\n" +
          String(
            resultado.message ||
            resultado.code ||
            "Error desconocido."
          )
        );
      };

    window.addEventListener(
      "message",
      listenerRespuesta
    );

    /*
      ------------------------------------------------
      TIMEOUT DE SEGURIDAD

      Si por cualquier motivo no vuelve una
      respuesta, liberamos el botón después
      de 25 segundos.
      ------------------------------------------------
    */

    const timeout =
      setTimeout(() => {
        if (!consultaEnCurso) {
          return;
        }

        window.removeEventListener(
          "message",
          listenerRespuesta
        );

        consultaEnCurso = false;

        estadoBoton(
          boton,
          false
        );

        alert(
          "La consulta UIF tardó más de lo esperado. Revisá la pestaña de UIF."
        );
      }, 25000);

    /*
      Cuando llega la respuesta, hacemos que
      este timeout ya no produzca ningún efecto.

      consultaEnCurso queda en false.
    */

    void timeout;

    /*
      ------------------------------------------------
      ENVIAR SOLICITUD AL BRIDGE DE LA EXTENSIÓN
      ------------------------------------------------
    */

    window.postMessage(
      {
        source:
          SOURCE_APP,

        type:
          "CONSULTAR_UIF",

        requestId,

        payload: {
          cuil
        }
      },
      "*"
    );
  }

  /*
    --------------------------------------------------
    ESTILOS DEL BOTÓN UIF
    --------------------------------------------------
  */

  function asegurarEstilos() {
    if (
      $("#si-uif-boton-style")
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "si-uif-boton-style";

    style.textContent = `

      /*
        El botón UIF utiliza el mismo lenguaje
        visual que el botón PDF Cliente.
      */

      #siUifBtn{
        min-height:42px;
        border:0;
        border-radius:10px;
        background:#17231d;
        color:#ffffff;
        padding:10px 18px;
        font:inherit;
        font-size:12px;
        font-weight:900;
        cursor:pointer;
        box-shadow:
          0 2px 8px
          rgba(23,35,29,.14);
        white-space:nowrap;
      }

      #siUifBtn:hover:not(:disabled){
        background:#0d633b;
      }

      #siUifBtn:disabled{
        opacity:.65;
        cursor:wait;
      }

      /*
        Agrupamos CLIENTE + UIF a la izquierda.

        Juan continúa a la derecha.

        No modificamos los botones existentes.
      */

      #siPdfClienteUifGrupo{
        display:flex;
        align-items:center;
        gap:10px;
      }

      @media (max-width:620px){

        #siPdfClienteUifGrupo{
          width:100%;
          flex-direction:column;
          align-items:stretch;
        }

        #siPdfClienteUifGrupo
        #siResumenClienteBtn,
        #siPdfClienteUifGrupo
        #siUifBtn{
          width:100%;
        }

      }

    `;

    document.head.appendChild(
      style
    );
  }

  /*
    --------------------------------------------------
    CREAR BOTÓN UIF

    Estructura final:

    #siPdfBotonesWrap

      #siPdfClienteUifGrupo
        [PDF CLIENTE]
        [UIF]

      #siResumenJuanWrap
        [PDF JUAN]

    --------------------------------------------------
  */

  function asegurarBoton() {
    /*
      Si ya existe, no hacemos nada.
    */

    if ($("#siUifBtn")) {
      return true;
    }

    const wrapGeneral =
      $("#siPdfBotonesWrap");

    const botonCliente =
      $("#siResumenClienteBtn");

    /*
      resumen_cliente.js todavía no terminó
      de construir los botones.
    */

    if (
      !wrapGeneral ||
      !botonCliente
    ) {
      return false;
    }

    /*
      Creamos el grupo izquierdo.
    */

    let grupo =
      $("#siPdfClienteUifGrupo");

    if (!grupo) {
      grupo =
        document.createElement(
          "div"
        );

      grupo.id =
        "siPdfClienteUifGrupo";

      /*
        Insertamos el grupo exactamente donde
        se encuentra actualmente el botón Cliente.
      */

      wrapGeneral.insertBefore(
        grupo,
        botonCliente
      );

      /*
        Movemos PDF CLIENTE adentro.

        El botón conserva exactamente
        su listener y funcionamiento.
      */

      grupo.appendChild(
        botonCliente
      );
    }

    /*
      Crear botón UIF.
    */

    const botonUif =
      document.createElement(
        "button"
      );

    botonUif.id =
      "siUifBtn";

    botonUif.type =
      "button";

    botonUif.textContent =
      "📄 DESCARGAR UIF";

    botonUif.addEventListener(
      "click",
      consultarUif
    );

    /*
      Queda inmediatamente después
      de PDF CLIENTE.
    */

    grupo.appendChild(
      botonUif
    );

    console.info(
      PREFIJO_LOG,
      "Botón UIF agregado."
    );

    return true;
  }

  /*
    --------------------------------------------------
    INICIAR
    --------------------------------------------------
  */

  function iniciar() {
    asegurarEstilos();

    /*
      Intentamos inmediatamente.
    */

    if (asegurarBoton()) {
      return;
    }

    /*
      Si resumen_cliente.js todavía no creó
      su botón, esperamos sin modificarlo.
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
    PREFIJO_LOG,
    "UIF Botón V1 activo."
  );
})();