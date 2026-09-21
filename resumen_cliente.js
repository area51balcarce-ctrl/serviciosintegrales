/*
  SERVICIOS INTEGRALES - RESUMEN PARA CLIENTE V1

  MÓDULO INDEPENDIENTE.

  - NO modifica app.js.
  - NO modifica ficha.js.
  - NO modifica renovacion.js.
  - NO modifica resumen_juan.js.
  - NO consulta Creditan.
  - NO recalcula datos.
  - Lee únicamente la información ya visible/cargada.
  - Agrega el botón: DESCARGAR PDF PARA CLIENTE.
  - Genera un estado de cuenta simplificado para entregar al cliente.

  IMPORTANTE:
  index.html debe cargar este archivo después de resumen_juan.js.
*/

(() => {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

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

    const match = String(
      primerStrong?.textContent || ""
    ).match(/Operaci[oó]n\s+([A-Za-z0-9-]+)/i);

    return match?.[1] || "";
  }

  function tarjetaPorOperacion(operacion) {
    return (
      $$("#creditsList .credit-card").find((tarjeta) => {
        const op = texto(
          '[data-field="operacion"]',
          "",
          tarjeta
        );

        return op === operacion;
      }) || null
    );
  }

  function cuotaActualDesdeTarjeta(tarjeta) {
    if (!tarjeta) return "0";

    const fila = $(
      '[data-field="cuotasTable"] tr.recommended',
      tarjeta
    );

    if (!fila) return "0";

    const primeraCelda = $("td", fila);

    const valor = String(
      primeraCelda?.textContent || ""
    ).trim();

    return /^\d+$/.test(valor)
      ? valor
      : "0";
  }

  function leerCreditos() {
    const lineas = $$(
      "#fichaDetalleCreditos .ficha-credito-linea"
    );

    return lineas.map((linea) => {
      const operacion = leerOperacionDeLinea(linea);
      const tarjeta = tarjetaPorOperacion(operacion);

      return {
        operacion: operacion || "—",

        valorCuota: tarjeta
          ? texto(
              '[data-field="valorCuota"]',
              "$ 0,00",
              tarjeta
            )
          : "$ 0,00",

        cuotaActual: tarjeta
          ? cuotaActualDesdeTarjeta(tarjeta)
          : "0",

        cuotasTotales: tarjeta
          ? texto(
              '[data-field="cuotas"]',
              "—",
              tarjeta
            )
          : "—",

        saldoCapital: tarjeta
          ? texto(
              '[data-field="saldoCapital"]',
              "$ 0,00",
              tarjeta
            )
          : "$ 0,00",

        fechaSolicitud: tarjeta
          ? String(
              tarjeta.dataset.fechaSolicitud || "—"
            ).trim()
          : "—"
      };
    });
  }

  function leerResumenCliente() {
    return {
      nombre: texto(
        "#fichaNombre",
        "CLIENTE"
      ),

      cuil: texto(
        "#fichaCuil",
        "—"
      ),

      organismo: texto(
        "#fichaOrganismo",
        "—"
      ),

      creditosVigentes: texto(
        "#fichaVigentes",
        "0"
      ),

      totalCuotas: texto(
        "#fichaCuotasTotal",
        "$ 0,00"
      ),

      creditos: leerCreditos()
    };
  }

  function crearHtmlCliente(datos) {
    const creditosHtml = datos.creditos.length
      ? datos.creditos
          .map(
            (credito) => `
        <div class="credito">

          <div class="credito-contenido">

            <strong>
              Operación ${escaparHtml(
                credito.operacion
              )}
            </strong>

            <div class="credito-detalle">

              Valor cuota
              <b>
                ${escaparHtml(
                  credito.valorCuota
                )}
              </b>

              · cuota
              <b>
                ${escaparHtml(
                  credito.cuotaActual
                )}
                de
                ${escaparHtml(
                  credito.cuotasTotales
                )}
              </b>

              · Saldo capital
              <b>
                ${escaparHtml(
                  credito.saldoCapital
                )}
              </b>

              · Fecha solicitud
              <b>
                ${escaparHtml(
                  credito.fechaSolicitud
                )}
              </b>

            </div>

          </div>

        </div>
      `
          )
          .join("")
      : `
        <div class="sin-datos">
          No hay créditos vigentes para mostrar.
        </div>
      `;

    return `
<!DOCTYPE html>

<html lang="es">

<head>

<meta charset="UTF-8">

<title>
Estado de cuenta - ${escaparHtml(datos.nombre)}
</title>

<style>

*{
  box-sizing:border-box;
}

@page{
  size:A4;
  margin:12mm;
}

html,
body{
  margin:0;
  padding:0;
}

body{
  font-family:Arial,Helvetica,sans-serif;
  color:#17231d;
  background:#ffffff;
  font-size:12px;
  line-height:1.35;
}

.hoja{
  position:relative;
  width:100%;
  min-height:270mm;
  max-width:190mm;
  margin:0 auto;
  padding-bottom:42mm;
}

/* =========================
   CABECERA
========================= */

.cabecera{
  border-bottom:3px solid #14804a;
  padding-bottom:10px;
  margin-bottom:14px;
}

.marca-si{
  color:#14804a;
  font-size:11px;
  font-weight:900;
  letter-spacing:.08em;
}

h1{
  margin:4px 0 0;
  font-size:22px;
  color:#0d633b;
}

/* =========================
   DATOS DEL CLIENTE
========================= */

.cliente{
  display:grid;
  grid-template-columns:2fr 1.2fr 1fr;
  gap:8px;
  margin-bottom:10px;
}

.box{
  border:1px solid #cfdcd5;
  border-radius:8px;
  padding:9px 10px;
  background:#fbfefc;
}

.box span{
  display:block;
  color:#68766e;
  font-size:9px;
  margin-bottom:3px;
  text-transform:uppercase;
  font-weight:700;
}

.box strong{
  font-size:13px;
}

/* =========================
   RESUMEN
========================= */

.resumen{
  display:grid;
  grid-template-columns:repeat(2,210px);
  justify-content:center;
  gap:10px;
  margin:10px 0 14px;
}

/* =========================
   TITULO CREDITOS
========================= */

.titulo{
  margin:12px 0 5px;
  color:#0d633b;
  font-size:13px;
  font-weight:900;
  border-bottom:1px solid #d9e5de;
  padding-bottom:5px;
}

/* =========================
   CREDITOS
========================= */

.credito{
  padding:9px 10px;
  border-bottom:1px solid #e3ebe6;
  page-break-inside:avoid;
}

.credito-contenido{
  width:100%;
}

.credito-contenido > strong{
  display:block;
  font-size:13px;
  margin-bottom:3px;
}

.credito-detalle{
  font-size:12px;
}

.credito-detalle b{
  font-weight:900;
}

.sin-datos{
  padding:12px;
  border:1px solid #d9e5de;
  border-radius:8px;
  color:#68766e;
}

/* =========================
   PIE DEL DOCUMENTO
========================= */

.pie{
  position:absolute;
  left:0;
  right:0;
  bottom:8mm;
}

.estado-cliente{
  width:100%;
  background:#22b455;
  color:#101b14;
  text-align:center;
  padding:13px 10px;
  font-size:15px;
  font-weight:700;
}

.nota{
  margin-top:6px;
  color:#68766e;
  font-size:9px;
  text-align:center;
}

/* =========================
   IMPRESION
========================= */

@media print{

  body{
    print-color-adjust:exact;
    -webkit-print-color-adjust:exact;
  }

}

</style>

</head>

<body>

<div class="hoja">

  <div class="cabecera">

    <div class="marca-si">
      SERVICIOS INTEGRALES
    </div>

    <h1>
      Estado de cuenta
    </h1>

  </div>


  <div class="cliente">

    <div class="box">

      <span>
        Nombre y Apellido
      </span>

      <strong>
        ${escaparHtml(datos.nombre)}
      </strong>

    </div>


    <div class="box">

      <span>
        CUIL
      </span>

      <strong>
        ${escaparHtml(datos.cuil)}
      </strong>

    </div>


    <div class="box">

      <span>
        Organismo
      </span>

      <strong>
        ${escaparHtml(datos.organismo)}
      </strong>

    </div>

  </div>


  <div class="resumen">

    <div class="box">

      <span>
        Créditos vigentes
      </span>

      <strong>
        ${escaparHtml(
          datos.creditosVigentes
        )}
      </strong>

    </div>


    <div class="box">

      <span>
        Total de cuotas
      </span>

      <strong>
        ${escaparHtml(
          datos.totalCuotas
        )}
      </strong>

    </div>

  </div>


  <div class="titulo">
    CRÉDITOS VIGENTES
  </div>


  ${creditosHtml}


  <div class="pie">

    <div class="estado-cliente">
      ESTADO DE CUENTA PARA EL CLIENTE
    </div>

    <div class="nota">
      Resumen generado desde Servicios Integrales
      con los datos visibles de la operación.
    </div>

  </div>

</div>


<script>

window.addEventListener("load", () => {

  setTimeout(() => {

    window.print();

  }, 250);

});

<\/script>

</body>

</html>
`;
  }

  function descargarPdfCliente() {
    const ficha = $("#fichaConsolidada");

    if (
      !ficha ||
      ficha.classList.contains("hidden")
    ) {
      alert(
        "Primero consultá un cliente para generar el estado de cuenta."
      );

      return;
    }

    const datos = leerResumenCliente();

    const html = crearHtmlCliente(datos);

    const ventana = window.open(
      "",
      "_blank"
    );

    if (!ventana) {
      alert(
        "El navegador bloqueó la ventana del estado de cuenta. Permití las ventanas emergentes para Servicios Integrales."
      );

      return;
    }

    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  }

  function asegurarEstilos() {
    if ($("#si-resumen-cliente-style")) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "si-resumen-cliente-style";

    style.textContent = `

      /*
        Contenedor compartido de botones PDF.
        Se crea sin modificar renovacion.js
        ni resumen_juan.js.
      */

      #siPdfBotonesWrap{
        margin-top:12px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        width:100%;
      }

      .si-resumen-cliente-btn{
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
      }

      .si-resumen-cliente-btn:hover{
        background:#0d633b;
      }

      /*
        Si el botón de Juan ya existe,
        quitamos solamente el margen de su
        contenedor porque ahora vive dentro
        del contenedor compartido.
      */

      #siPdfBotonesWrap
      #siResumenJuanWrap{
        margin-top:0 !important;
      }

      @media (max-width:620px){

        #siPdfBotonesWrap{
          flex-direction:column;
          align-items:stretch;
        }

        .si-resumen-cliente-btn{
          width:100%;
        }

        #siPdfBotonesWrap
        #siResumenJuanWrap{
          width:100%;
        }

        #siPdfBotonesWrap
        #siResumenJuanBtn{
          width:100%;
        }

      }

    `;

    document.head.appendChild(style);
  }

  function asegurarBotones() {
    const bloque = $("#siRenovacionBloque");

    if (!bloque) {
      return false;
    }

    /*
      Si ya quedó armado, no hacemos nada.
    */

    if ($("#siResumenClienteBtn")) {
      return true;
    }

    /*
      Buscamos el contenedor original
      del botón PDF para Juan.
    */

    const wrapJuan =
      $("#siResumenJuanWrap");

    /*
      Creamos un nuevo contenedor compartido.
    */

    let wrap =
      $("#siPdfBotonesWrap");

    if (!wrap) {
      wrap =
        document.createElement("div");

      wrap.id =
        "siPdfBotonesWrap";

      /*
        Lo colocamos exactamente donde
        actualmente está el botón de Juan.
      */

      if (
        wrapJuan &&
        wrapJuan.parentNode
      ) {
        wrapJuan.parentNode.insertBefore(
          wrap,
          wrapJuan
        );
      } else {
        bloque.appendChild(wrap);
      }
    }

    /*
      Creamos botón CLIENTE.
    */

    const boton =
      document.createElement("button");

    boton.id =
      "siResumenClienteBtn";

    boton.type =
      "button";

    boton.className =
      "si-resumen-cliente-btn";

    boton.textContent =
      "📄 DESCARGAR PDF PARA CLIENTE";

    boton.addEventListener(
      "click",
      descargarPdfCliente
    );

    wrap.appendChild(boton);

    /*
      Movemos el contenedor de Juan
      dentro del mismo bloque.

      NO modificamos su botón,
      NO modificamos sus eventos,
      NO modificamos resumen_juan.js.
    */

    if (wrapJuan) {
      wrap.appendChild(wrapJuan);
    }

    return true;
  }

  function iniciar() {
    asegurarEstilos();

    /*
      resumen_juan.js se carga antes que
      este archivo, pero el bloque de
      renovación puede generarse después.

      Por eso comprobamos primero y,
      si todavía no existe, esperamos
      mediante MutationObserver.
    */

    if (asegurarBotones()) {
      return;
    }

    const observer =
      new MutationObserver(() => {

        if (asegurarBotones()) {
          observer.disconnect();
        }

      });

    observer.observe(
      document.body,
      {
        childList:true,
        subtree:true
      }
    );
  }

  iniciar();

  console.info(
    "[SERVICIOS INTEGRALES] Resumen para Cliente V1 activo."
  );

})();