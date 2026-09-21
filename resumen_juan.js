/*
  SERVICIOS INTEGRALES - RESUMEN PARA JUAN V1

  MÓDULO NUEVO E INDEPENDIENTE.

  - NO modifica renovacion.js.
  - NO modifica ficha.js.
  - NO consulta Creditan.
  - NO recalcula la operación.
  - Lee únicamente los datos que ya están visibles/calculados.
  - Agrega el botón: DESCARGAR PDF PARA JUAN.
  - El PDF se genera usando la impresión nativa del navegador:
    al pulsar el botón se abre el resumen listo para elegir
    "Guardar como PDF".

  IMPORTANTE:
  Para activarlo, index.html debe cargar este archivo DESPUÉS de renovacion.js.
*/

(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  function texto(selector, fallback = "—", root = document) {
    const el = $(selector, root);
    const valor = String(el?.textContent || "").trim();
    return valor || fallback;
  }

  function escaparHtml(valor) {
    return String(valor ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function leerOperacionDeLinea(linea) {
    const primerStrong = $("strong", linea);
    const match = String(primerStrong?.textContent || "").match(
      /Operaci[oó]n\s+([A-Za-z0-9-]+)/i
    );

    return match?.[1] || "";
  }

  function tarjetaPorOperacion(operacion) {
    return $$("#creditsList .credit-card").find((tarjeta) => {
      const op = texto('[data-field="operacion"]', "", tarjeta);
      return op === operacion;
    }) || null;
  }

  function cuotaActualDesdeTarjeta(tarjeta) {
    if (!tarjeta) return "0";

    const fila = $(
      '[data-field="cuotasTable"] tr.recommended',
      tarjeta
    );

    if (!fila) return "0";

    const primeraCelda = $("td", fila);
    const valor = String(primeraCelda?.textContent || "").trim();

    return /^\d+$/.test(valor) ? valor : "0";
  }

  function leerCreditos() {
    const lineas = $$("#fichaDetalleCreditos .ficha-credito-linea");

    return lineas.map((linea) => {
      const operacion = leerOperacionDeLinea(linea);
      const tarjeta = tarjetaPorOperacion(operacion);

      const check = $(".si-renovacion-check", linea);

      return {
        operacion: operacion || "—",
        seleccionado: Boolean(check?.checked),
        valorCuota: tarjeta
          ? texto('[data-field="valorCuota"]', "$ 0,00", tarjeta)
          : "$ 0,00",
        cuotaActual: tarjeta
          ? cuotaActualDesdeTarjeta(tarjeta)
          : "0",
        cuotasTotales: tarjeta
          ? texto('[data-field="cuotas"]', "—", tarjeta)
          : "—",
        saldoCapital: tarjeta
          ? texto('[data-field="saldoCapital"]', "$ 0,00", tarjeta)
          : "$ 0,00"
      };
    });
  }

  function leerResumen() {
    const estado =
      window.ServiciosIntegralesRenovacion &&
      typeof window.ServiciosIntegralesRenovacion.getEstado === "function"
        ? window.ServiciosIntegralesRenovacion.getEstado()
        : null;

    return {
      nombre: texto("#fichaNombre", "CLIENTE"),
      cuil: texto("#fichaCuil", "—"),
      organismo: texto("#fichaOrganismo", "—"),

      cupoCalculado: texto("#fichaCupo", "Pendiente"),
      creditosVigentes: texto("#fichaVigentes", "0"),
      totalCuotas: texto("#fichaCuotasTotal", "$ 0,00"),
      saldoTotal: texto("#fichaSaldoTotal", "$ 0,00"),

      creditos: leerCreditos(),

      saldoSeleccionado: texto(
        "#siRenovacionSaldoSeleccionado",
        "$ 0,00"
      ),
      cinco: texto("#siRenovacionCinco", "$ 0,00"),
      totalCancelar: texto(
        "#siRenovacionTotalCancelar",
        "$ 0,00"
      ),
      cuotasLiberadas: texto(
        "#siRenovacionCuotasLiberadas",
        "$ 0,00"
      ),

      importeFirmar:
        String($("#siRenovacionImporteFirmar")?.value || "").trim() || "—",
      cuotas:
        String($("#siRenovacionCuotas")?.value || "").trim() || "—",
      importeCuota: texto(
        "#siRenovacionCuotaCreditan",
        "Pendiente Creditan"
      ),
      comision: texto("#siRenovacionComision", "$ 0,00"),
      netoBase: texto("#siRenovacionNetoBase", "$ 0,00"),
      enManoFinal: texto("#siRenovacionEnManoFinal", "$ 0,00"),

      cupoActual: texto("#siRenovacionCupoActual", "Pendiente"),
      cupoLiberado: texto("#siRenovacionCupoLiberado", "$ 0,00"),
      cupoProyectado: texto(
        "#siRenovacionCupoProyectado",
        "Pendiente"
      ),
      nuevaCuota: texto(
        "#siRenovacionNuevaCuota",
        "Pendiente Creditan"
      ),

      estadoCupo: estado?.estadoCupo || "PENDIENTE",
      margen:
        Number.isFinite(Number(estado?.margen))
          ? Number(estado.margen)
          : null
    };
  }

  function estadoCupoTexto(estado) {
    if (estado === "ENTRA") return "ENTRA EN CUPO";
    if (estado === "NO_ENTRA") return "NO ENTRA EN CUPO";
    return "PENDIENTE";
  }

  function claseEstadoCupo(estado) {
    if (estado === "ENTRA") return "ok";
    if (estado === "NO_ENTRA") return "no";
    return "pendiente";
  }

  function crearHtmlResumen(datos) {
    const creditosHtml = datos.creditos.length
      ? datos.creditos.map((credito) => `
          <div class="credito ${credito.seleccionado ? "cancelar" : ""}">
            <div class="marca">${credito.seleccionado ? "✓" : ""}</div>
            <div class="credito-contenido">
              <strong>Operación ${escaparHtml(credito.operacion)}</strong>
              <div>
                Valor cuota <b>${escaparHtml(credito.valorCuota)}</b>
                · cuota <b>${escaparHtml(credito.cuotaActual)} de ${escaparHtml(credito.cuotasTotales)}</b>
                · Saldo capital <b>${escaparHtml(credito.saldoCapital)}</b>
              </div>
              ${
                credito.seleccionado
                  ? '<span class="cancelar-texto">SE CANCELA EN ESTA OPERACIÓN</span>'
                  : ""
              }
            </div>
          </div>
        `).join("")
      : '<div class="sin-datos">No hay créditos vigentes para mostrar.</div>';

    const hayCancelaciones =
      datos.creditos.some((credito) => credito.seleccionado);

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Resumen - ${escaparHtml(datos.nombre)}</title>
<style>
  *{box-sizing:border-box}
  @page{size:A4;margin:12mm}
  body{
    margin:0;
    font-family:Arial,Helvetica,sans-serif;
    color:#17231d;
    background:#fff;
    font-size:12px;
    line-height:1.35;
  }
  .hoja{max-width:190mm;margin:0 auto}
  .cabecera{
    border-bottom:3px solid #14804a;
    padding-bottom:10px;
    margin-bottom:12px;
  }
  .marca-si{
    color:#14804a;
    font-size:11px;
    font-weight:900;
    letter-spacing:.08em;
  }
  h1{
    margin:3px 0 0;
    font-size:22px;
    color:#0d633b;
  }
  .cliente{
    display:grid;
    grid-template-columns:2fr 1.2fr 1fr;
    gap:8px;
    margin-bottom:10px;
  }
  .box{
    border:1px solid #cfdcd5;
    border-radius:8px;
    padding:8px 9px;
    background:#fbfefc;
  }
  .box span{
    display:block;
    color:#68766e;
    font-size:9px;
    margin-bottom:2px;
    text-transform:uppercase;
    font-weight:700;
  }
  .box strong{font-size:13px}
  .grid4{
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:7px;
    margin-bottom:12px;
  }
  .titulo{
    margin:12px 0 6px;
    color:#0d633b;
    font-size:12px;
    font-weight:900;
    border-bottom:1px solid #d9e5de;
    padding-bottom:4px;
  }
  .credito{
    display:flex;
    gap:8px;
    align-items:flex-start;
    padding:7px 8px;
    border-bottom:1px solid #e3ebe6;
    page-break-inside:avoid;
  }
  .credito.cancelar{
    background:#edf8f2;
    border:1px solid #b8ddc6;
    border-radius:7px;
    margin:4px 0;
  }
  .marca{
    width:18px;
    height:18px;
    flex:0 0 18px;
    border:1.5px solid #14804a;
    border-radius:4px;
    display:flex;
    align-items:center;
    justify-content:center;
    color:#fff;
    background:#fff;
    font-weight:900;
  }
  .cancelar .marca{background:#14804a}
  .credito-contenido{flex:1}
  .credito-contenido>strong{
    display:block;
    font-size:12px;
    margin-bottom:2px;
  }
  .cancelar-texto{
    display:inline-block;
    margin-top:3px;
    color:#0d633b;
    font-size:9px;
    font-weight:900;
  }
  .grid3{
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:7px;
  }
  .destacado{
    background:#edf8f2;
    border-color:#a9d9bd;
  }
  .destacado strong{
    color:#0d633b;
    font-size:15px;
  }
  .estado{
    margin-top:9px;
    border-radius:8px;
    padding:9px 10px;
    font-size:14px;
    font-weight:900;
    text-align:center;
    border:1px solid;
  }
  .estado.ok{
    background:#edf8f2;
    border-color:#a9d9bd;
    color:#0d633b;
  }
  .estado.no{
    background:#fff1f0;
    border-color:#efb0aa;
    color:#b42318;
  }
  .estado.pendiente{
    background:#fffaf0;
    border-color:#ead99e;
    color:#665a34;
  }
  .nota{
    margin-top:12px;
    color:#68766e;
    font-size:9px;
    text-align:center;
  }
  .cancelacion-resumen{
    margin-top:7px;
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:7px;
  }
  @media print{
    body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
  }
</style>
</head>
<body>
<div class="hoja">
  <div class="cabecera">
    <div class="marca-si">SERVICIOS INTEGRALES · USO INTERNO</div>
    <h1>Resumen de operación</h1>
  </div>

  <div class="cliente">
    <div class="box">
      <span>Nombre y Apellido</span>
      <strong>${escaparHtml(datos.nombre)}</strong>
    </div>
    <div class="box">
      <span>CUIL</span>
      <strong>${escaparHtml(datos.cuil)}</strong>
    </div>
    <div class="box">
      <span>Organismo</span>
      <strong>${escaparHtml(datos.organismo)}</strong>
    </div>
  </div>

  <div class="grid4">
    <div class="box"><span>Cupo calculado</span><strong>${escaparHtml(datos.cupoCalculado)}</strong></div>
    <div class="box"><span>Créditos vigentes</span><strong>${escaparHtml(datos.creditosVigentes)}</strong></div>
    <div class="box"><span>Total de cuotas</span><strong>${escaparHtml(datos.totalCuotas)}</strong></div>
    <div class="box"><span>Saldo total</span><strong>${escaparHtml(datos.saldoTotal)}</strong></div>
  </div>

  <div class="titulo">CRÉDITOS VIGENTES</div>
  ${creditosHtml}

  ${
    hayCancelaciones
      ? `
        <div class="cancelacion-resumen">
          <div class="box"><span>Saldo seleccionado</span><strong>${escaparHtml(datos.saldoSeleccionado)}</strong></div>
          <div class="box"><span>5% cancelación</span><strong>${escaparHtml(datos.cinco)}</strong></div>
          <div class="box"><span>Total a cancelar</span><strong>${escaparHtml(datos.totalCancelar)}</strong></div>
          <div class="box"><span>Cuotas liberadas</span><strong>${escaparHtml(datos.cuotasLiberadas)}</strong></div>
        </div>
      `
      : ""
  }

  <div class="titulo">OPERACIÓN A REALIZAR</div>
  <div class="grid3">
    <div class="box"><span>Importe a firmar</span><strong>${escaparHtml(datos.importeFirmar)}</strong></div>
    <div class="box"><span>Cuotas</span><strong>${escaparHtml(datos.cuotas)}</strong></div>
    <div class="box"><span>Importe de cuota</span><strong>${escaparHtml(datos.importeCuota)}</strong></div>
    <div class="box"><span>Comisión Creditan</span><strong>${escaparHtml(datos.comision)}</strong></div>
    <div class="box"><span>Neto base antes de cancelaciones</span><strong>${escaparHtml(datos.netoBase)}</strong></div>
    <div class="box destacado"><span>EN MANO FINAL</span><strong>${escaparHtml(datos.enManoFinal)}</strong></div>
  </div>

  <div class="titulo">ANÁLISIS DE CUPO</div>
  <div class="grid4">
    <div class="box"><span>Cupo actual</span><strong>${escaparHtml(datos.cupoActual)}</strong></div>
    <div class="box"><span>+ Cuotas liberadas</span><strong>${escaparHtml(datos.cupoLiberado)}</strong></div>
    <div class="box destacado"><span>Cupo disponible proyectado</span><strong>${escaparHtml(datos.cupoProyectado)}</strong></div>
    <div class="box"><span>Nueva cuota Creditan</span><strong>${escaparHtml(datos.nuevaCuota)}</strong></div>
  </div>

  <div class="estado ${claseEstadoCupo(datos.estadoCupo)}">
    ${escaparHtml(estadoCupoTexto(datos.estadoCupo))}
  </div>

  <div class="nota">
    Resumen generado desde Servicios Integrales con los datos visibles de la operación.
  </div>
</div>

<script>
  window.addEventListener("load", () => {
    setTimeout(() => window.print(), 250);
  });
<\/script>
</body>
</html>`;
  }

  function descargarPdfJuan() {
    const ficha = $("#fichaConsolidada");

    if (!ficha || ficha.classList.contains("hidden")) {
      alert("Primero consultá un cliente para generar el resumen.");
      return;
    }

    const datos = leerResumen();
    const html = crearHtmlResumen(datos);

    const ventana = window.open("", "_blank");

    if (!ventana) {
      alert(
        "El navegador bloqueó la ventana del resumen. Permití las ventanas emergentes para Servicios Integrales."
      );
      return;
    }

    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  }

  function asegurarEstilos() {
    if ($("#si-resumen-juan-style")) return;

    const style = document.createElement("style");
    style.id = "si-resumen-juan-style";
    style.textContent = `
      .si-resumen-juan-wrap{
        margin-top:12px;
        display:flex;
        justify-content:flex-end;
      }

      .si-resumen-juan-btn{
        min-height:42px;
        border:0;
        border-radius:10px;
        background:#17231d;
        color:#fff;
        padding:10px 18px;
        font:inherit;
        font-size:12px;
        font-weight:900;
        cursor:pointer;
        box-shadow:0 2px 8px rgba(23,35,29,.14);
      }

      .si-resumen-juan-btn:hover{
        background:#0d633b;
      }

      @media (max-width:620px){
        .si-resumen-juan-wrap{
          justify-content:stretch;
        }

        .si-resumen-juan-btn{
          width:100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function asegurarBoton() {
    const bloque = $("#siRenovacionBloque");

    if (!bloque) return false;

    if ($("#siResumenJuanWrap")) return true;

    const wrap = document.createElement("div");
    wrap.id = "siResumenJuanWrap";
    wrap.className = "si-resumen-juan-wrap";

    const boton = document.createElement("button");
    boton.id = "siResumenJuanBtn";
    boton.type = "button";
    boton.className = "si-resumen-juan-btn";
    boton.textContent = "📄 DESCARGAR PDF PARA JUAN";

    boton.addEventListener("click", descargarPdfJuan);

    wrap.appendChild(boton);
    bloque.appendChild(wrap);

    return true;
  }

  function iniciar() {
    asegurarEstilos();

    if (asegurarBoton()) return;

    const observer = new MutationObserver(() => {
      if (asegurarBoton()) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  iniciar();

  console.info(
    "[SERVICIOS INTEGRALES] Resumen para Juan V1 activo."
  );
})();
