
/* SERVICIOS INTEGRALES — LEGAJO VISUAL V1
   Interfaz de selección local de DNI. No envía ni almacena documentos todavía.
   Conserva los datos históricos de Supabase y no altera otros módulos.
*/
(() => {
  'use strict';
  const ficha = document.querySelector('#fichaConsolidada');
  if (!ficha) return;

  const style = document.createElement('style');
  style.id = 'si-legajo-visual-style';
  style.textContent = `
    /* Se oculta la interfaz antigua, sin borrar sus datos. */
    #fichaObservacionesBloque, #siGestionBloque, #siHistorialBloque {
      display:none !important;
    }
    .si-legajo {
      margin-top:18px;
      padding:16px;
      border:1px solid #b7dbc6;
      border-radius:14px;
      background:#fff;
    }
    .si-legajo-title {
      margin:0 0 3px;
      color:#0d633b;
      font-size:17px;
      font-weight:900;
    }
    .si-legajo-sub {
      margin:0 0 14px;
      color:#617069;
      font-size:12px;
    }
    .si-legajo-grid {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
    }
    .si-legajo-tile {
      min-height:94px;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:6px;
      padding:12px;
      border:1px solid #dbe9e1;
      border-radius:12px;
      background:#fbfefc;
      text-align:center;
      box-sizing:border-box;
    }
    .si-legajo-icon {
      font-size:22px;
      line-height:1.2;
    }
    .si-legajo-tile strong {
      color:#17231d;
      font-size:14px;
    }
    .si-legajo-note {
      color:#617069;
      font-size:11px;
    }
    .si-legajo-dni {
      display:flex;
      flex-wrap:wrap;
      justify-content:center;
      gap:6px;
    }
    .si-legajo-chip {
      padding:4px 8px;
      border:1px solid #dbe9e1;
      border-radius:999px;
      font-size:11px;
      color:#50635a;
      background:white;
    }
    .si-legajo-chip {cursor:pointer;}
    .si-legajo-chip:focus-visible {outline:2px solid #0d633b;}
    .si-legajo-dni-status {font-size:11px;color:#617069;min-height:14px;}
    .si-legajo-recibos {
      display:flex;
      align-items:center;
      gap:10px;
      margin-top:10px;
      padding:14px;
      border:1px solid #dbe9e1;
      border-radius:12px;
      background:#fbfefc;
      color:#17231d;
      font-size:14px;
    }
    .si-legajo-recibos small {
      display:block;
      margin-top:3px;
      color:#617069;
      font-size:11px;
    }
    @media(max-width:480px) {
      .si-legajo-grid {
        grid-template-columns:1fr;
      }
    }
  `;
  document.head.appendChild(style);

  const bloque = document.createElement('section');
  bloque.id = 'siLegajoBloque';
  bloque.className = 'si-legajo';
  bloque.setAttribute('aria-label', 'Legajo del cliente');
  bloque.innerHTML = `
    <h3 class="si-legajo-title">📁 Legajo del cliente</h3>
    <p class="si-legajo-sub">
      Documentación y gestiones · Carga de DNI en preparación
    </p>
    <div class="si-legajo-grid">
      <div class="si-legajo-tile">
        <span class="si-legajo-icon">🪪</span>
        <strong>DNI</strong>
        <div class="si-legajo-dni">
          <button type="button" class="si-legajo-chip" data-dni="frente">Seleccionar frente</button>
          <button type="button" class="si-legajo-chip" data-dni="dorso">Seleccionar dorso</button>
        </div>
        <div class="si-legajo-dni-status" id="siDniEstado">Todavía no se guardaron documentos.</div>
        <input type="file" id="siDniFrente" accept="application/pdf,image/jpeg" hidden>
        <input type="file" id="siDniDorso" accept="application/pdf,image/jpeg" hidden>
      </div>
      <div class="si-legajo-tile">
        <span class="si-legajo-icon">📄</span>
        <strong>Servicio</strong>
        <span class="si-legajo-note">PDF o imagen</span>
      </div>
      <div class="si-legajo-tile">
        <span class="si-legajo-icon">🏦</span>
        <strong>CBU</strong>
        <span class="si-legajo-note">PDF o imagen</span>
      </div>
      <div class="si-legajo-tile">
        <span class="si-legajo-icon">📝</span>
        <strong>Escrito Creditan</strong>
        <span class="si-legajo-note">Generar y copiar · Próximamente</span>
      </div>
    </div>
    <div class="si-legajo-recibos">
      <span class="si-legajo-icon">🔒</span>
      <div>
        <strong>Acceso a recibos</strong>
        <small>Acceso protegido · Próximamente</small>
      </div>
    </div>
  `;

  const archivos = {frente:null, dorso:null};
  const estado = bloque.querySelector("#siDniEstado");
  bloque.querySelectorAll("[data-dni]").forEach(btn => {
    const lado = btn.dataset.dni;
    const input = bloque.querySelector(lado === "frente" ? "#siDniFrente" : "#siDniDorso");
    btn.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (!["application/pdf", "image/jpeg"].includes(file.type) || file.size > 10 * 1024 * 1024) {
        input.value = "";
        estado.textContent = "Solo PDF o JPG, máximo 10 MB.";
        return;
      }
      archivos[lado] = file;
      btn.textContent = (lado === "frente" ? "Frente" : "Dorso") + ": " + file.name;
      estado.textContent = "Archivos seleccionados localmente. Todavía no se subieron a Supabase.";
    });
  });

  function ubicar() {
    const detalle = document.querySelector('#fichaDetalleCreditos');
    if (detalle && bloque.previousElementSibling !== detalle) {
      detalle.insertAdjacentElement('afterend', bloque);
    } else if (!bloque.isConnected) {
      ficha.appendChild(bloque);
    }
  }

  ubicar();

  const observer = new MutationObserver(() => {
    if (document.querySelector('#fichaDetalleCreditos')) {
      ubicar();
      observer.disconnect();
    }
  });

  if (!document.querySelector('#fichaDetalleCreditos')) {
    observer.observe(ficha, { childList:true });
  }

  console.info('[SI] Legajo: selección local habilitada. Sin subida ni almacenamiento todavía.');
})();
