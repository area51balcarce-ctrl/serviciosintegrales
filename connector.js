window.ServiciosIntegralesConnector = {
  async consultarEstadoCuenta({ cuil, organismo }) {
    return {
      ok: false,
      code: "CONECTOR_PENDIENTE",
      message: "La V1 está lista. Falta conectar este único módulo con Creditan para traer el estado de cuenta real automáticamente.",
      request: { cuil, organismo }
    };
  }
};
