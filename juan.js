import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://smxcqnahlklkqrxbbrjh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_am_ucuk2jAJPZRz-aaVJvA_72Z1h2du";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true
    }
  }
);

const $ = (s, root=document) => root.querySelector(s);

const casesList = $("#casesList");
const pendingCount = $("#pendingCount");
const emptyBox = $("#emptyBox");
const refreshBtn = $("#refreshBtn");
const logoutBtn = $("#logoutBtn");
const messageBox = $("#messageBox");

let perfil = null;
let user = null;
let refreshTimer = null;
let cargando = false;

const fmtMoney = new Intl.NumberFormat("es-AR",{
  style:"currency",
  currency:"ARS",
  minimumFractionDigits:2,
  maximumFractionDigits:2
});

function mostrarPagina(){
  document.documentElement.style.visibility = "visible";
}

function mensaje(texto,error=false){
  messageBox.textContent = texto;
  messageBox.classList.remove("hidden","error");
  if(error) messageBox.classList.add("error");
}

function limpiarMensaje(){
  messageBox.textContent = "";
  messageBox.classList.add("hidden");
  messageBox.classList.remove("error");
}

function formatCuil(valor){
  const d = String(valor||"").replace(/\D/g,"").slice(0,11);
  if(d.length !== 11) return valor || "—";
  return `${d.slice(0,2)}-${d.slice(2,10)}-${d.slice(10)}`;
}

function fechaHora(valor){
  if(!valor) return "—";
  return new Intl.DateTimeFormat("es-AR",{
    dateStyle:"short",
    timeStyle:"short"
  }).format(new Date(valor));
}

function escapeHtml(valor){
  return String(valor ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function validarAdmin(){
  const {data:userData,error:userError} = await supabase.auth.getUser();
  user = userData?.user || null;

  if(userError || !user){
    location.replace("/login.html");
    return false;
  }

  const {data,error} = await supabase
    .from("usuarios")
    .select("id,nombre,email,rol,activo")
    .eq("auth_user_id",user.id)
    .eq("activo",true)
    .maybeSingle();

  if(error || !data){
    await supabase.auth.signOut();
    location.replace("/login.html");
    return false;
  }

  perfil = data;

  if(perfil.rol !== "ADMINISTRADOR"){
    mostrarPagina();
    document.body.innerHTML = `
      <main style="
        min-height:100vh;
        display:grid;
        place-items:center;
        padding:24px;
        font-family:Arial,Helvetica,sans-serif;
        background:#f3faf6;
        color:#17231d;
      ">
        <section style="
          width:min(100%,520px);
          background:#fff;
          border:1px solid #d7e9df;
          border-radius:18px;
          padding:26px;
          box-shadow:0 18px 45px rgba(20,80,50,.10);
        ">
          <h1 style="margin:0 0 10px;">Acceso restringido</h1>
          <p style="line-height:1.5;">
            Esta pantalla es exclusiva para el administrador de SERVICIOS INTEGRALES.
          </p>
          <a href="/" style="
            display:flex;
            min-height:44px;
            align-items:center;
            justify-content:center;
            border-radius:10px;
            background:#0f6a3d;
            color:#fff;
            text-decoration:none;
            font-weight:800;
          ">Volver al sistema</a>
        </section>
      </main>
    `;
    return false;
  }

  $("#userName").textContent = perfil.nombre || "Juan";
  $("#userRole").textContent = perfil.rol || "ADMINISTRADOR";

  mostrarPagina();
  return true;
}

async function traerUsuarios(ids){
  const limpios = [...new Set(ids.filter(Boolean))];
  if(!limpios.length) return new Map();

  const {data,error} = await supabase
    .from("usuarios")
    .select("id,nombre")
    .in("id",limpios);

  if(error) throw error;

  return new Map((data||[]).map(u => [u.id,u.nombre]));
}

function operacionHtml(op){
  const operacion = escapeHtml(op?.operacion || "—");
  const valorCuota = fmtMoney.format(Number(op?.valor_cuota || 0));
  const cuotaActual = Number(op?.cuota_actual || 0);
  const cuotasTotales = Number(op?.cuotas_totales || 0);
  const saldoCapital = fmtMoney.format(Number(op?.saldo_capital || 0));

  return `
    <div class="operation-line">
      <strong>Operación ${operacion}</strong>
      - Valor cuota <strong>${valorCuota}</strong>
      - cuota <strong>${cuotaActual} de ${cuotasTotales}</strong>
      - Saldo capital <strong>${saldoCapital}</strong>
    </div>
  `;
}

function casoHtml(caso,creador){
  const operaciones = Array.isArray(caso.operaciones) ? caso.operaciones : [];
  const obs = caso.observaciones
    ? escapeHtml(caso.observaciones)
    : "Sin observaciones.";

  return `
    <article class="case" data-case-id="${escapeHtml(caso.id)}">
      <header class="case-head">
        <div>
          <div class="case-kicker">FICHA ENVIADA A REVISIÓN</div>
          <h2 class="case-name">${escapeHtml(caso.nombre_apellido)}</h2>
          <div class="case-cuil">
            ${escapeHtml(formatCuil(caso.cuil))} · ${escapeHtml(caso.organismo)}
          </div>
        </div>

        <div class="case-state">
          <span class="state-pill">🟡 EN REVISIÓN</span>
          <div class="case-meta">
            Enviado por ${escapeHtml(creador || "usuario interno")}<br>
            ${escapeHtml(fechaHora(caso.enviado_revision_at))}
          </div>
        </div>
      </header>

      <section class="summary">
        <div class="summary-box cupo">
          <small>Cupo calculado</small>
          <strong>${fmtMoney.format(Number(caso.cupo_calculado || 0))}</strong>
        </div>
        <div class="summary-box">
          <small>Créditos vigentes</small>
          <strong>${Number(caso.creditos_vigentes || 0)}</strong>
        </div>
        <div class="summary-box">
          <small>Total de cuotas</small>
          <strong>${fmtMoney.format(Number(caso.total_cuotas || 0))}</strong>
        </div>
        <div class="summary-box">
          <small>Saldo total</small>
          <strong>${fmtMoney.format(Number(caso.saldo_total || 0))}</strong>
        </div>
      </section>

      <section class="section">
        <div class="section-title">CRÉDITOS VIGENTES</div>
        <div class="operations">
          ${operaciones.map(operacionHtml).join("") || '<div class="operation-line">Sin operaciones guardadas.</div>'}
        </div>
      </section>

      <section class="section">
        <div class="section-title">OBSERVACIONES DE ${escapeHtml((creador || "USUARIO INTERNO").toUpperCase())}</div>
        <div class="observations">${obs}</div>
      </section>

      <section class="decision">
        <div class="section-title">RESPUESTA DE JUAN</div>
        <textarea
          class="respuesta"
          placeholder="Ej.: Aprobado. Realizar manteniendo cuota / Rechazado por saldo / Esperar próximo mes..."
        ></textarea>
        <div class="decision-help">
          Podés dejar una aclaración junto con tu decisión.
        </div>
        <div class="decision-actions">
          <button class="approve" type="button" data-action="APROBADO">
            🟢 APROBAR
          </button>
          <button class="reject" type="button" data-action="RECHAZADO">
            🔴 RECHAZAR
          </button>
        </div>
      </section>
    </article>
  `;
}

async function cargarCasos(silencioso=false){
  if(cargando) return;
  cargando = true;

  if(!silencioso){
    limpiarMensaje();
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Actualizando...";
  }

  try{
    const {data,error} = await supabase
      .from("casos")
      .select(
        "id,nombre_apellido,cuil,organismo,cupo_calculado,creditos_vigentes,total_cuotas,saldo_total,operaciones,observaciones,estado,creado_por,enviado_revision_at"
      )
      .eq("estado","EN_REVISION")
      .order("enviado_revision_at",{ascending:true});

    if(error) throw error;

    const casos = data || [];
    const usuarios = await traerUsuarios(casos.map(c => c.creado_por));

    pendingCount.textContent = String(casos.length);

    if(!casos.length){
      casesList.innerHTML = "";
      emptyBox.classList.remove("hidden");
      return;
    }

    emptyBox.classList.add("hidden");

    casesList.innerHTML = casos
      .map(caso => casoHtml(caso,usuarios.get(caso.creado_por)))
      .join("");

  }catch(error){
    console.error("[SERVICIOS INTEGRALES] Error cargando casos:",error);
    mensaje(
      "No se pudieron cargar los casos pendientes. Volvé a intentar.",
      true
    );
  }finally{
    cargando = false;

    if(!silencioso){
      refreshBtn.disabled = false;
      refreshBtn.textContent = "Actualizar ahora";
    }
  }
}

async function resolverCaso(card,estadoNuevo){
  if(!perfil || perfil.rol !== "ADMINISTRADOR") return;

  const casoId = card.dataset.caseId;
  if(!casoId) return;

  const respuesta = String($(".respuesta",card)?.value || "").trim();
  const accionTexto = estadoNuevo === "APROBADO" ? "APROBAR" : "RECHAZAR";

  if(!confirm(`¿Confirmás ${accionTexto} este caso?`)){
    return;
  }

  const botones = card.querySelectorAll("button[data-action]");
  botones.forEach(b => b.disabled = true);

  try{
    const {data,error} = await supabase
      .from("casos")
      .update({
        estado:estadoNuevo,
        resuelto_por:perfil.id,
        respuesta_resolucion:respuesta || null,
        resuelto_at:new Date().toISOString()
      })
      .eq("id",casoId)
      .eq("estado","EN_REVISION")
      .select("id,estado")
      .maybeSingle();

    if(error) throw error;

    if(!data){
      mensaje(
        "El caso ya había sido resuelto desde otra sesión. Se actualizará la lista.",
        true
      );
      await cargarCasos(true);
      return;
    }

    const textoResultado =
      estadoNuevo === "APROBADO" ? "APROBADO" : "RECHAZADO";

    mensaje(`Caso ${textoResultado} correctamente por Juan.`);

    card.remove();

    const restantes = casesList.querySelectorAll(".case").length;
    pendingCount.textContent = String(restantes);

    if(restantes === 0){
      emptyBox.classList.remove("hidden");
    }

  }catch(error){
    console.error("[SERVICIOS INTEGRALES] Error resolviendo caso:",error);
    mensaje(
      error?.message || "No se pudo guardar la decisión.",
      true
    );
    botones.forEach(b => b.disabled = false);
  }
}

casesList.addEventListener("click",(event)=>{
  const boton = event.target.closest("button[data-action]");
  if(!boton) return;

  const card = boton.closest(".case");
  const estado = boton.dataset.action;

  if(!card || !["APROBADO","RECHAZADO"].includes(estado)) return;

  resolverCaso(card,estado);
});

refreshBtn.addEventListener("click",()=>cargarCasos(false));

logoutBtn.addEventListener("click",async()=>{
  await supabase.auth.signOut();
  location.replace("/login.html");
});

async function iniciar(){
  const ok = await validarAdmin();
  if(!ok) return;

  await cargarCasos(false);

  refreshTimer = setInterval(()=>{
    cargarCasos(true);
  },15000);

  window.addEventListener("beforeunload",()=>{
    clearInterval(refreshTimer);
  });
}

iniciar();
