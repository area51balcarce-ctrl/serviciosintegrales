/* SERVICIOS INTEGRALES — api/legajo.js
 * API privada para DNI frente/dorso, Servicio y CBU. NO acepta el selector local como autenticación.
 * Requiere sesión real de Supabase Auth y una lista de correos autorizados.
 * No usa paquetes externos. Node.js / Vercel Serverless Function.
 *
 * Variables en Vercel (Production):
 * SUPABASE_URL
 * SUPABASE_SERVICE_ROLE_KEY
 * LEGAJO_ALLOWED_EMAILS  (correos separados por coma)
 *
 * POST /api/legajo
 * Authorization: Bearer <access_token de Supabase Auth>
 * JSON: { accion: 'preparar_subida' | 'ver' | 'estado', cuil: '20...', lado: 'frente'|'dorso', extension: 'jpg'|'jpeg'|'pdf'|'png' }
 *
 * preparar_subida: devuelve URL firmada temporal para subir directamente a Storage.
 * ver: devuelve URL firmada temporal para ver el archivo.
 * estado: comprueba si existe un documento para ese lado.
 *
 * ATENCIÓN: el login actual no obtiene access_token. No conectar esta API a
 * legajo.js hasta incorporar Supabase Auth real para los usuarios autorizados.
 */

import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';

const BUCKET = 'legajos-clientes';
const TABLA_RECIBOS = 'legajo_accesos_recibos';
function claveRecibos() {
  const key = Buffer.from(process.env.LEGAJO_RECIBOS_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('Clave de cifrado de recibos no configurada');
  return key;
}
function cifrarRecibo(valor) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', claveRecibos(), iv);
  const data = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(x => x.toString('base64')).join('.');
}
function descifrarRecibo(valor) {
  const [iv, tag, data] = String(valor).split('.').map(x => Buffer.from(x || '', 'base64'));
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Credencial cifrada inválida');
  const decipher = createDecipheriv('aes-256-gcm', claveRecibos(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
const sectoresRecibos = ['hospital', 'municipio'];

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };

function errorStorage(data) {
  // No registrar tokens, URLs firmadas ni datos personales.
  const codigo = typeof data?.error === 'string' ? data.error : data?.errorCode;
  const mensaje = typeof data?.message === 'string' ? data.message : '';
  return { codigo: String(codigo || 'sin_codigo').slice(0, 80), mensaje: String(mensaje || 'Sin detalle').slice(0, 250) };
}

function responder(res, codigo, datos) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(codigo).json(datos);
}

async function supabaseFetch(url, key, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return responder(res, 405, { error: 'Método no permitido' });
  }

  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const permitidos = new Set(
    String(process.env.LEGAJO_ALLOWED_EMAILS || '')
      .split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
  );
  if (!/^https:\/\/.+\.supabase\.co$/.test(base) || !serviceKey || !permitidos.size) {
    return responder(res, 503, { error: 'Configuración de seguridad incompleta' });
  }

  // Una clave de usuario elegida en localStorage NO sirve para acceder a DNI.
  const token = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''))?.[1];
  if (!token) return responder(res, 401, { error: 'Iniciá sesión para acceder al Legajo' });

  try {
    // Supabase valida el JWT y devuelve el usuario auténtico, no el declarado por el navegador.
    const authResp = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${token}` }
    });
    if (!authResp.ok) return responder(res, 401, { error: 'Sesión inválida o vencida' });
    const usuario = await authResp.json();
    const correo = String(usuario.email || '').trim().toLowerCase();
    if (!usuario.id || !usuario.email_confirmed_at || !permitidos.has(correo)) {
      return responder(res, 403, { error: 'Usuario no autorizado para el Legajo' });
    }

    const { accion, cuil, lado, extension } = req.body || {};
    if (['recibos_ver', 'recibos_guardar'].includes(accion)) {
      if (!/^\d{11}$/.test(String(cuil || ''))) return responder(res, 400, {error:'CUIL inválido'});
      if (!process.env.LEGAJO_RECIBOS_KEY) return responder(res, 503, {error:'Falta configurar el cifrado de recibos'});
      const endpoint = `${base}/rest/v1/${TABLA_RECIBOS}`;
      if (accion === 'recibos_guardar') {
        const sector = String(req.body.sector || '').toLowerCase();
        const usuarioRecibo = String(req.body.usuario || '').trim();
        const claveRecibo = String(req.body.contrasena || '');
        if (!sectoresRecibos.includes(sector) || !usuarioRecibo || usuarioRecibo.length > 120 ||
            !claveRecibo || claveRecibo.length > 256) {
          return responder(res, 400, {error:'Revisá el sector, usuario y contraseña'});
        }
        const r = await supabaseFetch(endpoint + '?on_conflict=cuil', serviceKey, {
          method:'POST',
          headers:{'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal'},
          body:JSON.stringify({cuil:String(cuil), sector, usuario:usuarioRecibo,
            contrasena_cifrada:cifrarRecibo(claveRecibo), actualizado_en:new Date().toISOString()})
        });
        if (!r.ok) {
          console.error('[LEGAJO] Error al guardar acceso a recibos',r.status);
          return responder(res,502,{error:'No se pudieron guardar las credenciales'});
        }
        return responder(res,200,{ok:true});
      }
      const r = await supabaseFetch(endpoint + '?cuil=eq.' + encodeURIComponent(cuil) +
        '&select=sector,usuario,contrasena_cifrada&limit=1', serviceKey);
      if (!r.ok) return responder(res,502,{error:'No se pudo consultar el acceso a recibos'});
      const registros = await r.json();
      if (!registros?.length) return responder(res,200,{existe:false});
      const registro = registros[0];
      // El cliente nunca recibe el texto cifrado, solamente los datos solicitados por un usuario autorizado.
      return responder(res,200,{existe:true,sector:registro.sector,usuario:registro.usuario,
        contrasena:descifrarRecibo(registro.contrasena_cifrada)});
    }
    // SELFIES: múltiples fotos por cliente, sin sobrescritura. Misma sesión protegida.
    if (['selfies_preparar', 'selfies_listar', 'selfies_ver'].includes(accion)) {
      if (!/^\d{11}$/.test(String(cuil || ''))) return responder(res, 400, {error:'CUIL inválido'});
      const carpetaSelfies = `${cuil}/selfies`;
      if (accion === 'selfies_preparar') {
        if (!['jpg', 'jpeg', 'png'].includes(extension)) return responder(res, 400, {error:'Solo JPG o PNG'});
        const nombreSelfie = `${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID()}.${extension}`;
        const ruta = `${carpetaSelfies}/${nombreSelfie}`;
        const r = await supabaseFetch(`${base}/storage/v1/object/upload/sign/${BUCKET}/${ruta}`, serviceKey, {
          method:'POST', headers:{'Content-Type':'application/json','x-upsert':'false'}, body:JSON.stringify({upsert:false})
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.token) return responder(res, 502, {error:'No se pudo preparar la selfie'});
        return responder(res, 200, {url:`${base}/storage/v1/object/upload/sign/${BUCKET}/${ruta}?token=${encodeURIComponent(data.token)}`,
          metodo:'PUT',tipo:MIME[extension],nombre:nombreSelfie});
      }
      const r = await supabaseFetch(`${base}/storage/v1/object/list/${BUCKET}`,serviceKey,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({prefix:carpetaSelfies,limit:1000,sortBy:{column:'name',order:'desc'}})
      });
      if (!r.ok) return responder(res,502,{error:'No se pudieron consultar las selfies'});
      const objetos = await r.json().catch(() => []);
      const fotos = (Array.isArray(objetos)?objetos:[])
        .filter(x => /^[0-9TZ-]+_[0-9a-f-]{36}\.(jpg|jpeg|png)$/i.test(x.name))
        .map(x => ({nombre:x.name,fecha:x.created_at || x.updated_at || null}));
      if (accion === 'selfies_listar') return responder(res,200,{fotos,limite:1000});
      const nombreSelfie = String(req.body.nombre || '');
      if (!fotos.some(x => x.nombre === nombreSelfie)) return responder(res,404,{error:'Selfie no encontrada'});
      const ruta = `${carpetaSelfies}/${nombreSelfie}`;
      const firma = await supabaseFetch(`${base}/storage/v1/object/sign/${BUCKET}/${ruta}`,serviceKey,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:60})
      });
      const data = await firma.json().catch(() => ({}));
      if (!firma.ok || !data.signedURL) return responder(res,502,{error:'No se pudo abrir la selfie'});
      return responder(res,200,{url:data.signedURL.startsWith('http')?data.signedURL:
        `${base}/storage/v1${data.signedURL.startsWith('/')?'':'/'}${data.signedURL}`,venceEnSegundos:60});
    }
    if (!/^\d{11}$/.test(String(cuil || '')) || !['frente', 'dorso', 'servicio', 'cbu'].includes(lado)) {
      return responder(res, 400, { error: 'CUIL o tipo de documento inválido' });
    }
    if (!['preparar_subida', 'ver', 'estado'].includes(accion)) {
      return responder(res, 400, { error: 'Acción no admitida' });
    }

    // Un único nombre por lado: permite reemplazar documentos sin crear copias dispersas.
    // La extensión se conserva en un manifiesto? No: al consultar, buscamos entre las admitidas.
    const carpeta = ['frente', 'dorso'].includes(lado) ? 'dni' : lado;
    const nombre = ['frente', 'dorso'].includes(lado) ? lado : 'documento';
    const prefijo = `${cuil}/${carpeta}/${nombre}`;
    const opciones = ['pdf', 'jpg', 'jpeg', 'png'];

    if (accion === 'preparar_subida') {
      if (!Object.hasOwn(MIME, extension)) {
        return responder(res, 400, { error: 'Formato no admitido' });
      }
      // Si ya existe otro formato, evitamos dejar dos versiones del mismo documento.
      const previo = await supabaseFetch(`${base}/storage/v1/object/list/${BUCKET}`, serviceKey, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: `${cuil}/${carpeta}`, limit: 100 })
      });
      if (!previo.ok) return responder(res, 502, { error: 'No se pudo comprobar el documento anterior' });
      const previos = await previo.json().catch(() => []);
      if (Array.isArray(previos) && previos.some(x => opciones.some(ext => x.name === `${nombre}.${ext}`) && x.name !== `${nombre}.${extension}`)) {
        return responder(res, 409, { error: 'Ya existe este documento en otro formato. Para reemplazarlo, usá el mismo formato o solicitá revisar el anterior.' });
      }
      const ruta = `${prefijo}.${extension}`;
      const r = await supabaseFetch(
        `${base}/storage/v1/object/upload/sign/${BUCKET}/${ruta}`,
        serviceKey,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-upsert': 'true' }, body: JSON.stringify({ upsert: true }) }
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.token) {
        const detalle = errorStorage(data);
        console.error('[LEGAJO] Falló firma de subida', { estado: r.status, ...detalle });
        return responder(res, 502, { error: 'No se pudo preparar la subida', detalle: `${detalle.codigo}: ${detalle.mensaje}` });
      }
      // El navegador hace PUT al endpoint firmado, con Content-Type correspondiente.
      // El token de subida es temporal; no guardarlo en GitHub ni en localStorage.
      const url = `${base}/storage/v1/object/upload/sign/${BUCKET}/${ruta}?token=${encodeURIComponent(data.token)}`;
      return responder(res, 200, { url, metodo: 'PUT', tipo: MIME[extension], ruta });
    }

    // Detectar el archivo existente sin dar permisos de listado al navegador.
    const listResp = await supabaseFetch(`${base}/storage/v1/object/list/${BUCKET}`, serviceKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: `${cuil}/${carpeta}`, limit: 100 })
    });
    if (!listResp.ok) {
      const detalle = errorStorage(await listResp.json().catch(() => ({})));
      console.error('[LEGAJO] Falló listado', { estado: listResp.status, ...detalle });
      return responder(res, 502, { error: 'No se pudo consultar el Legajo', detalle: `${detalle.codigo}: ${detalle.mensaje}` });
    }
    const objetos = await listResp.json();
    const encontrados = (Array.isArray(objetos) ? objetos : [])
      .filter(x => opciones.some(ext => x.name === `${nombre}.${ext}`));
    if (accion === 'estado') return responder(res, 200, { existe: encontrados.length > 0 });
    if (!encontrados.length) return responder(res, 404, { error: 'Documento no cargado' });
    if (encontrados.length > 1) {
      return responder(res, 409, { error: 'Hay varios formatos para este lado. Revisar antes de abrir.' });
    }
    const ruta = `${cuil}/${carpeta}/${encontrados[0].name}`;
    const r = await supabaseFetch(`${base}/storage/v1/object/sign/${BUCKET}/${ruta}`, serviceKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 60 })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.signedURL) {
      const detalle = errorStorage(data);
      console.error('[LEGAJO] Falló firma de lectura', { estado: r.status, ...detalle });
      return responder(res, 502, { error: 'No se pudo abrir el documento', detalle: `${detalle.codigo}: ${detalle.mensaje}` });
    }
    // Supabase devuelve una ruta relativa a /storage/v1, no a la raíz del dominio.
    const urlLectura = data.signedURL.startsWith('http')
      ? data.signedURL
      : `${base}/storage/v1${data.signedURL.startsWith('/') ? '' : '/'}${data.signedURL}`;
    return responder(res, 200, {
      url: urlLectura,
      venceEnSegundos: 60
    });
  } catch (err) {
    console.error('[LEGAJO] Error interno:', err?.message || 'Error desconocido');
    return responder(res, 500, { error: 'Error interno del Legajo' });
  }
}
