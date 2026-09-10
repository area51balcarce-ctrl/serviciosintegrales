import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://smxcqnahlklkqrxbbrjh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_am_ucuk2jAJPZRz-aaVJvA_72Z1h2du";

const USUARIOS_AUTORIZADOS = new Set([
  "kevinebraim55@gmail.com",
  "pamecajera@gmail.com",
  "s.i.balcarce@gmail.com"
]);

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

const $ = (s) => document.querySelector(s);

const emailInput = $("#emailInput");
const loginBtn = $("#loginBtn");
const logoutBtn = $("#logoutBtn");
const loginPanel = $("#loginPanel");
const sessionPanel = $("#sessionPanel");
const messageBox = $("#messageBox");

function normalizarEmail(valor) {
  return String(valor || "").trim().toLowerCase();
}

function mensaje(texto, error = false) {
  messageBox.textContent = texto;
  messageBox.classList.remove("hidden", "error");
  if (error) messageBox.classList.add("error");
}

function limpiarMensaje() {
  messageBox.classList.add("hidden");
  messageBox.classList.remove("error");
  messageBox.textContent = "";
}

function mostrarLogin() {
  sessionPanel.classList.add("hidden");
  loginPanel.classList.remove("hidden");
}

function mostrarSesion(perfil, email) {
  $("#sessionName").textContent = perfil.nombre || "Usuario";
  $("#sessionRole").textContent = perfil.rol || "USUARIO";
  $("#sessionEmail").textContent = email || "";
  loginPanel.classList.add("hidden");
  sessionPanel.classList.remove("hidden");
}

async function obtenerPerfilInterno(user) {
  if (!user?.id) return null;

  const { data, error } = await supabase
    .from("usuarios")
    .select("id,nombre,email,rol,activo")
    .eq("auth_user_id", user.id)
    .eq("activo", true)
    .maybeSingle();

  if (error) {
    console.error("[SERVICIOS INTEGRALES] Error perfil:", error);
    return null;
  }

  return data || null;
}

async function revisarSesion() {
  limpiarMensaje();

  const { data, error } = await supabase.auth.getUser();
  const user = data?.user || null;

  if (error || !user) {
    mostrarLogin();
    return;
  }

  const perfil = await obtenerPerfilInterno(user);

  if (!perfil) {
    await supabase.auth.signOut();
    mostrarLogin();
    mensaje(
      "Tu correo inició sesión, pero no está habilitado como usuario interno de SERVICIOS INTEGRALES.",
      true
    );
    return;
  }

  mostrarSesion(perfil, user.email);
  mensaje(`Acceso correcto. Bienvenido/a ${perfil.nombre}.`);
}

async function enviarEnlace() {
  limpiarMensaje();

  const email = normalizarEmail(emailInput.value);

  if (!email || !email.includes("@")) {
    mensaje("Ingresá un correo electrónico válido.", true);
    return;
  }

  if (!USUARIOS_AUTORIZADOS.has(email)) {
    mensaje("Ese correo no está autorizado para ingresar al sistema.", true);
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Enviando enlace...";

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/login.html`
      }
    });

    if (error) throw error;

    mensaje("Enlace enviado. Revisá tu correo y abrí el enlace desde esta misma PC.");
  } catch (error) {
    console.error("[SERVICIOS INTEGRALES] Error login:", error);
    mensaje(
      "No se pudo enviar el enlace de acceso. Revisá la configuración de Auth y volvé a intentar.",
      true
    );
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Enviarme enlace de acceso";
  }
}

loginBtn.addEventListener("click", enviarEnlace);

emailInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") enviarEnlace();
});

logoutBtn.addEventListener("click", async () => {
  limpiarMensaje();
  await supabase.auth.signOut();
  mostrarLogin();
  mensaje("Sesión cerrada.");
});

window.addEventListener("load", () => {
  setTimeout(revisarSesion, 250);
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    setTimeout(revisarSesion, 120);
  }
});
