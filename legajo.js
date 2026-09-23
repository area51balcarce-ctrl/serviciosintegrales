
/* SERVICIOS INTEGRALES — LEGAJO V3 — ENLACE DE CORREO Y API
   Selección local de DNI y carga mediante sesión de Supabase Auth.
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
      Documentación y gestiones · DNI con acceso protegido
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
        <button type="button" class="si-legajo-chip" data-elegir-extra="servicio">Seleccionar archivo</button>
        <input type="file" data-archivo-extra="servicio" accept="application/pdf,image/jpeg" hidden>
        <span class="si-legajo-note" data-estado-extra="servicio">PDF o JPG · Máximo 10 MB</span>
        <div class="si-legajo-dni" data-acciones-extra="servicio" style="display:none">
          <button type="button" class="si-legajo-chip" data-guardar-extra="servicio">Guardar Servicio</button>
          <button type="button" class="si-legajo-chip" data-ver-extra="servicio">Ver Servicio</button>
        </div>
      </div>
      <div class="si-legajo-tile">
        <span class="si-legajo-icon">🏦</span>
        <strong>CBU</strong>
        <button type="button" class="si-legajo-chip" data-elegir-extra="cbu">Seleccionar archivo</button>
        <input type="file" data-archivo-extra="cbu" accept="application/pdf,image/jpeg" hidden>
        <span class="si-legajo-note" data-estado-extra="cbu">PDF o JPG · Máximo 10 MB</span>
        <div class="si-legajo-dni" data-acciones-extra="cbu" style="display:none">
          <button type="button" class="si-legajo-chip" data-guardar-extra="cbu">Guardar CBU</button>
          <button type="button" class="si-legajo-chip" data-ver-extra="cbu">Ver CBU</button>
        </div>
      </div>
      <div class="si-legajo-tile">
        <span class="si-legajo-icon">📝</span>
        <strong>Escrito Creditan</strong>
        <button type="button" class="si-legajo-chip" id="siEscritoAbrir">Generar escrito</button>
        <span class="si-legajo-note">Usa la oferta real y la selección del asistente</span>
      </div>
    </div>
    <div class="si-legajo-recibos" style="display:block;text-align:left">
      <strong>🔐 Acceso a recibos</strong>
      <small>Se identifica automáticamente por el CUIL y la repartición del cliente.</small>
      <div id="siRecibosPanel" style="margin-top:12px;display:grid;gap:9px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:9px">
          <div><small>CUIL</small><strong id="siRecibosCuil" style="display:block">—</strong></div>
          <div><small>Repartición</small><strong id="siRecibosSector" style="display:block">—</strong></div>
        </div>
        <label style="font-size:12px">Usuario<br><input id="siRecibosUsuario" autocomplete="off" maxlength="120" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #b7dbc6;border-radius:7px"></label>
        <label style="font-size:12px">Contraseña<br>
          <span style="display:flex;gap:6px"><input id="siRecibosClave" type="password" autocomplete="off" maxlength="256" style="min-width:0;flex:1;padding:8px;border:1px solid #b7dbc6;border-radius:7px">
          <button type="button" id="siRecibosMostrar" class="si-legajo-chip">👁️ Ver</button>
          <button type="button" id="siRecibosCopiar" class="si-legajo-chip">Copiar</button></span>
        </label>
        <div style="display:flex;flex-wrap:wrap;gap:7px">
          <button type="button" id="siRecibosCargar" class="si-legajo-chip">Consultar guardados</button>
          <button type="button" id="siRecibosGuardar" class="si-legajo-chip">💾 Guardar credenciales</button>
          <button type="button" id="siRecibosAbrir" class="si-legajo-chip">🌐 Abrir sistema oficial ↗</button>
        </div>
        <small id="siRecibosEstado" role="status" aria-live="polite">Consultá un cliente para comenzar.</small>
        <small>El sistema oficial usa HTTP: ingresá los datos manualmente y evitá redes públicas.</small>
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

  // LEGAJO V3: acceso independiente mediante enlace por correo y conexión a la API.
  // No modifica el selector interno ni los demás módulos.
  const cuilSeleccion = {frente:null, dorso:null};
  const tileDni = bloque.querySelector('.si-legajo-tile');
  const extra = document.createElement('div');
  extra.className = 'si-legajo-conexion';
  extra.innerHTML = `
    <div id="siLegajoAuth" style="width:100%;margin-top:10px;padding:10px;border:1px solid #dbe9e1;border-radius:10px;background:#fff;text-align:left;font-size:12px">
      <strong>Acceso protegido a documentos</strong>
      <p id="siLegajoAuthEstado" style="margin:7px 0;color:#617069">Preparando acceso…</p>
      <div id="siLegajoAuthInicio" hidden>
        <button type="button" id="siLegajoEnviarCodigo" class="si-legajo-chip">Enviar enlace a mi correo</button>
      </div>
      <button type="button" id="siLegajoSalir" class="si-legajo-chip" hidden style="margin-top:6px">Cerrar acceso a documentos</button>
    </div>
    <div id="siLegajoAcciones" hidden style="margin-top:9px;display:none;gap:6px;flex-wrap:wrap;justify-content:center">
      <button type="button" class="si-legajo-chip" data-subir="frente">Guardar frente</button>
      <button type="button" class="si-legajo-chip" data-ver="frente">Ver frente</button>
      <button type="button" class="si-legajo-chip" data-subir="dorso">Guardar dorso</button>
      <button type="button" class="si-legajo-chip" data-ver="dorso">Ver dorso</button>
    </div>
    <div id="siLegajoOperacion" role="status" aria-live="polite" style="font-size:11px;color:#617069;margin-top:7px"></div>
  `;
  tileDni.appendChild(extra);

  const authPanel = extra.querySelector('#siLegajoAuth');
  const authEstado = extra.querySelector('#siLegajoAuthEstado');
  const inicio = extra.querySelector('#siLegajoAuthInicio');
  const acciones = extra.querySelector('#siLegajoAcciones');
  const operacion = extra.querySelector('#siLegajoOperacion');
  const btnEnviar = extra.querySelector('#siLegajoEnviarCodigo');
  const btnSalir = extra.querySelector('#siLegajoSalir');
  let authClient = null;
  let correo = '';
  let ocupado = false;

  function cuilActual() {
    const texto = document.querySelector('#fichaCuil')?.textContent || '';
    const digitos = texto.replace(/\D/g, '');
    return /^\d{11}$/.test(digitos) ? digitos : null;
  }
  function mensaje(t) { operacion.textContent = t; }
  bloque.querySelectorAll('#siDniFrente, #siDniDorso').forEach(input => {
    input.addEventListener('change', () => {
      const lado = input.id === 'siDniFrente' ? 'frente' : 'dorso';
      cuilSeleccion[lado] = input.files?.length ? cuilActual() : null;
    });
  });
  function habilitar(sesion) {
    const autorizado = Boolean(sesion?.access_token && sesion?.user?.email &&
      sesion.user.email.toLowerCase() === correo.toLowerCase());
    // Con la sesión activa, ocultamos el recuadro completo para evitar cierres accidentales.
    // Si la sesión vence, reaparece el acceso por correo.
    authPanel.hidden = autorizado;
    btnSalir.hidden = true;
    inicio.hidden = autorizado;
    acciones.hidden = !autorizado;
    acciones.style.display = autorizado ? 'flex' : 'none';
    bloque.querySelectorAll('[data-acciones-extra]').forEach(panel => { panel.style.display = autorizado ? 'flex' : 'none'; });
    authEstado.textContent = autorizado
      ? 'Sesión protegida activa: ' + correo
      : 'Para guardar y consultar DNI, solicitá un enlace a ' + correo + '.';
  }
  async function sesionActual() {
    if (!authClient) throw new Error('La conexión de documentos todavía no está disponible.');
    const { data, error } = await authClient.auth.getSession();
    if (error || !data.session) throw new Error('Primero abrí el enlace enviado a tu correo.');
    if (data.session.user.email?.toLowerCase() !== correo.toLowerCase()) {
      await authClient.auth.signOut();
      habilitar(null);
      throw new Error('La cuenta autenticada no corresponde al usuario seleccionado.');
    }
    return data.session;
  }
  async function llamarApi(accion, lado, extension) {
    const cuil = cuilActual();
    if (!cuil) throw new Error('Primero consultá un cliente con CUIL válido.');
    const sesion = await sesionActual();
    const resp = await fetch('/api/legajo', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer ' + sesion.access_token},
      body: JSON.stringify({accion,cuil,lado,...(extension ? {extension} : {})})
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || 'Error al consultar el Legajo (' + resp.status + ').');
    return data;
  }
  async function ejecutar(fn) {
    if (ocupado) return;
    ocupado = true;
    extra.querySelectorAll('button').forEach(b => b.disabled = true);
    try { await fn(); }
    catch (e) { mensaje(e.message || 'No se pudo completar la operación.'); }
    finally {
      ocupado = false;
      extra.querySelectorAll('button').forEach(b => b.disabled = false);
    }
  }
  btnEnviar.addEventListener('click', () => ejecutar(async () => {
    if (!authClient || !correo) throw new Error('Todavía no está listo el acceso al Legajo.');
    authEstado.textContent = 'Enviando enlace…';
    const {error} = await authClient.auth.signInWithOtp({
      email: correo,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: location.origin + '/'
      }
    });
    if (error) throw error;
    authEstado.textContent = 'Te enviamos un enlace a ' + correo + '. Abrilo desde este navegador para activar el Legajo.';
    mensaje('Revisá también la carpeta de correo no deseado. El enlace es de un solo uso.');
  }));
  btnSalir.addEventListener('click', () => ejecutar(async () => {
    if (!authClient) return;
    const {error} = await authClient.auth.signOut();
    if (error) throw error;
    habilitar(null);
    mensaje('Acceso a documentos cerrado.');
  }));
  extra.querySelectorAll('[data-subir]').forEach(btn => btn.addEventListener('click', () => ejecutar(async () => {
    const lado = btn.dataset.subir;
    const file = archivos[lado];
    if (!file) throw new Error('Primero seleccioná el archivo del ' + lado + '.');
    if (!cuilSeleccion[lado] || cuilSeleccion[lado] !== cuilActual())
      throw new Error('El cliente cambió. Volvé a seleccionar el DNI para evitar cargarlo en otro legajo.');
    const extension = file.type === 'application/pdf' ? 'pdf' : 'jpg';
    mensaje('Preparando subida de ' + lado + '…');
    const {url, metodo, tipo} = await llamarApi('preparar_subida', lado, extension);
    const respuesta = await fetch(url, {method: metodo || 'PUT', headers:{'Content-Type':tipo || file.type},body:file});
    if (!respuesta.ok) {
      throw new Error('No se pudo guardar el archivo (' + respuesta.status + '). Si ya existe, no se reemplazó.');
    }
    mensaje('DNI ' + lado + ' guardado correctamente en Supabase.');
    estado.textContent = 'Documento ' + lado + ' guardado en el Legajo.';
  })));
  extra.querySelectorAll('[data-ver]').forEach(btn => btn.addEventListener('click', () => ejecutar(async () => {
    const lado = btn.dataset.ver;
    mensaje('Buscando DNI ' + lado + '…');
    const {url} = await llamarApi('ver', lado);
    const link = document.createElement('a');
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    document.body.appendChild(link); link.click(); link.remove();
    mensaje('Documento abierto. El enlace temporal vence en 60 segundos.');
  })));
  (async () => {
    try {
      // auth_guard.js carga el perfil de forma asíncrona. Esperamos su publicación
      // antes de iniciar el acceso protegido; no cambiamos la autenticación del Legajo.
      let perfil = window.ServiciosIntegralesAuth?.perfil;
      const limiteEspera = Date.now() + 10000;
      while (!perfil?.email && Date.now() < limiteEspera) {
        await new Promise(resolve => setTimeout(resolve, 100));
        perfil = window.ServiciosIntegralesAuth?.perfil;
      }
      if (!perfil?.email) throw new Error('No se encontró el usuario interno actual.');
      correo = perfil.email.trim().toLowerCase();
      const {createClient} = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      authClient = createClient('https://smxcqnahlklkqrxbbrjh.supabase.co',
        'sb_publishable_am_ucuk2jAJPZRz-aaVJvA_72Z1h2du',
        {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit',storageKey:'si_legajo_auth_v1'}});
      const {data,error} = await authClient.auth.getSession();
      if (error) throw error;
      habilitar(data.session);
      authClient.auth.onAuthStateChange((_event,session) => habilitar(session));
    } catch(e) {
      authEstado.textContent = 'No se pudo iniciar el acceso protegido: ' + e.message;
      inicio.hidden = true;
    }
  })();

  // Servicio y CBU: un único archivo de cada tipo, con la misma sesión protegida del DNI.
  // No se guardan archivos seleccionados al cambiar de cliente.
  const extras = { servicio: {archivo:null,cuil:null}, cbu: {archivo:null,cuil:null} };
  for (const tipo of ['servicio', 'cbu']) {
    const entrada = bloque.querySelector(`[data-archivo-extra="${tipo}"]`);
    const elegir = bloque.querySelector(`[data-elegir-extra="${tipo}"]`);
    const etiqueta = bloque.querySelector(`[data-estado-extra="${tipo}"]`);
    const panel = bloque.querySelector(`[data-acciones-extra="${tipo}"]`);
    const guardar = bloque.querySelector(`[data-guardar-extra="${tipo}"]`);
    const ver = bloque.querySelector(`[data-ver-extra="${tipo}"]`);
    const nombre = tipo === 'cbu' ? 'CBU' : 'Servicio';
    elegir.addEventListener('click', () => entrada.click());
    entrada.addEventListener('change', () => {
      const file = entrada.files?.[0];
      if (!file) return;
      if (!['application/pdf','image/jpeg'].includes(file.type) || file.size > 10*1024*1024) {
        entrada.value = '';
        extras[tipo] = {archivo:null,cuil:null};
        etiqueta.textContent = 'Solo PDF o JPG, máximo 10 MB.';
        return;
      }
      const cuil = cuilActual();
      if (!cuil) {
        entrada.value = '';
        etiqueta.textContent = 'Consultá primero un cliente con CUIL válido.';
        return;
      }
      extras[tipo] = {archivo:file,cuil};
      elegir.textContent = 'Archivo: ' + file.name;
      etiqueta.textContent = 'Seleccionado localmente. Aún no se guardó.';
    });
    guardar.addEventListener('click', () => ejecutar(async () => {
      const item = extras[tipo];
      if (!item.archivo) throw new Error('Primero seleccioná el archivo de ' + nombre + '.');
      if (!item.cuil || item.cuil !== cuilActual())
        throw new Error('Cambió el cliente. Volvé a seleccionar el archivo para evitar guardarlo en otro legajo.');
      const extension = item.archivo.type === 'application/pdf' ? 'pdf' : 'jpg';
      etiqueta.textContent = 'Guardando ' + nombre + '…';
      const {url,metodo,tipo:contentType} = await llamarApi('preparar_subida',tipo,extension);
      const respuesta = await fetch(url, {
        method:metodo || 'PUT', headers:{'Content-Type':contentType || item.archivo.type},body:item.archivo
      });
      if (!respuesta.ok) throw new Error('No se pudo guardar ' + nombre + ' (' + respuesta.status + ').');
      etiqueta.textContent = nombre + ' guardado correctamente en Supabase.';
      mensaje(nombre + ' guardado correctamente.');
    }));
    ver.addEventListener('click', () => ejecutar(async () => {
      mensaje('Buscando ' + nombre + '…');
      const {url} = await llamarApi('ver',tipo);
      const link = document.createElement('a');
      link.href=url; link.target='_blank'; link.rel='noopener noreferrer';
      document.body.appendChild(link); link.click(); link.remove();
      mensaje(nombre + ' abierto. El enlace vence en 60 segundos.');
    }));
    // Las acciones se muestran desde habilitar() cuando hay sesión válida.
  }

  // ESCRITO CREDITAN — módulo aislado. Lee el estado público del asistente,
  // sin modificar el simulador, los saldos ni el almacenamiento del Legajo.
  const escritoPanel = document.createElement('section');
  escritoPanel.id = 'siEscritoPanel';
  escritoPanel.hidden = true;
  escritoPanel.style.cssText = 'margin-top:12px;padding:14px;border:1px solid #b7dbc6;border-radius:12px;background:#fbfefc';
  escritoPanel.innerHTML = `
    <h4 style="margin:0 0 8px;color:#0d633b">📝 Escrito Creditan</h4>
    <p style="font-size:12px;color:#617069;margin:0 0 10px">Primero completá el asistente y presioná MOSTRAR OFERTA. Después generá el escrito.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px">
      <label style="font-size:12px">N.º de solicitud<br><input id="siEscritoSolicitud" type="text" inputmode="numeric" autocomplete="off" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #b7dbc6;border-radius:7px"></label>
      <label style="font-size:12px">Enlace de firma digital<br><input id="siEscritoLink" type="url" autocomplete="off" placeholder="https://..." style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #b7dbc6;border-radius:7px"></label>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">
      <button type="button" class="si-legajo-chip" id="siEscritoGenerar">Actualizar vista previa</button>
      <button type="button" class="si-legajo-chip" id="siEscritoCopiar" disabled>Copiar escrito</button>
    </div>
    <p id="siEscritoEstado" role="status" style="font-size:12px;color:#617069"></p>
    <textarea id="siEscritoTexto" readonly spellcheck="false" aria-label="Vista previa del escrito" style="width:100%;min-height:340px;box-sizing:border-box;padding:10px;border:1px solid #dbe9e1;border-radius:8px;resize:vertical;font:13px/1.55 monospace"></textarea>
  `;
  bloque.appendChild(escritoPanel);
  const abrirEscrito = bloque.querySelector('#siEscritoAbrir');
  const solicitudEscrito = escritoPanel.querySelector('#siEscritoSolicitud');
  const linkEscrito = escritoPanel.querySelector('#siEscritoLink');
  const textoEscrito = escritoPanel.querySelector('#siEscritoTexto');
  const estadoEscrito = escritoPanel.querySelector('#siEscritoEstado');
  const copiarEscrito = escritoPanel.querySelector('#siEscritoCopiar');
  let escritoCuil = null;
  let escritoGenerado = '';
  const pesosEscrito = n => Number(n).toLocaleString('es-AR', {minimumFractionDigits:2,maximumFractionDigits:2});

  function construirEscrito() {
    const cuil = cuilActual();
    if (!cuil) throw new Error('Primero consultá un cliente con CUIL válido.');
    const asistente = window.ServiciosIntegralesRenovacion;
    if (typeof asistente?.getEstado !== 'function') throw new Error('El asistente de renovación no está disponible.');
    const e = asistente.getEstado();
    const plan = e?.planCreditan;
    if (!plan?.ok || plan.source !== 'CREDITAN_GRILLA_REAL')
      throw new Error('Primero usá MOSTRAR OFERTA y esperá la respuesta real de Creditan para este importe y estas cuotas.');
    if (!Number.isFinite(e.importeFirmar) || e.importeFirmar <= 0 || !Number.isInteger(e.cuotas) || e.cuotas <= 0 ||
        Math.abs(Number(plan.capital)-e.importeFirmar) >= 0.02 || Number(plan.cuotas) !== e.cuotas ||
        !(Number(plan.cuota)>0) || !(Number(plan.neto)>0) || !(Number(plan.enMano)>0))
      throw new Error('La oferta real está incompleta o no coincide con el importe y las cuotas actuales. Volvé a consultar MOSTRAR OFERTA.');
    const solicitud = solicitudEscrito.value.trim();
    const link = linkEscrito.value.trim();
    if (!/^\d+$/.test(solicitud)) throw new Error('Ingresá el número de solicitud de Creditan.');
    if (!/^https:\/\/\S+$/i.test(link)) throw new Error('Pegá el enlace HTTPS de firma digital de Creditan.');
    const creditos = Array.isArray(e.creditos) ? e.creditos : [];
    if (creditos.length > 1) throw new Error('Hay varios créditos seleccionados. El modelo recibido muestra uno solo; verificá el caso antes de generar.');
    const renovacion = creditos.length === 1;
    if (renovacion && (!(Number(creditos[0].saldo)>0) || !creditos[0].operacion))
      throw new Error('Falta el número de operación o el saldo del crédito que se cancela.');
    if (!Number.isFinite(e.comision) || e.comision <= 0 || !Number.isFinite(e.enManoFinal) || e.enManoFinal <= 0)
      throw new Error('No se pudo validar la comisión o el dinero en mano. Revisá los datos del asistente.');
    // El neto y el en mano provienen del estado del asistente; la cuota de la grilla real.
    const tipo = renovacion
      ? `CANCELA CRÉDITO NÚMERO ${creditos[0].operacion} CON UN SALDO DE $${pesosEscrito(creditos[0].saldo)} Y 5% $${pesosEscrito(e.cincoPorCiento)}`
      : 'Sin renovacion';
    return `Hola buenos dias.\n\nRemito para depositarle.\n\nFIRMA: DIGITAL COMPLETADA\n\nPlan seleccionado: ${renovacion ? 'RENOVACION' : 'PARALELO'}\n\nN° SOLICITUD: ${solicitud}\n\nCapital\n${pesosEscrito(e.importeFirmar)}\n\nNeto\n${pesosEscrito(e.netoBase)}\n\nEn mano\n${pesosEscrito(e.enManoFinal)}\n\nCuotas\n${e.cuotas}\n\nImporte\n${pesosEscrito(plan.cuota)}\n\nComisión:\n${pesosEscrito(e.comision)}\n\nTipo\n${tipo}\n\nLink firma digital:\n${link}\n\nMuchas gracias.`.replace(/\\n/g,'\n');
  }

  abrirEscrito.addEventListener('click', () => {
    const actual = cuilActual();
    if (escritoCuil !== actual) {
      solicitudEscrito.value = '';
      linkEscrito.value = '';
      textoEscrito.value = '';
      escritoGenerado = '';
      copiarEscrito.disabled = true;
      escritoCuil = actual;
    }
    escritoPanel.hidden = !escritoPanel.hidden;
    if (!escritoPanel.hidden) escritoPanel.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
  escritoPanel.querySelector('#siEscritoGenerar').addEventListener('click', () => {
    escritoGenerado = '';
    copiarEscrito.disabled = true;
    textoEscrito.value = '';
    try {
      if (escritoCuil !== cuilActual()) throw new Error('Cambió el cliente. Volvé a abrir el generador.');
      escritoGenerado = construirEscrito();
      textoEscrito.value = escritoGenerado;
      copiarEscrito.disabled = false;
      estadoEscrito.textContent = 'Escrito preparado. Revisá los importes antes de enviarlo.';
    } catch (error) { estadoEscrito.textContent = error.message; }
  });
  copiarEscrito.addEventListener('click', async () => {
    if (!escritoGenerado || escritoCuil !== cuilActual()) {
      estadoEscrito.textContent = 'El cliente cambió. Volvé a generar el escrito.';
      copiarEscrito.disabled = true;
      return;
    }
    try {
      await navigator.clipboard.writeText(escritoGenerado);
      estadoEscrito.textContent = 'Escrito copiado. Revisalo antes de enviar el correo.';
    } catch (_) {
      textoEscrito.focus(); textoEscrito.select();
      estadoEscrito.textContent = 'No se pudo copiar automáticamente. Seleccioná el texto y presioná Ctrl+C.';
    }
  });
  for (const input of [solicitudEscrito,linkEscrito]) input.addEventListener('input', () => {
    escritoGenerado=''; copiarEscrito.disabled=true;
    estadoEscrito.textContent='Actualizá la vista previa después de modificar los datos.';
  });

   // ACCESO A RECIBOS: módulo independiente; no modifica el Escrito ni los documentos.
   const panelRecibos = bloque.querySelector('#siRecibosPanel');
   const rc = id => panelRecibos.querySelector('#' + id);
   const rUsuario = rc('siRecibosUsuario');
   const rClave = rc('siRecibosClave');
   const rEstado = rc('siRecibosEstado');
   const rCargar = rc('siRecibosCargar');
   const rGuardar = rc('siRecibosGuardar');
   const rAbrir = rc('siRecibosAbrir');
   const rCopiar = rc('siRecibosCopiar');
   const rMostrar = rc('siRecibosMostrar');
   const portalesRecibos = {
     hospital: 'http://hospitalfossati.dyndns.org:2000/recibos/recibos.html',
     municipio: 'http://201.231.185.115:8080/recibodigital/Recibos.html'
   };
   let rIdentidad = '';
   let rConsulta = 0;
   let rOcupado = false;
   function sectorRecibos() {
     const organismo = String(document.querySelector('#fichaOrganismo')?.textContent || '')
       .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
     if (/HOSPITAL|FOSSATI/.test(organismo)) return 'hospital';
     if (/MUNICIP|MUNICIPAL/.test(organismo)) return 'municipio';
     return null;
   }
   function refrescarRecibos() {
     const cuil = cuilActual();
     const sector = sectorRecibos();
     const identidad = (cuil || '') + '|' + (sector || '');
     if (identidad !== rIdentidad) {
       rIdentidad = identidad;
       rConsulta++;
       rUsuario.value = '';
       rClave.value = '';
       rClave.type = 'password';
       rMostrar.textContent = '👁️ Ver';
       rEstado.textContent = !cuil ? 'Primero consultá un cliente.' :
         !sector ? 'Repartición no identificada: no se puede guardar hasta confirmar Hospital o Municipio.' :
         'Cliente identificado. Podés consultar o guardar sus credenciales.';
     }
     rc('siRecibosCuil').textContent = cuil || '—';
     rc('siRecibosSector').textContent = sector === 'hospital' ? '🏥 Hospital Fossati' :
       sector === 'municipio' ? '🏛️ Municipio' : 'No identificada';
     for (const boton of [rCargar,rGuardar,rAbrir]) boton.disabled = !cuil || !sector || rOcupado;
     return {cuil,sector,identidad};
   }
   const nodoCuil = document.querySelector('#fichaCuil');
   const nodoOrganismo = document.querySelector('#fichaOrganismo');
   const rObserver = new MutationObserver(refrescarRecibos);
   for (const nodo of [nodoCuil,nodoOrganismo]) if (nodo)
     rObserver.observe(nodo,{childList:true,characterData:true,subtree:true});
   refrescarRecibos();
   async function ejecutarRecibos(fn) {
     if (rOcupado) return;
     const antes = refrescarRecibos();
     if (!antes.cuil || !antes.sector) return;
     rOcupado = true;
     refrescarRecibos();
     const secuencia = ++rConsulta;
     try { await fn(antes,secuencia); }
     catch(e) { if (rIdentidad === antes.identidad && rConsulta === secuencia)
       rEstado.textContent = e.message || 'No se pudo completar la operación.'; }
     finally { rOcupado = false; refrescarRecibos(); }
   }
   async function apiRecibos(accion, datos) {
     const sesion = await sesionActual();
     const resp = await fetch('/api/legajo', {
       method:'POST',
       headers:{'Content-Type':'application/json','Authorization':'Bearer ' + sesion.access_token},
       body:JSON.stringify({accion,...datos}),
       cache:'no-store'
     });
     const data = await resp.json().catch(() => ({}));
     if (!resp.ok) throw new Error(data.error || 'No se pudo consultar el Legajo.');
     return data;
   }
   rCargar.addEventListener('click', () => ejecutarRecibos(async (antes,secuencia) => {
     rEstado.textContent = 'Consultando credenciales…';
     const data = await apiRecibos('recibos_ver',{cuil:antes.cuil});
     if (rIdentidad !== antes.identidad || rConsulta !== secuencia) return;
     if (!data.existe) { rUsuario.value=''; rClave.value='';
       rEstado.textContent='Este cliente todavía no tiene credenciales guardadas.'; return; }
     if (data.sector !== antes.sector) {
       rUsuario.value=''; rClave.value='';
       rEstado.textContent='La repartición guardada no coincide con la ficha. Revisá antes de continuar.';
       return;
     }
     rUsuario.value = data.usuario;
     rClave.value = data.contrasena;
     rEstado.textContent = 'Credenciales recuperadas de forma segura.';
   }));
   rGuardar.addEventListener('click', () => ejecutarRecibos(async (antes,secuencia) => {
     const usuario = rUsuario.value.trim();
     const contrasena = rClave.value;
     if (!usuario || !contrasena) throw new Error('Completá usuario y contraseña.');
     if (!confirm('¿Guardar las credenciales para el CUIL ' + antes.cuil + ' (' + antes.sector + ')?')) return;
     rEstado.textContent = 'Guardando credenciales…';
     await apiRecibos('recibos_guardar',{cuil:antes.cuil,sector:antes.sector,usuario,contrasena});
     if (rIdentidad === antes.identidad && rConsulta === secuencia)
       rEstado.textContent = 'Usuario y contraseña guardados correctamente.';
   }));
   rAbrir.addEventListener('click', () => {
     const {cuil,sector} = refrescarRecibos();
     if (!cuil || !sector) return;
     window.open(portalesRecibos[sector], '_blank', 'noopener,noreferrer');
   });
   rMostrar.addEventListener('click', () => {
     rClave.type = rClave.type === 'password' ? 'text' : 'password';
     rMostrar.textContent = rClave.type === 'password' ? '👁️ Ver' : '🙈 Ocultar';
   });
   rCopiar.addEventListener('click', async () => {
     if (!rClave.value || !refrescarRecibos().cuil) return;
     try { await navigator.clipboard.writeText(rClave.value); rEstado.textContent='Contraseña copiada.'; }
     catch (_) { rEstado.textContent='No se pudo copiar. Usá el botón Ver y copiala manualmente.'; }
   });

  console.info('[SI] Legajo V3: enlace por correo y sesión protegida.');
})();
