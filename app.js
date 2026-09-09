const $=s=>document.querySelector(s);
const cuilInput=$("#cuilInput"),organismoSelect=$("#organismoSelect"),consultarBtn=$("#consultarBtn"),limpiarBtn=$("#limpiarBtn"),messageBox=$("#messageBox"),clientCard=$("#clientCard"),creditsList=$("#creditsList"),creditTemplate=$("#creditTemplate");
const fmtMoney=new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:2,maximumFractionDigits:2});

function normalizeCuil(v){return String(v||"").replace(/\D/g,"").slice(0,11)}
function formatCuil(v){const d=normalizeCuil(v);if(d.length<=2)return d;if(d.length<=10)return`${d.slice(0,2)}-${d.slice(2)}`;return`${d.slice(0,2)}-${d.slice(2,10)}-${d.slice(10)}`}
function showMessage(t){messageBox.textContent=t;messageBox.classList.remove("hidden")}
function clearUI(){messageBox.classList.add("hidden");clientCard.classList.add("hidden");creditsList.innerHTML=""}
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
