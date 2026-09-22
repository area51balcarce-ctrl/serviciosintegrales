/*
  SERVICIOS INTEGRALES - BOTÓN BCRA V1
  Módulo independiente. No modifica UIF, RePET, Creditan ni los PDF.
  Cargar después de repet_boton.js en index.html.
*/
(() => {
  'use strict';

  const SOURCE_APP = 'SERVICIOS_INTEGRALES';
  const SOURCE_BRIDGE = 'SERVICIOS_INTEGRALES_BCRA_BRIDGE';
  const LOG = '[SERVICIOS INTEGRALES][BOTÓN BCRA]';
  const $ = selector => document.querySelector(selector);
  let ocupada = false;

  function obtenerCuil() {
    const ficha = $('#fichaConsolidada');
    if (!ficha || ficha.classList.contains('hidden') || ficha.hidden) return '';

    const elemento = $('#fichaCuil');
    const valor = elemento?.value !== undefined ? elemento.value : elemento?.textContent;
    return String(valor || '').replace(/\D/g, '');
  }

  function estado(boton, esperando) {
    boton.disabled = esperando;
    boton.textContent = esperando ? '⏳ CONSULTANDO BCRA...' : '🏦 DESCARGAR BCRA';
  }

  function consultarBcra() {
    if (ocupada) return;

    const cuil = obtenerCuil();
    if (cuil.length !== 11) {
      alert('Primero consultá un cliente y verificá que su ficha tenga un CUIL de 11 dígitos.');
      return;
    }

    const boton = $('#siBcraBtn');
    const requestId = 'BCRA_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    ocupada = true;
    estado(boton, true);
    let finalizada = false;
    let timeoutId;

    function terminar() {
      if (finalizada) return false;
      finalizada = true;
      window.removeEventListener('message', recibir);
      clearTimeout(timeoutId);
      ocupada = false;
      estado(boton, false);
      return true;
    }

    function recibir(event) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.source !== SOURCE_BRIDGE || data.type !== 'RESPUESTA_BCRA' || data.requestId !== requestId) return;
      if (!terminar()) return;

      const resultado = data.resultado || {};
      console.info(LOG, resultado);

      if (resultado.ok) {
        // El módulo bcra_bridge.js abre la impresión oficial al cargar los resultados.
        return;
      }
      if (resultado.code === 'BCRA_CAPTCHA_PENDIENTE') {
        alert('El CUIL ya está cargado en el BCRA. Validá Cloudflare manualmente y después volvé a pulsar DESCARGAR BCRA.');
        return;
      }
      alert('No se pudo completar la consulta BCRA.\n\n' + String(resultado.message || resultado.code || 'Error desconocido.'));
    }

    window.addEventListener('message', recibir);
    timeoutId = setTimeout(() => {
      if (terminar()) alert('La consulta BCRA tardó demasiado. Revisá la pestaña del BCRA y el control de Cloudflare.');
    }, 35000);

    window.postMessage({
      source: SOURCE_APP,
      type: 'CONSULTAR_BCRA',
      requestId,
      payload: { cuil }
    }, window.location.origin);
  }

  function asegurarEstilos() {
    if ($('#si-bcra-boton-style')) return;
    const style = document.createElement('style');
    style.id = 'si-bcra-boton-style';
    style.textContent = `
      #siBcraBtn {
        min-height: 42px;
        border: 0;
        border-radius: 10px;
        background: #17231d;
        color: #fff;
        padding: 10px 18px;
        font: inherit;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(23,35,29,.14);
      }
      #siBcraBtn:hover:not(:disabled) { background: #0d633b; }
      #siBcraBtn:disabled { opacity: .65; cursor: wait; }
      @media (max-width: 620px) { #siBcraBtn { width: 100%; } }
    `;
    document.head.appendChild(style);
  }

  function asegurarBoton() {
    if ($('#siBcraBtn')) return true;
    const grupo = $('#siPdfClienteUifGrupo');
    const repet = $('#siRepetBtn');
    if (!grupo || !repet || !grupo.contains(repet)) return false;

    const boton = document.createElement('button');
    boton.id = 'siBcraBtn';
    boton.type = 'button';
    boton.textContent = '🏦 DESCARGAR BCRA';
    boton.addEventListener('click', consultarBcra);
    repet.insertAdjacentElement('afterend', boton);
    console.info(LOG, 'Botón BCRA agregado.');
    return true;
  }

  function iniciar() {
    asegurarEstilos();
    if (asegurarBoton()) return;
    const observer = new MutationObserver(() => {
      if (asegurarBoton()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
