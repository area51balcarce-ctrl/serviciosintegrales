
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
      const perfil = window.ServiciosIntegralesAuth?.perfil;
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

  console.info('[SI] Legajo V3: enlace por correo y sesión protegida.');
})();
