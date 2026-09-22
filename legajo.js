
/* SERVICIOS INTEGRALES — LEGAJO VISUAL V1
   Diseño solamente. No carga ni almacena documentos o contraseñas.
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
      Documentación y gestiones · Diseño visual, pendiente de conexión
    </p>
    <div class="si-legajo-grid">
      <div class="si-legajo-tile">
        <span class="si-legajo-icon">🪪</span>
        <strong>DNI</strong>
        <div class="si-legajo-dni">
          <span class="si-legajo-chip">Frente · PDF o JPG</span>
          <span class="si-legajo-chip">Dorso · PDF o JPG</span>
        </div>
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

  console.info('[SI] Legajo visual V1 activo. Sin carga ni almacenamiento de datos.');
})();