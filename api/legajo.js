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

const BUCKET = 'legajos-clientes';
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
