const $=s=>document.querySelector(s);
const cuilInput=$("#cuilInput"),organismoSelect=$("#organismoSelect"),consultarBtn=$("#consultarBtn"),limpiarBtn=$("#limpiarBtn"),messageBox=$("#messageBox"),clientCard=$("#clientCard"),creditsList=$("#creditsList"),creditTemplate=$("#creditTemplate"),fichaConsolidada=$("#fichaConsolidada");
const fmtMoney=new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:2,maximumFractionDigits:2});

let ultimoEstadoFicha=null;
let cupoFicha={cuil:"",texto:"Pendiente",negative:false};

function normalizeCuil(v){return String(v||"").replace(/\D/g,"").slice(0,11)}
function formatCuil(v){const d=normalizeCuil(v);if(d.length<=2)return d;if(d.length<=10)return`${d.slice(0,2)}-${d.slice(2)}`;return`${d.slice(0,2)}-${d.slice(2,10)}-${d.slice(10)}`}
function showMessage(t){messageBox.textContent=t;messageBox.classList.remove("hidden")}
function clearUI(){
  messageBox.classList.add("hidden");
  clientCard.classList.add("hidden");
  fichaConsolidada?.classList.add("hidden");
  creditsList.innerHTML="";
  ultimoEstadoFicha=null
}
function setText(root,field,value){const el=root.querySelector(`[data-field="${field}"]`);if(el)el.textContent=value}

/*
  FICHA INTERNA CONSOLIDADA
  Solo copia datos que YA fueron renderizados por el Estado de Cuenta.
  No modifica el resultado de Creditan ni recalcula saldos/cuotas.
*/
function leerCupoParaCuil(cuil){
  const limpio=normalizeCuil(cuil);
  if(limpio.length!==11||cupoFicha.cuil!==limpio){
    return{texto:"Pendiente",negative:false}
  }
  return{texto:cupoFicha.texto,negative:cupoFicha.negative}
}

function renderFicha(){
  if(!ultimoEstadoFicha||!fichaConsolidada)return;

  const cupo=leerCupoParaCuil(ultimoEstadoFicha.cuil);

  $("#fichaNombre").textContent=ultimoEstadoFicha.nombre||"CLIENTE";
  $("#fichaCuil").textContent=formatCuil(ultimoEstadoFicha.cuil);
  $("#fichaOrganismo").textContent=ultimoEstadoFicha.organismo||"—";
  $("#fichaCupo").textContent=cupo.texto;
  $("#fichaVigentes").textContent=ultimoEstadoFicha.vigentes;
  $("#fichaCuotasTotal").textContent=fmtMoney.format(ultimoEstadoFicha.cuotaTotal);
  $("#fichaSaldoTotal").textContent=fmtMoney.format(ultimoEstadoFicha.saldoTotal);

  const fichaCupo=$(".ficha-cupo");
  if(fichaCupo)fichaCupo.classList.toggle("negative",cupo.negative);

  fichaConsolidada.classList.remove("hidden")
}

function actualizarFichaDesdeEstado(data){
  const credits=Array.isArray(data?.creditos)?data.creditos:[];

  ultimoEstadoFicha={
    nombre:data?.nombre||"CLIENTE",
    cuil:data?.cuil||"",
    organismo:data?.organismo||"—",
    vigentes:credits.length,
    cuotaTotal:credits.reduce((a,c)=>a+Number(c.valorCuota||0),0),
    saldoTotal:credits.reduce((a,c)=>a+Number(c.saldoCapital||0),0)
  };

  renderFicha()
}

function capturarCupoVisible(){
  const resultCard=$("#resultCard");
  const cupoFinal=$("#cupoFinal");

  if(!resultCard||!cupoFinal)return;

  if(!resultCard.classList.contains("show")){
    cupoFicha={cuil:"",texto:"Pendiente",negative:false};
    if(ultimoEstadoFicha)renderFicha();
    return
  }

  const cuil=normalizeCuil(cuilInput.value);

  cupoFicha={
    cuil:cuil.length===11?cuil:"",
    texto:String(cupoFinal.textContent||"Pendiente").trim()||"Pendiente",
    negative:resultCard.classList.contains("negative")
  };

  if(ultimoEstadoFicha)renderFicha()
}

function observarCupo(){
  const resultCard=$("#resultCard");
  const cupoFinal=$("#cupoFinal");
  if(!resultCard||!cupoFinal)return;

  const observer=new MutationObserver(capturarCupoVisible);
  observer.observe(resultCard,{attributes:true,attributeFilter:["class"]});
  observer.observe(cupoFinal,{childList:true,characterData:true,subtree:true})
}

/*
  ESTADO DE CUENTA:
  BLOQUE CONSERVADO. Solo se agregó al final actualizarFichaDesdeEstado(data).
*/
function renderCredit(c){
  const node=creditTemplate.content.firstElementChild.cloneNode(true);
  setText(node,"operacion",c.operacion??"—");
  setText(node,"solicitud",c.solicitud??"—");
  setText(node,"capital",fmtMoney.format(Number(c.capital||0)));
  setText(node,"cuotas",c.cuotas??"—");
  setText(node,"valorCuota",fmtMoney.format(Number(c.valorCuota||0)));
  setText(node,"proximoPeriodo",c.proximoPeriodo||"—");
  setText(node,"saldoCapital",fmtMoney.format(Number(c.saldoCapital||0)));
  const tbody=node.querySelector('[data-field="cuotasTable"]');
  (c.detalleCuotas||[]).forEach(i=>{
    const tr=document.createElement("tr");
    if(i.recomendada)tr.classList.add("recommended");
    [i.cuota,i.vence,fmtMoney.format(Number(i.monto||0)),fmtMoney.format(Number(i.saldo||0)),fmtMoney.format(Number(i.saldoCapital||0))].forEach(v=>{
      const td=document.createElement("td");
      td.textContent=v??"—";
      tr.appendChild(td)
    });
    tbody.appendChild(tr)
  });
  return node
}

function renderEstado(data){
  $("#clientName").textContent=data.nombre||"CLIENTE";
  $("#clientCuil").textContent=formatCuil(data.cuil);
  $("#clientOrganismo").textContent=data.organismo||"—";
  const credits=Array.isArray(data.creditos)?data.creditos:[];
  $("#vigentesCount").textContent=credits.length;
  $("#cuotaTotal").textContent=fmtMoney.format(credits.reduce((a,c)=>a+Number(c.valorCuota||0),0));
  $("#saldoTotal").textContent=fmtMoney.format(credits.reduce((a,c)=>a+Number(c.saldoCapital||0),0));
  creditsList.innerHTML="";
  credits.forEach(c=>creditsList.appendChild(renderCredit(c)));
  clientCard.classList.remove("hidden");

  actualizarFichaDesdeEstado(data)
}

cuilInput.addEventListener("input",e=>e.target.value=formatCuil(e.target.value));

consultarBtn.addEventListener("click",async()=>{
  clearUI();
  const cuil=normalizeCuil(cuilInput.value),organismo=organismoSelect.value;

  if(cuil.length!==11){
    showMessage("Ingresá un CUIL válido de 11 dígitos.");
    return
  }

  consultarBtn.disabled=true;
  consultarBtn.textContent="Consultando...";

  try{
    const result=await window.ServiciosIntegralesConnector.consultarEstadoCuenta({cuil,organismo});

    if(!result||!result.ok){
      showMessage(result?.message||"No se pudo consultar el estado de cuenta.");
      return
    }

    /*
      IMPORTANTE:
      Se conserva exactamente el contrato del Estado de Cuenta que funcionaba:
      el resultado final está en result.data.
    */
    renderEstado(result.data)
  }catch(err){
    showMessage("Error al consultar: "+err.message)
  }finally{
    consultarBtn.disabled=false;
    consultarBtn.textContent="Consultar estado de cuenta"
  }
});

limpiarBtn.addEventListener("click",()=>{
  cuilInput.value="";
  organismoSelect.value="MUNICIPALIDAD";
  clearUI();
  cuilInput.focus()
});

observarCupo();
capturarCupoVisible();
