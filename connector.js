(() => {
  "use strict";

  const SOURCE_APP = "SERVICIOS_INTEGRALES";
  const SOURCE_BRIDGE = "SERVICIOS_INTEGRALES_CREDITAN_BRIDGE";
  const DEFAULT_TIMEOUT_MS = 30000;

  function crearId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `si-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function limpiarCuil(cuil) {
    return String(cuil || "").replace(/\D/g, "");
  }

  function validarCuil(cuil) {
    const limpio = limpiarCuil(cuil);
    return limpio.length === 11;
  }

  function normalizarOrganismo(organismo) {
    return String(organismo || "").trim().toUpperCase();
  }

  function consultarBridge(payload, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return new Promise((resolve) => {
      const requestId = crearId();
      let terminado = false;

      const finalizar = (resultado) => {
        if (terminado) return;
        terminado = true;
        window.removeEventListener("message", onMessage);
        clearTimeout(timer);
        resolve(resultado);
      };

      const onMessage = (event) => {
        if (event.source !== window) return;

        const data = event.data;
        if (!data || data.source !== SOURCE_BRIDGE) return;
        if (data.requestId !== requestId) return;
        if (data.type !== "RESPUESTA_ESTADO_CUENTA") return;

        finalizar(data.resultado || {
          ok: false,
          code: "RESPUESTA_INVALIDA",
          message: "El conector de Creditan respondió sin datos válidos."
        });
      };

      window.addEventListener("message", onMessage);

      const timer = setTimeout(() => {
        finalizar({
          ok: false,
          code: "BRIDGE_NO_DISPONIBLE",
          message: "No se detectó el puente de Creditan. Abrí Creditan con tu sesión iniciada y verificá que el conector del navegador esté activo."
        });
      }, timeoutMs);

      window.postMessage({
        source: SOURCE_APP,
        type: "CONSULTAR_ESTADO_CUENTA",
        requestId,
        payload
      }, "*");
    });
  }

  function normalizarResultado(resultado, request) {
    if (!resultado || typeof resultado !== "object") {
      return {
        ok: false,
        code: "RESPUESTA_INVALIDA",
        message: "Creditan devolvió una respuesta que no se pudo interpretar.",
        request
      };
    }

    if (!resultado.ok) {
      return {
        ...resultado,
        request
      };
    }

    const operaciones = Array.isArray(resultado.operaciones)
      ? resultado.operaciones
      : [];

    const saldoCapitalTotal = operaciones.reduce((acc, op) => {
      const valor = Number(op?.saldoCapital ?? 0);
      return acc + (Number.isFinite(valor) ? valor : 0);
    }, 0);

    const cuotaMensualTotal = operaciones.reduce((acc, op) => {
      const valor = Number(op?.cuota ?? 0);
      return acc + (Number.isFinite(valor) ? valor : 0);
    }, 0);

    return {
      ok: true,
      cliente: resultado.cliente || null,
      organismo: resultado.organismo || request.organismo,
      operaciones,
      cantidadOperaciones: operaciones.length,
      cuotaMensualTotal,
      saldoCapitalTotal,
      fechaConsulta: resultado.fechaConsulta || new Date().toISOString(),
      request
    };
  }

  window.ServiciosIntegralesConnector = {
    version: "2.0.0",

    async consultarEstadoCuenta({ cuil, organismo }) {
      const cuilLimpio = limpiarCuil(cuil);
      const organismoNormalizado = normalizarOrganismo(organismo);

      const request = {
        cuil: cuilLimpio,
        organismo: organismoNormalizado
      };

      if (!validarCuil(cuilLimpio)) {
        return {
          ok: false,
          code: "CUIL_INVALIDO",
          message: "Ingresá un CUIL válido de 11 dígitos.",
          request
        };
      }

      if (!organismoNormalizado) {
        return {
          ok: false,
          code: "ORGANISMO_INVALIDO",
          message: "Seleccioná un organismo.",
          request
        };
      }

      try {
        const resultado = await consultarBridge(request);
        return normalizarResultado(resultado, request);
      } catch (error) {
        console.error("[Servicios Integrales] Error del conector:", error);

        return {
          ok: false,
          code: "ERROR_CONECTOR",
          message: "No se pudo consultar Creditan.",
          detail: error instanceof Error ? error.message : String(error),
          request
        };
      }
    }
  };
})();
