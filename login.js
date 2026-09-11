/*
  SERVICIOS INTEGRALES - SELECTOR INTERNO V1
  No utiliza email ni Magic Link.
*/
(() => {
  "use strict";

  const STORAGE_KEY = "si_usuario_local_v1";
  const VALIDOS = new Set(["KEVIN","PAMELA","JUAN"]);

  function destino(usuario){
    return usuario === "JUAN" ? "/juan.html" : "/";
  }

  const params = new URLSearchParams(location.search);
  const cambiar = params.get("cambiar") === "1";
  const guardado = String(localStorage.getItem(STORAGE_KEY) || "")
    .trim()
    .toUpperCase();

  if(!cambiar && VALIDOS.has(guardado)){
    location.replace(destino(guardado));
    return;
  }

  document.addEventListener("click",(event)=>{
    const btn = event.target.closest("[data-user]");
    if(!btn) return;

    const usuario = String(btn.dataset.user || "").toUpperCase();
    if(!VALIDOS.has(usuario)) return;

    localStorage.setItem(STORAGE_KEY,usuario);
    location.replace(destino(usuario));
  });
})();
