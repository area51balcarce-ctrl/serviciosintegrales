const $=s=>document.querySelector(s);
const cuilInput=$("#cuilInput"),organismoSelect=$("#organismoSelect"),consultarBtn=$("#consultarBtn"),limpiarBtn=$("#limpiarBtn"),messageBox=$("#messageBox"),clientCard=$("#clientCard"),creditsList=$("#creditsList"),creditTemplate=$("#creditTemplate"),fichaConsolidada=$("#fichaConsolidada");
const fmtMoney=new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:2,maximumFractionDigits:2});
let ultimoEstadoConsolidado=null;
let cupoFicha={cuil:"",texto:"Pendiente",negative:false};

function normalizeCuil(v){return String(v||"").replace(/\D/g,"").slice(0,11)}
function formatCuil(v){const d=normalizeCuil(v);if(d.length<=2)return d;if(d.length<=10)return`${d.slice(0,2)}-${d.slice(2)}`;return`${d.slice(0,2)}-${d.slice(2,10)}-${d.slice(10)}`}
function showMessage(t){messageBox.textContent=t;messageBox.classList.remove("hidden")}
function clearUI(){messageBox.classList.add("hidden");clientCard.classList.add("hidden");fichaConsolidada?.classList.add("hidden");creditsList.innerHTML="";ultimoEstadoConsolidado=null}
function setText(root,field,value){const el=root.querySelector(`[data-field="${field}"]`);if(el)el.textContent=value}

function numeroAR(v){
  if(typeof v==="number")return Number.isFinite(v)?v:0;
  const s=String(v??"").trim();
  if(!s)return 0;

  // Creditan devuelve importes como 1,853,600.00
  // y también podemos recibir números ya normalizados.
  if(/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(s)){
    const n=Number(s.replace(/,/g,""));
    return Number.isFinite(n)?n:0;
  }

  // Formato argentino: 1.853.600,00
  if(/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)){
    const n=Number(s.replace(/\./g,"").replace(",","."));
    return Number.isFinite(n)?n:0;
  }

  const n=Number(s.replace(/[^\d.-]/g,""));
  return Number.isFinite(n)?n:0;
}

function adaptarResultado(result,cuilConsultado,organismoConsultado){
  /*
    connector.js devuelve:
      result.cliente
      result.organismo
      result.operaciones

    La interfaz original esperaba:
      data.nombre
      data.cuil
      data.organismo
      data.creditos
  */
  const operaciones=Array.isArray(result?.operaciones)?result.operaciones:[];

  return{
    nombre:result?.cliente?.nombre||"CLIENTE",
    cuil:result?.cliente?.cuil||cuilConsultado,
    organismo:result?.organismo||organismoConsultado,
    creditos:operaciones.map(op=>({
      operacion:op?.operacion??op?.numero??"—",
      solicitud:op?.solicitud??"—",
      capital:numeroAR(op?.capital??op?.capitalOriginal??0),
      cuotas:op?.cuotas??"—",
      valorCuota:numeroAR(op?.cuota??op?.valorCuota??0),
      proximoPeriodo:op?.primerVencimiento||op?.proximoPeriodo||"—",
      saldoCapital:numeroAR(op?.saldoCapital??0),
      detalleCuotas:Array.isArray(op?.detalleCuotas)?op.detalleCuotas:[]
    }))
  };
}

function capturarCupoParaFicha(){
  const resultCard=$("#resultCard");
  const cupoFinal=$("#cupoFinal");

  if(!resultCard||!cupoFinal||!resultCard.classList.contains("show")){
    cupoFicha={cuil:"",texto:"Pendiente",negative:false};
    return;
  }

  const cuilActual=normalizeCuil(cuilInput.value);

  /*
    El cupo queda asociado al CUIL que está escrito en pantalla
    en el momento de calcularlo. Así nunca mostramos en la ficha
    de un cliente el cupo que quedó visible de un cliente anterior.
  */
  cupoFicha={
    cuil:cuilActual.length===11?cuilActual:"",
    texto:String(cupoFinal.textContent||"Pendiente").trim()||"Pendiente",
    negative:resultCard.classList.contains("negative")
  };
}

function leerCupoVisible(cuilFicha){
  const cuil=normalizeCuil(cuilFicha);

  if(cuil.length!==11||cupoFicha.cuil!==cuil){
    return{texto:"Pendiente",negative:false};
  }

  return{
    texto:cupoFicha.texto,
    negative:cupoFicha.negative
  };
}

function renderFichaConsolidada(){
  if(!ultimoEstadoConsolidado||!fichaConsolidada)return;

  const cupo=leerCupoVisible(ultimoEstadoConsolidado.cuil);

  $("#fichaNombre").textContent=ultimoEstadoConsolidado.nombre||"CLIENTE";
  $("#fichaCuil").textContent=formatCuil(ultimoEstadoConsolidado.cuil);
  $("#fichaOrganismo").textContent=ultimoEstadoConsolidado.organismo||"—";
  $("#fichaCupo").textContent=cupo.texto;
  $("#fichaVigentes").textContent=ultimoEstadoConsolidado.vigentes;
  $("#fichaCuotasTotal").textContent=fmtMoney.format(ultimoEstadoConsolidado.cuotaTotal);
  $("#fichaSaldoTotal").textContent=fmtMoney.format(ultimoEstadoConsolidado.saldoTotal);

  const fichaCupo=$(".ficha-cupo");
  if(fichaCupo)fichaCupo.classList.toggle("negative",cupo.negative);

  fichaConsolidada.classList.remove("hidden");
}

function observarCupo(){
  const resultCard=$("#resultCard");
  const cupoFinal=$("#cupoFinal");
  if(!resultCard||!cupoFinal)return;

  const observer=new MutationObserver(()=>{
    capturarCupoParaFicha();
    if(ultimoEstadoConsolidado)renderFichaConsolidada();
  });

  observer.observe(resultCard,{attributes:true,attributeFilter:["class"]});
  observer.observe(cupoFinal,{childList:true,characterData:true,subtree:true});
}

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
  const cuotaTotal=credits.reduce((a,c)=>a+Number(c.valorCuota||0),0);
  const saldoTotal=credits.reduce((a,c)=>a+Number(c.saldoCapital||0),0);

  $("#vigentesCount").textContent=credits.length;
  $("#cuotaTotal").textContent=fmtMoney.format(cuotaTotal);
  $("#saldoTotal").textContent=fmtMoney.format(saldoTotal);

  ultimoEstadoConsolidado={
    nombre:data.nombre||"CLIENTE",
    cuil:data.cuil||"",
    organismo:data.organismo||"—",
    vigentes:credits.length,
    cuotaTotal,
    saldoTotal
  };
  renderFichaConsolidada();

  creditsList.innerHTML="";
  credits.forEach(c=>creditsList.appendChild(renderCredit(c)));
  clientCard.classList.remove("hidden")
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

    const data=adaptarResultado(result,cuil,organismo);
    renderEstado(data)
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
capturarCupoParaFicha();
