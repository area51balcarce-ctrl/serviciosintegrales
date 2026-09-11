/*
  SERVICIOS INTEGRALES - HISTORIAL POR CUIL V1

  Muestra el historial interno guardado en Supabase para el CUIL
  actualmente consultado.

  IMPORTANTE:
  - NO modifica app.js.
  - NO modifica ficha.js.
  - NO modifica gestion.js.
  - NO modifica cupo.js.
  - NO modifica connector.js.
  - NO modifica Creditan.
*/

(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);

  const ficha = $("#fichaConsolidada");
  const clientCard = $("#clientCard");

  if (!ficha || !clientCard) {
    console.warn("[SERVICIOS INTEGRALES] Historial: no se encontró la ficha.");
    return;
  }

  let auth = null;
  let timer = null;
  let consultaActual = "";

  const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function esperarAuth() {
    for (let i = 0; i < 100; i++) {
      const actual = window.ServiciosIntegralesAuth;
      if (actual?.supabase && actual?.perfil) {
        return actual;
      }
      await esperar(100);
    }
    return null;
  }

  function soloDigitos(valor) {
    return String(valor || "").replace(/\D/g, "");
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

  function formatoDinero(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return "$ 0,00";

    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);
  }

  function asegurarEstilos() {
    if ($("#si-historial-style")) return;

    const style = document.createElement("style");
    style.id = "si-historial-style";
    style.textContent = `
      .si-historial{
        margin-top:18px;
        padding-top:16px;
        border-top:1px solid rgba(16,92,53,.14);
      }
      .si-historial-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        margin-bottom:12px;
      }
      .si-historial-title{
        margin:0 0 4px;
        color:#0d633b;
        font-size:14px;
        font-weight:900;
      }
      .si-historial-help{
        margin:0;
        color:#617069;
        font-size:12px;
        line-height:1.45;
      }
      .si-historial-count{
        flex:none;
        border-radius:999px;
        padding:6px 9px;
        background:#edf8f2;
        color:#0d633b;
        font-size:11px;
        font-weight:900;
      }
      .si-historial-list{
        display:grid;
        gap:10px;
      }
      .si-historial-empty{
        border:1px dashed #cfe3d7;
        border-radius:12px;
        padding:14px;
        background:#fbfefc;
        color:#617069;
        font-size:12px;
        line-height:1.45;
      }
      .si-historial-item{
        border:1px solid #dbe9e1;
        border-radius:13px;
        padding:13px 14px;
        background:#fff;
      }
      .si-historial-item.aprobado{
        border-color:#b8ddc6;
        background:#f5fbf7;
      }
      .si-historial-item.rechazado{
        border-color:#efc0bc;
        background:#fff8f7;
      }
      .si-historial-item.pendiente{
        border-color:#ead99e;
        background:#fffaf0;
      }
      .si-historial-item-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        margin-bottom:9px;
      }
      .si-historial-estado{
        display:inline-flex;
        align-items:center;
        gap:5px;
        font-size:12px;
        font-weight:900;
      }
      .si-historial-item.aprobado .si-historial-estado{color:#0d633b}
      .si-historial-item.rechazado .si-historial-estado{color:#b42318}
      .si-historial-item.pendiente .si-historial-estado{color:#795600}
      .si-historial-fecha{
        color:#6b7770;
        font-size:11px;
        text-align:right;
      }
      .si-historial-meta{
        display:flex;
        flex-wrap:wrap;
        gap:6px 14px;
        margin-bottom:9px;
        color:#4d5d54;
        font-size:11px;
        line-height:1.45;
      }
      .si-historial-meta strong{
        color:#17231d;
      }
      .si-historial-texto{
        margin-top:7px;
        border-radius:9px;
        padding:9px 10px;
        background:rgba(255,255,255,.72);
        border:1px solid rgba(16,92,53,.08);
        font-size:12px;
        line-height:1.45;
        white-space:pre-wrap;
        overflow-wrap:anywhere;
      }
      .si-historial-texto strong{
        color:#0d633b;
      }
      .si-historial-item.rechazado .si-historial-texto.respuesta strong{
        color:#b42318;
      }
      .si-historial-resumen{
        display:flex;
        flex-wrap:wrap;
        gap:6px 14px;
        margin-top:9px;
        padding-top:9px;
        border-top:1px solid rgba(16,92,53,.08);
        color:#516159;
        font-size:11px;
      }
      .si-historial-loading{
        color:#617069;
        font-size:12px;
        padding:6px 0;
      }
    `;
    document.head.appendChild(style);
  }

  function asegurarBloque() {
    let bloque = $("#siHistorialBloque");
    if (bloque) return bloque;

    bloque = document.createElement("section");
    bloque.id = "siHistorialBloque";
    bloque.className = "si-historial";
    bloque.innerHTML = `
      <div class="si-historial-head">
        <div>
          <div class="si-historial-title">HISTORIAL INTERNO DEL CLIENTE</div>
          <p class="si-historial-help">
            Casos guardados anteriormente para este CUIL.
          </p>
        </div>
        <span id="siHistorialCount" class="si-historial-count">0 registros</span>
      </div>
      <div id="siHistorialList" class="si-historial-list">
        <div class="si-historial-empty">
          Consultá un cliente para ver su historial interno.
        </div>
      </div>
    `;

    const gestion = $("#siGestionBloque");
    if (gestion) {
      gestion.insertAdjacentElement("afterend", bloque);
    } else {
      ficha.appendChild(bloque);
    }

    return bloque;
  }

  function estadoInfo(estado) {
    if (estado === "APROBADO") {
      return {
        clase: "aprobado",
        texto: "🟢 APROBADO"
      };
    }

    if (estado === "RECHAZADO") {
      return {
        clase: "rechazado",
        texto: "🔴 RECHAZADO"
      };
    }

    return {
      clase: "pendiente",
      texto: "🟡 EN REVISIÓN"
    };
  }

  function crearTexto(clase, etiqueta, contenido) {
    const box = document.createElement("div");
    box.className = `si-historial-texto ${clase || ""}`.trim();

    const strong = document.createElement("strong");
    strong.textContent = etiqueta;

    const span = document.createElement("span");
    span.textContent = contenido || "Sin observaciones.";

    box.appendChild(strong);
    box.append(" ");
    box.appendChild(span);

    return box;
  }

  function renderizar(casos, usuarios) {
    const list = $("#siHistorialList");
    const count = $("#siHistorialCount");
    if (!list || !count) return;

    list.textContent = "";

    const cantidad = casos.length;
    count.textContent = `${cantidad} ${cantidad === 1 ? "registro" : "registros"}`;

    if (!cantidad) {
      const vacio = document.createElement("div");
      vacio.className = "si-historial-empty";
      vacio.textContent =
        "Este cliente todavía no tiene casos guardados en el historial.";
      list.appendChild(vacio);
      return;
    }

    for (const caso of casos) {
      const info = estadoInfo(caso.estado);
      const creador = usuarios.get(caso.creado_por) || "Usuario interno";
      const resolutor = usuarios.get(caso.resuelto_por) || "Juan";

      const item = document.createElement("article");
      item.className = `si-historial-item ${info.clase}`;

      const head = document.createElement("div");
      head.className = "si-historial-item-head";

      const estado = document.createElement("div");
      estado.className = "si-historial-estado";
      estado.textContent = info.texto;

      const fecha = document.createElement("div");
      fecha.className = "si-historial-fecha";
      fecha.textContent =
        caso.estado === "EN_REVISION"
          ? `Enviado: ${fechaHora(caso.enviado_revision_at)}`
          : `Resuelto: ${fechaHora(caso.resuelto_at)}`;

      head.appendChild(estado);
      head.appendChild(fecha);
      item.appendChild(head);

      const meta = document.createElement("div");
      meta.className = "si-historial-meta";

      const organismo = document.createElement("span");
      organismo.innerHTML = "<strong>Organismo:</strong> ";
      organismo.append(String(caso.organismo || "—"));

      const enviado = document.createElement("span");
      enviado.innerHTML = "<strong>Enviado por:</strong> ";
      enviado.append(creador);

      meta.appendChild(organismo);
      meta.appendChild(enviado);

      if (caso.estado !== "EN_REVISION") {
        const resuelto = document.createElement("span");
        resuelto.innerHTML = "<strong>Resuelto por:</strong> ";
        resuelto.append(resolutor);
        meta.appendChild(resuelto);
      }

      item.appendChild(meta);

      item.appendChild(
        crearTexto(
          "",
          `Observación de ${creador}:`,
          String(caso.observaciones || "").trim() || "Sin observaciones."
        )
      );

      if (caso.estado !== "EN_REVISION") {
        item.appendChild(
          crearTexto(
            "respuesta",
            `Respuesta de ${resolutor}:`,
            String(caso.respuesta_resolucion || "").trim() ||
              "Sin observaciones."
          )
        );
      }

      const resumen = document.createElement("div");
      resumen.className = "si-historial-resumen";

      const cupo = document.createElement("span");
      cupo.textContent = `Cupo enviado: ${formatoDinero(caso.cupo_calculado)}`;

      const creditos = document.createElement("span");
      creditos.textContent =
        `Créditos: ${Number(caso.creditos_vigentes || 0)}`;

      const cuotas = document.createElement("span");
      cuotas.textContent =
        `Cuota total: ${formatoDinero(caso.total_cuotas)}`;

      const saldo = document.createElement("span");
      saldo.textContent =
        `Saldo: ${formatoDinero(caso.saldo_total)}`;

      resumen.appendChild(cupo);
      resumen.appendChild(creditos);
      resumen.appendChild(cuotas);
      resumen.appendChild(saldo);

      item.appendChild(resumen);
      list.appendChild(item);
    }
  }

  async function cargarHistorial() {
    if (!auth) return;
    if (clientCard.classList.contains("hidden")) return;

    asegurarBloque();

    const cuil = soloDigitos(texto("#fichaCuil", ""));
    if (cuil.length !== 11) return;

    const key = cuil;
    consultaActual = key;

    const list = $("#siHistorialList");
    if (list && !list.children.length) {
      const loading = document.createElement("div");
      loading.className = "si-historial-loading";
      loading.textContent = "Cargando historial...";
      list.appendChild(loading);
    }

    try {
      const { data: casos, error } = await auth.supabase
        .from("casos")
        .select(
          "id,cuil,organismo,estado,creado_por,resuelto_por,observaciones,respuesta_resolucion,enviado_revision_at,resuelto_at,created_at,cupo_calculado,creditos_vigentes,total_cuotas,saldo_total"
        )
        .eq("cuil", cuil)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (consultaActual !== key) return;

      const { data: usuariosData, error: usuariosError } =
        await auth.supabase
          .from("usuarios")
          .select("id,nombre")
          .eq("activo", true);

      if (usuariosError) throw usuariosError;
      if (consultaActual !== key) return;

      const usuarios = new Map(
        (usuariosData || []).map((usuario) => [
          usuario.id,
          usuario.nombre
        ])
      );

      renderizar(casos || [], usuarios);
    } catch (error) {
      console.error(
        "[SERVICIOS INTEGRALES] No se pudo cargar el historial:",
        error
      );

      if (list) {
        list.textContent = "";
        const aviso = document.createElement("div");
        aviso.className = "si-historial-empty";
        aviso.textContent =
          "No se pudo consultar el historial interno en este momento.";
        list.appendChild(aviso);
      }
    }
  }

  function programarCarga() {
    clearTimeout(timer);
    timer = setTimeout(cargarHistorial, 350);
  }

  async function iniciar() {
    asegurarEstilos();
    asegurarBloque();

    auth = await esperarAuth();

    if (!auth) {
      console.warn(
        "[SERVICIOS INTEGRALES] Historial: no se pudo identificar el usuario."
      );
      return;
    }

    /*
      Cuando cambia la ficha o Creditan termina de renderizar un cliente,
      actualizamos el historial correspondiente al CUIL.
    */
    const observerCliente = new MutationObserver(programarCarga);
    observerCliente.observe(clientCard, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true
    });

    /*
      Gestión V2 ya consulta a Supabase periódicamente. Cuando ese bloque
      cambia porque Juan aprobó/rechazó o se envió un nuevo caso,
      actualizamos el historial sin agregar otra recarga de página.
    */
    const gestion = $("#siGestionBloque");
    if (gestion) {
      const observerGestion = new MutationObserver(programarCarga);
      observerGestion.observe(gestion, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["class", "disabled"]
      });
    }

    if (!clientCard.classList.contains("hidden")) {
      programarCarga();
    }

    console.info(
      "[SERVICIOS INTEGRALES] Historial por CUIL V1 activo."
    );
  }

  iniciar();
})();
