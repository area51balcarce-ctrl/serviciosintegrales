/*
  SERVICIOS INTEGRALES - MODO INTERNO SIN EMAIL V1

  Cada PC recuerda el usuario elegido.
  No usa Magic Link ni envía correos.

  IMPORTANTE:
  - NO modifica app.js
  - NO modifica ficha.js
  - NO modifica gestion.js
  - NO modifica cupo.js
  - NO modifica connector.js
*/

(() => {
  "use strict";

  const SUPABASE_URL = "https://smxcqnahlklkqrxbbrjh.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_am_ucuk2jAJPZRz-aaVJvA_72Z1h2du";
  const STORAGE_KEY = "si_usuario_local_v1";
  const PERFILES = {"KEVIN": {"id": "c6ffdf55-3fbf-4a97-b3e5-aa8108505b41", "nombre": "Kevin", "email": "kevinebraim55@gmail.com", "rol": "ASESOR"}, "PAMELA": {"id": "8ce7d4d1-2650-4022-8827-913407184b93", "nombre": "Pamela", "email": "pamecajera@gmail.com", "rol": "ASESOR"}, "JUAN": {"id": "d00c9b56-466a-41f3-9263-30390109cf1a", "nombre": "Juan", "email": "s.i.balcarce@gmail.com", "rol": "ADMINISTRADOR"}};

  document.documentElement.style.visibility = "hidden";

  function leerClaveUsuario() {
    return String(localStorage.getItem(STORAGE_KEY) || "")
      .trim()
      .toUpperCase();
  }

  function mostrarPagina() {
    document.documentElement.style.visibility = "visible";
  }

  function irAlSelector() {
    location.replace("/login.html?cambiar=1");
  }

  function montarUsuario(perfil) {
    const montar = () => {
      if (document.getElementById("si-user-session")) return;

      const box = document.createElement("div");
      box.id = "si-user-session";
      box.innerHTML = `
        <span class="si-user-name"></span>
        <span class="si-user-sep">·</span>
        <span class="si-user-role"></span>
        <button type="button" class="si-user-switch">Cambiar usuario</button>
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
        #si-user-session .si-user-name{font-weight:800}
        #si-user-session .si-user-role{font-weight:800;color:#0f6a3d}
        #si-user-session .si-user-sep{color:#8a9890}
        #si-user-session .si-user-switch{
          border:0;
          background:#edf8f2;
          color:#0a4f2e;
          border-radius:999px;
          padding:6px 9px;
          font:inherit;
          font-weight:800;
          cursor:pointer;
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

      box.querySelector(".si-user-name").textContent = perfil.nombre;
      box.querySelector(".si-user-role").textContent = perfil.rol;
      box.title = perfil.email;

      box.querySelector(".si-user-switch").addEventListener("click", () => {
        location.href = "/login.html?cambiar=1";
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", montar, { once:true });
    } else {
      montar();
    }
  }

  async function iniciar() {
    const clave = leerClaveUsuario();
    const perfil = PERFILES[clave] || null;

    if (!perfil) {
      irAlSelector();
      return;
    }

    try {
      const { createClient } = await import(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
      );

      const supabase = createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
          auth:{
            persistSession:false,
            autoRefreshToken:false,
            detectSessionInUrl:false
          }
        }
      );

      window.ServiciosIntegralesAuth = {
        supabase,
        perfil,
        user:{ id:perfil.id, email:perfil.email },
        modo:"INTERNO_SIN_EMAIL"
      };

      montarUsuario(perfil);
      mostrarPagina();
    } catch (error) {
      console.error("[SERVICIOS INTEGRALES] Error iniciando modo interno:", error);
      mostrarPagina();
      alert("No se pudo iniciar SERVICIOS INTEGRALES. Volvé a intentar.");
    }
  }

  iniciar();
})();
