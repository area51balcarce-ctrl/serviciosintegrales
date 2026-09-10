/*
  SERVICIOS INTEGRALES - GESTIÓN V1
  Envío de fichas a revisión de Juan.

  IMPORTANTE:
  - NO modifica app.js.
  - NO modifica ficha.js.
  - NO modifica cupo.js.
  - NO modifica connector.js.
  - NO modifica Creditan.
  - Lee únicamente la ficha y el Estado de Cuenta YA renderizados.
*/

(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const ficha = $("#fichaConsolidada");
  const clientCard = $("#clientCard");

  if (!ficha || !clientCard) {
    console.warn("[SERVICIOS INTEGRALES] Gestión: no se encontró la ficha.");
    return;
  }

  let auth = null;
  let consultaTimer = null;
  let consultaActual = "";
  let casoPendienteActual = null;

  const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function esperarAuth() {
    for (let i = 0; i < 100; i++) {
      const actual = window.ServiciosIntegralesAuth;
      if (actual?.supabase && actual?.perfil && actual?.user) {
        return actual;
      }
      await esperar(100);
    }
    return null;
  }

  function soloDigitos(valor) {
    return String(valor || "").replace(/\D/g, "");
  }

  function numeroAR(valor) {
    if (typeof valor === "number") {
      return Number.isFinite(valor) ? valor : 0;
    }

    let s = String(valor ?? "")
      .replace(/\s/g, "")
      .replace(/\$/g, "")
      .trim();

    if (!s) return 0;

    if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
      const n = Number(s.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    }

    if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(s)) {
      const n = Number(s.replace(/,/g, ""));
      return Number.isFinite(n) ? n : 0;
    }

    const n = Number(s.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function texto(selector, fallback = "—", root = document) {
    const el = $(selector, root);
    const valor = String(el?.textContent || "").trim();
    return valor || fallback;
  }

  function fechaHora(valor) {
    if (!valor) return "—";

    try {
      return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short"
      }).format(new Date(valor));
    } catch (_) {
      return String(valor);
    }
  }

  function asegurarEstilos() {
    if ($("#si-gestion-style")) return;

    const style = document.createElement("style");
    style.id = "si-gestion-style";
    style.textContent = `
      .si-gestion{
        margin-top:18px;
        padding-top:16px;
        border-top:1px solid rgba(16,92,53,.14);
      }
      .si-gestion-title{
        margin:0 0 4px;
        color:#0d633b;
        font-size:14px;
        font-weight:900;
      }
      .si-gestion-help{
        margin:0 0 12px;
        color:#617069;
        font-size:12px;
        line-height:1.45;
      }
      .si-gestion-btn{
        width:100%;
        min-height:46px;
        border:0;
        border-radius:12px;
        padding:11px 14px;
        background:#e5a50a;
        color:#17231d;
        font:inherit;
        font-weight:900;
        cursor:pointer;
      }
      .si-gestion-btn:hover{
        filter:brightness(.98);
      }
      .si-gestion-btn:disabled{
        opacity:.65;
        cursor:not-allowed;
      }
      .si-gestion-status{
        margin-top:12px;
        border-radius:12px;
        padding:13px 14px;
        background:#fff8df;
        border:1px solid #efd98f;
      }
      .si-gestion-status.hidden{
        display:none;
      }
      .si-gestion-status strong{
        display:block;
        margin-bottom:4px;
        color:#795600;
        font-size:14px;
      }
      .si-gestion-status span{
        display:block;
        color:#665a34;
        font-size:12px;
        line-height:1.45;
      }
      .si-gestion-message{
        margin-top:10px;
        border-radius:10px;
        padding:10px 12px;
        background:#edf8f2;
        color:#0d633b;
        font-size:12px;
        line-height:1.45;
      }
      .si-gestion-message.error{
        background:#fff1f0;
        color:#b42318;
      }
      .si-gestion-message.hidden{
        display:none;
      }
      .si-gestion-admin{
        margin-top:10px;
        border-radius:12px;
        padding:12px 14px;
        background:#edf8f2;
        color:#0d633b;
        font-size:12px;
        line-height:1.45;
        font-weight:700;
      }
    `;
    document.head.appendChild(style);
  }

  function asegurarBloque() {
    let bloque = $("#siGestionBloque");

    if (bloque) return bloque;

    bloque = document.createElement("section");
    bloque.id = "siGestionBloque";
    bloque.className = "si-gestion";
    bloque.innerHTML = `
      <div class="si-gestion-title">ESTADO DE GESTIÓN</div>
      <p class="si-gestion-help"></p>
      <button id="siEnviarRevisionBtn" class="si-gestion-btn" type="button">
        🟡 ENVIAR A REVISIÓN DE JUAN
      </button>
      <div id="siGestionAdmin" class="si-gestion-admin" hidden>
        Modo administrador. Los casos pendientes de revisión se mostrarán en el panel de Juan.
      </div>
      <div id="siGestionEstado" class="si-gestion-status hidden" aria-live="polite">
        <strong></strong>
        <span class="si-gestion-quien"></span>
        <span class="si-gestion-fecha"></span>
      </div>
      <div id="siGestionMensaje" class="si-gestion-message hidden" aria-live="polite"></div>
    `;

    const observaciones = $("#fichaObservacionesBloque");
    if (observaciones) {
      observaciones.insertAdjacentElement("afterend", bloque);
    } else {
      ficha.appendChild(bloque);
    }

    const btn = $("#siEnviarRevisionBtn", bloque);
    btn?.addEventListener("click", enviarRevision);

    return bloque;
  }

  function configurarPorRol() {
    const bloque = asegurarBloque();
    const btn = $("#siEnviarRevisionBtn", bloque);
    const admin = $("#siGestionAdmin", bloque);
    const help = $(".si-gestion-help", bloque);

    const esAsesor = auth?.perfil?.rol === "ASESOR";

    if (esAsesor) {
      if (btn) btn.hidden = false;
      if (admin) admin.hidden = true;
      if (help) {
        help.textContent =
          "Cuando el caso necesite autorización, enviá esta ficha completa a Juan.";
      }
    } else {
      if (btn) btn.hidden = true;
      if (admin) admin.hidden = false;
      if (help) {
        help.textContent =
          "Este bloque refleja el estado compartido del caso.";
      }
    }
  }

  function mensaje(textoMensaje, error = false) {
    const el = $("#siGestionMensaje");
    if (!el) return;

    el.textContent = textoMensaje;
    el.classList.remove("hidden", "error");

    if (error) {
      el.classList.add("error");
    }
  }

  function limpiarMensaje() {
    const el = $("#siGestionMensaje");
    if (!el) return;

    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove("error");
  }

  function mostrarPendiente(caso, nombreCreador) {
    const estado = $("#siGestionEstado");
    if (!estado) return;

    $("strong", estado).textContent = "🟡 EN REVISIÓN";
    $(".si-gestion-quien", estado).textContent =
      `Enviado por ${nombreCreador || "usuario interno"}`;
    $(".si-gestion-fecha", estado).textContent =
      fechaHora(caso?.enviado_revision_at);

    estado.classList.remove("hidden");

    const btn = $("#siEnviarRevisionBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "🟡 CASO YA EN REVISIÓN";
    }
  }

  function limpiarEstadoGestion() {
    casoPendienteActual = null;

    const estado = $("#siGestionEstado");
    estado?.classList.add("hidden");

    const btn = $("#siEnviarRevisionBtn");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🟡 ENVIAR A REVISIÓN DE JUAN";
    }

    limpiarMensaje();
  }

  function leerCuotaActual(tarjeta) {
    const fila = $('[data-field="cuotasTable"] tr.recommended', tarjeta);
    if (!fila) return 0;

    const primera = $("td", fila);
    const valor = Number(String(primera?.textContent || "").trim());

    return Number.isFinite(valor) ? valor : 0;
  }

  function leerOperaciones() {
    return $$("#creditsList .credit-card").map((tarjeta) => ({
      operacion: texto('[data-field="operacion"]', "—", tarjeta),
      solicitud: texto('[data-field="solicitud"]', "—", tarjeta),
      capital_original: numeroAR(
        texto('[data-field="capital"]', "0", tarjeta)
      ),
      valor_cuota: numeroAR(
        texto('[data-field="valorCuota"]', "0", tarjeta)
      ),
      cuotas_totales: Number(
        String(texto('[data-field="cuotas"]', "0", tarjeta)).replace(/\D/g, "")
      ) || 0,
      cuota_actual: leerCuotaActual(tarjeta),
      proximo_periodo: texto(
        '[data-field="proximoPeriodo"]',
        "—",
        tarjeta
      ),
      saldo_capital: numeroAR(
        texto('[data-field="saldoCapital"]', "0", tarjeta)
      )
    }));
  }

  function leerFichaParaGuardar() {
    const nombre = texto("#fichaNombre", "");
    const cuilFormateado = texto("#fichaCuil", "");
    const cuil = soloDigitos(cuilFormateado);
    const organismo = texto("#fichaOrganismo", "").toUpperCase();
    const cupoTexto = texto("#fichaCupo", "Pendiente");
    const observaciones = String(
      $("#fichaObservaciones")?.value || ""
    ).trim();

    const creditosVigentes =
      Number(String(texto("#fichaVigentes", "0")).replace(/\D/g, "")) || 0;

    const operaciones = leerOperaciones();

    if (!nombre || nombre === "—") {
      throw new Error("Primero consultá el Estado de Cuenta del cliente.");
    }

    if (cuil.length !== 11) {
      throw new Error("La ficha no tiene un CUIL válido.");
    }

    if (!["HOSPITAL", "MUNICIPALIDAD"].includes(organismo)) {
      throw new Error("La ficha no tiene un organismo válido.");
    }

    if (/pendiente/i.test(cupoTexto)) {
      throw new Error(
        "Calculá el cupo antes de enviar la ficha a revisión."
      );
    }

    if (!operaciones.length && creditosVigentes > 0) {
      throw new Error(
        "El detalle de créditos todavía no terminó de cargarse."
      );
    }

    return {
      nombre_apellido: nombre,
      cuil,
      organismo,
      cupo_calculado: numeroAR(cupoTexto),
      creditos_vigentes: creditosVigentes,
      total_cuotas: numeroAR(texto("#fichaCuotasTotal", "0")),
      saldo_total: numeroAR(texto("#fichaSaldoTotal", "0")),
      operaciones,
      observaciones: observaciones || null,
      estado: "EN_REVISION",
      creado_por: auth.perfil.id
    };
  }

  async function nombreUsuario(id) {
    if (!id) return "";

    if (id === auth?.perfil?.id) {
      return auth.perfil.nombre || "";
    }

    const { data } = await auth.supabase
      .from("usuarios")
      .select("nombre")
      .eq("id", id)
      .maybeSingle();

    return data?.nombre || "";
  }

  async function buscarPendiente(cuil, organismo) {
    const { data, error } = await auth.supabase
      .from("casos")
      .select("id,cuil,organismo,estado,creado_por,enviado_revision_at")
      .eq("cuil", cuil)
      .eq("organismo", organismo)
      .eq("estado", "EN_REVISION")
      .order("enviado_revision_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function refrescarEstado() {
    if (!auth) return;
    if (clientCard.classList.contains("hidden")) return;

    asegurarBloque();
    configurarPorRol();
    limpiarEstadoGestion();

    const cuil = soloDigitos(texto("#fichaCuil", ""));
    const organismo = texto("#fichaOrganismo", "").toUpperCase();

    if (cuil.length !== 11) return;
    if (!["HOSPITAL", "MUNICIPALIDAD"].includes(organismo)) return;

    const key = `${cuil}|${organismo}`;
    consultaActual = key;

    try {
      const pendiente = await buscarPendiente(cuil, organismo);

      /*
        Si mientras consultábamos cambió el cliente, ignoramos
        la respuesta vieja.
      */
      if (consultaActual !== key) return;

      if (!pendiente) return;

      casoPendienteActual = pendiente;
      const creador = await nombreUsuario(pendiente.creado_por);
      mostrarPendiente(pendiente, creador);
    } catch (error) {
      console.error(
        "[SERVICIOS INTEGRALES] No se pudo consultar el estado de gestión:",
        error
      );
      mensaje(
        "No se pudo consultar el estado compartido de este caso.",
        true
      );
    }
  }

  function programarRefresco() {
    clearTimeout(consultaTimer);
    consultaTimer = setTimeout(refrescarEstado, 250);
  }

  async function enviarRevision() {
    if (!auth || auth.perfil?.rol !== "ASESOR") return;

    limpiarMensaje();

    const btn = $("#siEnviarRevisionBtn");
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = "Enviando a revisión...";

    try {
      const payload = leerFichaParaGuardar();

      const yaExiste = await buscarPendiente(
        payload.cuil,
        payload.organismo
      );

      if (yaExiste) {
        casoPendienteActual = yaExiste;
        const creador = await nombreUsuario(yaExiste.creado_por);
        mostrarPendiente(yaExiste, creador);
        mensaje(
          "Este cliente ya tiene un caso pendiente de revisión. No se creó un duplicado."
        );
        return;
      }

      const { data, error } = await auth.supabase
        .from("casos")
        .insert(payload)
        .select(
          "id,cuil,organismo,estado,creado_por,enviado_revision_at"
        )
        .single();

      if (error) throw error;

      casoPendienteActual = data;
      mostrarPendiente(data, auth.perfil.nombre);

      mensaje(
        "Ficha enviada correctamente. Juan ya puede verla desde su cuenta."
      );

      console.info(
        "[SERVICIOS INTEGRALES] Caso enviado a revisión:",
        data.id
      );
    } catch (error) {
      console.error(
        "[SERVICIOS INTEGRALES] Error enviando caso:",
        error
      );

      /*
        El índice de Supabase impide dos casos EN_REVISION
        simultáneos para el mismo CUIL + organismo.
      */
      if (String(error?.code || "") === "23505") {
        mensaje(
          "Este cliente ya tiene un caso pendiente de revisión.",
          true
        );
        await refrescarEstado();
      } else {
        mensaje(
          error?.message ||
            "No se pudo enviar la ficha a revisión.",
          true
        );

        btn.disabled = false;
        btn.textContent = "🟡 ENVIAR A REVISIÓN DE JUAN";
      }
    }
  }

  async function iniciar() {
    asegurarEstilos();
    asegurarBloque();

    auth = await esperarAuth();

    if (!auth) {
      mensaje(
        "No se pudo identificar el usuario de SERVICIOS INTEGRALES.",
        true
      );
      return;
    }

    configurarPorRol();

    /*
      Cada vez que app.js termina una consulta y vuelve visible
      el Estado de Cuenta, revisamos si ya existe un caso pendiente.
    */
    const observer = new MutationObserver(programarRefresco);

    observer.observe(clientCard, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true
    });

    if (!clientCard.classList.contains("hidden")) {
      programarRefresco();
    }

    console.info(
      `[SERVICIOS INTEGRALES] Gestión V1 activa para ${auth.perfil.nombre} · ${auth.perfil.rol}.`
    );
  }

  iniciar();
})();
