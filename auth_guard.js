/*
  SERVICIOS INTEGRALES - AUTH GUARD V1

  OBJETIVO:
  - proteger la página principal;
  - si NO hay una sesión válida, redirigir a /login.html;
  - si hay sesión, verificar que el usuario exista y esté activo en public.usuarios;
  - mostrar arriba a la derecha Nombre · Rol · Cerrar sesión.

  IMPORTANTE:
  - NO modifica app.js.
  - NO modifica ficha.js.
  - NO modifica cupo.js.
  - NO modifica connector.js.
  - NO contiene ninguna clave secreta/service_role.
*/

(() => {
  "use strict";

  const SUPABASE_URL = "https://smxcqnahlklkqrxbbrjh.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_am_ucuk2jAJPZRz-aaVJvA_72Z1h2du";

  /*
    Ocultamos la página antes de que se pinte.
    Solo se muestra después de validar sesión + usuario interno.
  */
  document.documentElement.style.visibility = "hidden";

  const LOGIN_URL = "/login.html";

  function irAlLogin() {
    if (location.pathname.toLowerCase().endsWith("/login.html")) return;
    location.replace(LOGIN_URL);
  }

  function mostrarPagina() {
    document.documentElement.style.visibility = "visible";
  }

  function mostrarErrorAcceso(texto) {
    document.documentElement.style.visibility = "visible";

    document.addEventListener(
      "DOMContentLoaded",
      () => {
        document.body.innerHTML = `
          <main style="
            min-height:100vh;
            display:grid;
            place-items:center;
            padding:24px;
            font-family:Arial,Helvetica,sans-serif;
            background:#f4fbf7;
            color:#17231d;
          ">
            <section style="
              width:min(100%,520px);
              background:white;
              border:1px solid #d8e9df;
              border-radius:18px;
              padding:26px;
              box-shadow:0 18px 45px rgba(20,80,50,.10);
            ">
              <h1 style="margin:0 0 10px;font-size:24px;">SERVICIOS INTEGRALES</h1>
              <p style="margin:0 0 18px;line-height:1.5;">${texto}</p>
              <a href="${LOGIN_URL}" style="
                display:flex;
                min-height:46px;
                align-items:center;
                justify-content:center;
                text-decoration:none;
                background:#0f6a3d;
                color:white;
                border-radius:11px;
                font-weight:800;
              ">Ir al acceso</a>
            </section>
          </main>
        `;
      },
      { once: true }
    );
  }

  function inyectarUsuario(supabase, perfil, email) {
    const montar = () => {
      if (document.getElementById("si-user-session")) return;

      const box = document.createElement("div");
      box.id = "si-user-session";
      box.innerHTML = `
        <span class="si-user-name"></span>
        <span class="si-user-sep">·</span>
        <span class="si-user-role"></span>
        <button type="button" class="si-user-logout">Cerrar sesión</button>
      `;

      const style = document.createElement("style");
      style.id = "si-user-session-style";
      style.textContent = `
        #si-user-session{
          position:fixed;
          top:14px;
          right:14px;
          z-index:99999;
          display:flex;
          align-items:center;
          gap:7px;
          padding:9px 11px;
          border:1px solid rgba(15,106,61,.16);
          border-radius:999px;
          background:rgba(255,255,255,.96);
          box-shadow:0 8px 24px rgba(20,80,50,.12);
          color:#17231d;
          font-family:Arial,Helvetica,sans-serif;
          font-size:12px;
        }
        #si-user-session .si-user-name{
          font-weight:800;
        }
        #si-user-session .si-user-role{
          font-weight:800;
          color:#0f6a3d;
        }
        #si-user-session .si-user-sep{
          color:#8a9890;
        }
        #si-user-session .si-user-logout{
          border:0;
          background:#edf8f2;
          color:#0a4f2e;
          border-radius:999px;
          padding:6px 9px;
          font:inherit;
          font-weight:800;
          cursor:pointer;
        }
        #si-user-session .si-user-logout:hover{
          background:#dff2e8;
        }
        @media (max-width:760px){
          #si-user-session{
            position:static;
            margin:10px auto 0;
            width:max-content;
            max-width:calc(100% - 20px);
          }
        }
      `;

      document.head.appendChild(style);
      document.body.appendChild(box);

      box.querySelector(".si-user-name").textContent =
        perfil?.nombre || "Usuario";

      box.querySelector(".si-user-role").textContent =
        perfil?.rol || "USUARIO";

      box.title = email || "";

      box.querySelector(".si-user-logout").addEventListener("click", async () => {
        try {
          await supabase.auth.signOut();
        } finally {
          location.replace(LOGIN_URL);
        }
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", montar, { once: true });
    } else {
      montar();
    }
  }

  async function validarAcceso() {
    try {
      const { createClient } = await import(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
      );

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

      /*
        getUser valida el usuario contra Supabase Auth.
      */
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      const user = userData?.user || null;

      if (userError || !user) {
        irAlLogin();
        return;
      }

      /*
        RLS + auth_user_id determinan si realmente pertenece
        al equipo interno de SERVICIOS INTEGRALES.
      */
      const { data: perfil, error: perfilError } = await supabase
        .from("usuarios")
        .select("id,nombre,email,rol,activo")
        .eq("auth_user_id", user.id)
        .eq("activo", true)
        .maybeSingle();

      if (perfilError || !perfil) {
        try {
          await supabase.auth.signOut();
        } catch (_) {}

        mostrarErrorAcceso(
          "Tu sesión existe, pero este usuario no está habilitado para ingresar al sistema."
        );
        return;
      }

      window.ServiciosIntegralesAuth = {
        supabase,
        user,
        perfil
      };

      inyectarUsuario(supabase, perfil, user.email);
      mostrarPagina();

      console.info(
        `[SERVICIOS INTEGRALES] Acceso autorizado: ${perfil.nombre} · ${perfil.rol}.`
      );
    } catch (error) {
      console.error(
        "[SERVICIOS INTEGRALES] Error validando acceso:",
        error
      );

      mostrarErrorAcceso(
        "No se pudo validar el acceso en este momento. Volvé a intentar desde la pantalla de ingreso."
      );
    }
  }

  /*
    Protección extra: si por algún problema de red la validación
    queda colgada demasiado tiempo, no mostramos la aplicación.
  */
  const timeout = setTimeout(() => {
    if (document.documentElement.style.visibility === "hidden") {
      mostrarErrorAcceso(
        "La validación de acceso está tardando demasiado. Volvé a ingresar al sistema."
      );
    }
  }, 12000);

  validarAcceso().finally(() => clearTimeout(timeout));
})();
