/*
  SERVICIOS INTEGRALES - CASOS RESUELTOS DE JUAN V1.1

  Agrega debajo del panel actual una sección para consultar casos
  APROBADOS y RECHAZADOS, con buscador por nombre o CUIL.

  IMPORTANTE:
  - NO modifica juan.js.
  - NO cambia el circuito de pendientes.
  - NO cambia APROBAR / RECHAZAR.
  - NO modifica ningún archivo del sistema principal.
*/

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://smxcqnahlklkqrxbbrjh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_am_ucuk2jAJPZRz-aaVJvA_72Z1h2du";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth:{
      persistSession:false,
      autoRefreshToken:false,
      detectSessionInUrl:false
    }
  }
);

const $ = (selector, root=document) => root.querySelector(selector);

const STORAGE_KEY = "si_usuario_local_v1";
const USUARIO_ACTUAL = String(localStorage.getItem(STORAGE_KEY) || "")
  .trim()
  .toUpperCase();

if (USUARIO_ACTUAL !== "JUAN") {
  // La página principal ya protege el panel. Acá simplemente no montamos nada.
} else {
  iniciar();
}

const fmtMoney = new Intl.NumberFormat("es-AR",{
  style:"currency",
  currency:"ARS",
  minimumFractionDigits:2,
  maximumFractionDigits:2
});

let casosCache = [];
let filtroEstado = "TODOS";
let busquedaActual = "";
let refreshTimer = null;
let cargando = false;

function escapeHtml(valor){
  return String(valor ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function formatCuil(valor){
  const d = String(valor || "").replace(/\D/g,"").slice(0,11);
  if(d.length !== 11) return String(valor || "—");
  return `${d.slice(0,2)}-${d.slice(2,10)}-${d.slice(10)}`;
}

function fechaHora(valor){
  if(!valor) return "—";
  try{
    return new Intl.DateTimeFormat("es-AR",{
      dateStyle:"short",
      timeStyle:"short"
    }).format(new Date(valor));
  }catch(_){
    return String(valor);
  }
}

function asegurarEstilos(){
  if($("#si-resueltos-style")) return;

  const style = document.createElement("style");
  style.id = "si-resueltos-style";
  style.textContent = `
    .si-resueltos-wrap{
      margin-top:26px;
    }

    .si-resueltos-toolbar{
      background:#fff;
      border:1px solid var(--verde-borde);
      border-radius:16px;
      padding:15px 17px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:16px;
      flex-wrap:wrap;
    }

    .si-resueltos-toolbar-title{
      font-size:14px;
      font-weight:900;
      color:var(--verde-oscuro);
    }

    .si-resueltos-toolbar-sub{
      margin-top:3px;
      color:var(--muted);
      font-size:11px;
    }

    .si-resueltos-actions{
      display:flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
    }

    .si-resueltos-filter{
      min-height:36px;
      border:1px solid var(--verde-borde);
      border-radius:9px;
      padding:0 10px;
      background:#fff;
      color:var(--texto);
      font:inherit;
      font-size:12px;
      font-weight:800;
      cursor:pointer;
    }

    .si-resueltos-filter.active{
      background:var(--verde-suave);
      color:var(--verde-oscuro);
      border-color:#bcdcca;
    }

    .si-resueltos-search{
      min-width:250px;
      min-height:36px;
      border:1px solid var(--verde-borde);
      border-radius:9px;
      padding:0 11px;
      background:#fff;
      color:var(--texto);
      font:inherit;
      font-size:12px;
      outline:none;
    }

    .si-resueltos-search:focus{
      border-color:#95c9aa;
      box-shadow:0 0 0 3px rgba(15,106,61,.08);
    }

    .si-resueltos-count{
      min-width:36px;
      height:36px;
      padding:0 10px;
      border-radius:999px;
      background:var(--verde-suave);
      color:var(--verde-oscuro);
      display:inline-flex;
      align-items:center;
      justify-content:center;
      font-size:12px;
      font-weight:900;
    }

    .si-resueltos-list{
      display:grid;
      gap:14px;
      margin-top:14px;
    }

    .si-resueltos-empty{
      background:#fff;
      border:1px solid var(--verde-borde);
      border-radius:16px;
      padding:24px;
      text-align:center;
      color:var(--muted);
      font-size:13px;
    }

    .si-resuelto-card{
      background:#fff;
      border:1px solid var(--verde-borde);
      border-radius:16px;
      overflow:hidden;
      box-shadow:0 8px 22px rgba(20,80,50,.06);
    }

    .si-resuelto-card.aprobado{
      border-color:#b8ddc6;
    }

    .si-resuelto-card.rechazado{
      border-color:#efc0bc;
    }

    .si-resuelto-head{
      padding:16px 18px;
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:14px;
      border-bottom:1px solid #e7efea;
    }

    .si-resuelto-kicker{
      font-size:10px;
      font-weight:900;
      letter-spacing:.07em;
      color:var(--verde);
      margin-bottom:5px;
    }

    .si-resuelto-name{
      margin:0 0 4px;
      font-size:20px;
      font-weight:900;
    }

    .si-resuelto-cuil{
      color:var(--muted);
      font-size:12px;
    }

    .si-resuelto-state{
      flex:none;
      text-align:right;
    }

    .si-resuelto-pill{
      display:inline-block;
      border-radius:999px;
      padding:7px 10px;
      font-size:11px;
      font-weight:900;
    }

    .si-resuelto-card.aprobado .si-resuelto-pill{
      background:#edf8f2;
      color:#0d633b;
      border:1px solid #b8ddc6;
    }

    .si-resuelto-card.rechazado .si-resuelto-pill{
      background:#fff1f0;
      color:#b42318;
      border:1px solid #efc0bc;
    }

    .si-resuelto-meta{
      margin-top:7px;
      color:var(--muted);
      font-size:11px;
      line-height:1.45;
    }

    .si-resuelto-summary{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:10px;
      padding:14px 18px;
      border-bottom:1px solid #edf2ef;
    }

    .si-resuelto-box{
      border:1px solid #e1ebe5;
      border-radius:11px;
      padding:10px 11px;
      background:#fbfefc;
    }

    .si-resuelto-box small{
      display:block;
      color:var(--muted);
      font-size:10px;
      margin-bottom:4px;
    }

    .si-resuelto-box strong{
      display:block;
      font-size:14px;
    }

    .si-resuelto-body{
      padding:14px 18px 17px;
      display:grid;
      gap:10px;
    }

    .si-resuelto-text{
      border:1px solid #e4ece7;
      border-radius:10px;
      padding:10px 11px;
      background:#fbfefc;
      font-size:12px;
      line-height:1.45;
      white-space:pre-wrap;
      overflow-wrap:anywhere;
    }

    .si-resuelto-text strong{
      color:var(--verde-oscuro);
    }

    .si-resuelto-card.rechazado .si-resuelto-text.respuesta strong{
      color:#b42318;
    }

    .si-resuelto-details{
      border-top:1px solid #edf2ef;
      padding-top:10px;
    }

    .si-resuelto-details summary{
      cursor:pointer;
      color:var(--verde-oscuro);
      font-size:12px;
      font-weight:900;
    }

    .si-resuelto-ops{
      display:grid;
      gap:6px;
      margin-top:9px;
    }

    .si-resuelto-op{
      border:1px solid #e7efea;
      border-radius:9px;
      padding:8px 10px;
      background:#fff;
      font-size:11px;
      line-height:1.45;
    }

    @media (max-width:760px){
      .si-resueltos-search{
        width:100%;
        min-width:0;
      }
      .si-resueltos-actions{
        width:100%;
      }
      .si-resuelto-head{
        flex-direction:column;
      }
      .si-resuelto-state{
        text-align:left;
      }
      .si-resuelto-summary{
        grid-template-columns:1fr 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function asegurarBloque(){
  let wrap = $("#siResueltosWrap");
  if(wrap) return wrap;

  const page = $(".page");
  if(!page) return null;

  wrap = document.createElement("section");
  wrap.id = "siResueltosWrap";
  wrap.className = "si-resueltos-wrap";
  wrap.innerHTML = `
    <div class="si-resueltos-toolbar">
      <div>
        <div class="si-resueltos-toolbar-title">
          Casos resueltos
        </div>
        <div class="si-resueltos-toolbar-sub">
          Historial de aprobados y rechazados por Juan.
        </div>
      </div>

      <div class="si-resueltos-actions">
        <input
          id="siResueltosSearch"
          class="si-resueltos-search"
          type="search"
          autocomplete="off"
          placeholder="Buscar por nombre o CUIL"
          aria-label="Buscar casos resueltos por nombre o CUIL"
        >

        <button type="button" class="si-resueltos-filter active" data-filter="TODOS">
          Todos
        </button>
        <button type="button" class="si-resueltos-filter" data-filter="APROBADO">
          Aprobados
        </button>
        <button type="button" class="si-resueltos-filter" data-filter="RECHAZADO">
          Rechazados
        </button>
        <span id="siResueltosCount" class="si-resueltos-count">0</span>
      </div>
    </div>

    <div id="siResueltosList" class="si-resueltos-list">
      <div class="si-resueltos-empty">Cargando casos resueltos...</div>
    </div>
  `;

  page.appendChild(wrap);
  return wrap;
}

async function traerUsuarios(ids){
  const limpios = [...new Set(ids.filter(Boolean))];
  if(!limpios.length) return new Map();

  const {data,error} = await supabase
    .from("usuarios")
    .select("id,nombre")
    .in("id",limpios);

  if(error) throw error;

  return new Map((data || []).map(u => [u.id,u.nombre]));
}

function operacionesHtml(operaciones){
  const ops = Array.isArray(operaciones) ? operaciones : [];

  if(!ops.length){
    return `<div class="si-resuelto-op">Sin operaciones guardadas.</div>`;
  }

  return ops.map(op => {
    const operacion = escapeHtml(op?.operacion || "—");
    const valorCuota = fmtMoney.format(Number(op?.valor_cuota || 0));
    const cuotaActual = Number(op?.cuota_actual || 0);
    const cuotasTotales = Number(op?.cuotas_totales || 0);
    const saldoCapital = fmtMoney.format(Number(op?.saldo_capital || 0));

    return `
      <div class="si-resuelto-op">
        <strong>Operación ${operacion}</strong>
        · Cuota ${valorCuota}
        · ${cuotaActual} de ${cuotasTotales}
        · Saldo ${saldoCapital}
      </div>
    `;
  }).join("");
}

function casoHtml(caso,usuarios){
  const aprobado = caso.estado === "APROBADO";
  const clase = aprobado ? "aprobado" : "rechazado";
  const estadoTexto = aprobado ? "🟢 APROBADO" : "🔴 RECHAZADO";

  const creador = usuarios.get(caso.creado_por) || "Usuario interno";
  const resolutor = usuarios.get(caso.resuelto_por) || "Juan";

  const observacion = String(caso.observaciones || "").trim() || "Sin observaciones.";
  const respuesta = String(caso.respuesta_resolucion || "").trim() || "Sin observaciones.";

  return `
    <article class="si-resuelto-card ${clase}">
      <header class="si-resuelto-head">
        <div>
          <div class="si-resuelto-kicker">CASO RESUELTO</div>
          <h3 class="si-resuelto-name">${escapeHtml(caso.nombre_apellido || "—")}</h3>
          <div class="si-resuelto-cuil">
            ${escapeHtml(formatCuil(caso.cuil))} · ${escapeHtml(caso.organismo || "—")}
          </div>
        </div>

        <div class="si-resuelto-state">
          <span class="si-resuelto-pill">${estadoTexto}</span>
          <div class="si-resuelto-meta">
            Resuelto por ${escapeHtml(resolutor)}<br>
            ${escapeHtml(fechaHora(caso.resuelto_at))}
          </div>
        </div>
      </header>

      <section class="si-resuelto-summary">
        <div class="si-resuelto-box">
          <small>Cupo calculado</small>
          <strong>${fmtMoney.format(Number(caso.cupo_calculado || 0))}</strong>
        </div>
        <div class="si-resuelto-box">
          <small>Créditos vigentes</small>
          <strong>${Number(caso.creditos_vigentes || 0)}</strong>
        </div>
        <div class="si-resuelto-box">
          <small>Total de cuotas</small>
          <strong>${fmtMoney.format(Number(caso.total_cuotas || 0))}</strong>
        </div>
        <div class="si-resuelto-box">
          <small>Saldo total</small>
          <strong>${fmtMoney.format(Number(caso.saldo_total || 0))}</strong>
        </div>
      </section>

      <section class="si-resuelto-body">
        <div class="si-resuelto-text">
          <strong>Enviado por ${escapeHtml(creador)}:</strong>
          ${escapeHtml(observacion)}
        </div>

        <div class="si-resuelto-text respuesta">
          <strong>Respuesta de ${escapeHtml(resolutor)}:</strong>
          ${escapeHtml(respuesta)}
        </div>

        <details class="si-resuelto-details">
          <summary>Ver créditos guardados en esta ficha</summary>
          <div class="si-resuelto-ops">
            ${operacionesHtml(caso.operaciones)}
          </div>
        </details>
      </section>
    </article>
  `;
}

function normalizarBusqueda(valor){
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .trim();
}

function coincideBusqueda(caso){
  if(!busquedaActual) return true;

  const nombre = normalizarBusqueda(caso?.nombre_apellido);
  const cuil = String(caso?.cuil || "").replace(/\D/g,"");
  const termino = normalizarBusqueda(busquedaActual);
  const terminoDigitos = String(busquedaActual || "").replace(/\D/g,"");

  if(nombre.includes(termino)) return true;
  if(terminoDigitos && cuil.includes(terminoDigitos)) return true;

  return false;
}

function aplicarFiltro(){
  const list = $("#siResueltosList");
  const count = $("#siResueltosCount");
  if(!list || !count) return;

  const filtrados = casosCache.filter(caso => {
    const coincideEstado =
      filtroEstado === "TODOS" || caso.estado === filtroEstado;

    return coincideEstado && coincideBusqueda(caso);
  });

  count.textContent = String(filtrados.length);

  if(!filtrados.length){
    const textoBusqueda = String(busquedaActual || "").trim();

    list.innerHTML = `
      <div class="si-resueltos-empty">
        ${
          textoBusqueda
            ? `No se encontraron casos para "${escapeHtml(textoBusqueda)}".`
            : `No hay casos ${filtroEstado === "APROBADO" ? "aprobados" :
              filtroEstado === "RECHAZADO" ? "rechazados" : "resueltos"} para mostrar.`
        }
      </div>
    `;
    return;
  }

  const ids = [];
  filtrados.forEach(c => {
    if(c.creado_por) ids.push(c.creado_por);
    if(c.resuelto_por) ids.push(c.resuelto_por);
  });

  traerUsuarios(ids)
    .then(usuarios => {
      list.innerHTML = filtrados
        .map(c => casoHtml(c,usuarios))
        .join("");
    })
    .catch(error => {
      console.error("[SERVICIOS INTEGRALES] Error cargando usuarios resueltos:",error);
      list.innerHTML = `
        <div class="si-resueltos-empty">
          No se pudieron completar los datos de los casos resueltos.
        </div>
      `;
    });
}

async function cargarResueltos(silencioso=false){
  if(cargando) return;
  cargando = true;

  const list = $("#siResueltosList");

  if(!silencioso && list){
    list.innerHTML = `
      <div class="si-resueltos-empty">Actualizando casos resueltos...</div>
    `;
  }

  try{
    const {data,error} = await supabase
      .from("casos")
      .select(
        "id,nombre_apellido,cuil,organismo,cupo_calculado,creditos_vigentes,total_cuotas,saldo_total,operaciones,observaciones,estado,creado_por,resuelto_por,respuesta_resolucion,enviado_revision_at,resuelto_at,created_at"
      )
      .in("estado",["APROBADO","RECHAZADO"])
      .order("resuelto_at",{ascending:false})
      .limit(100);

    if(error) throw error;

    casosCache = data || [];
    aplicarFiltro();

  }catch(error){
    console.error("[SERVICIOS INTEGRALES] Error cargando casos resueltos:",error);

    if(list){
      list.innerHTML = `
        <div class="si-resueltos-empty">
          No se pudieron cargar los casos resueltos. Volvé a intentar.
        </div>
      `;
    }
  }finally{
    cargando = false;
  }
}

function montarFiltros(){
  const wrap = $("#siResueltosWrap");
  if(!wrap) return;

  wrap.addEventListener("click",(event)=>{
    const boton = event.target.closest("[data-filter]");
    if(!boton) return;

    filtroEstado = boton.dataset.filter || "TODOS";

    wrap.querySelectorAll("[data-filter]").forEach(btn=>{
      btn.classList.toggle("active",btn === boton);
    });

    aplicarFiltro();
  });
}

function montarBuscador(){
  const input = $("#siResueltosSearch");
  if(!input) return;

  input.addEventListener("input",()=>{
    busquedaActual = input.value || "";
    aplicarFiltro();
  });
}

function observarResoluciones(){
  const messageBox = $("#messageBox");
  if(!messageBox) return;

  const observer = new MutationObserver(()=>{
    const texto = String(messageBox.textContent || "");
    if(
      texto.includes("Caso APROBADO") ||
      texto.includes("Caso RECHAZADO")
    ){
      setTimeout(()=>cargarResueltos(true),300);
    }
  });

  observer.observe(messageBox,{
    childList:true,
    subtree:true,
    characterData:true
  });
}

function vincularActualizar(){
  const refreshBtn = $("#refreshBtn");
  if(!refreshBtn) return;

  refreshBtn.addEventListener("click",()=>{
    cargarResueltos(false);
  });
}

async function iniciar(){
  asegurarEstilos();
  asegurarBloque();
  montarFiltros();
  montarBuscador();
  observarResoluciones();
  vincularActualizar();

  await cargarResueltos(false);

  refreshTimer = setInterval(()=>{
    cargarResueltos(true);
  },15000);

  window.addEventListener("beforeunload",()=>{
    clearInterval(refreshTimer);
  });

  console.info(
    "[SERVICIOS INTEGRALES] Casos resueltos de Juan V1.1 activo."
  );
}
