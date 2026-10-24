/* ---------------------------------------------------------------------
   Editable field configuration per unit (rendered inline atop each card)
--------------------------------------------------------------------- */
const FIELDS = {
  lift: [
    {k:'lift_duty', l:'Duty pumps', d:1, u:''},
    {k:'lift_standby', l:'Standby pumps', d:1, u:''},
    {k:'lift_H', l:'Operating level', d:0.8, u:'m'},
    {k:'lift_staticHead', l:'Static Head', d:8.1, u:'m'},
  ],
  screen: [
    {k:'screen_type', l:'Screen type', d:'manual', u:'', opts:[['manual','Manual Bar Screen'],['basket','Basket Screen']]},
    {k:'screen_n', l:'Number of screens', d:1, u:''},
    {k:'screen_vel', l:'Design velocity', d:0.65, u:'m/s'},
    {k:'screen_H', l:'Channel water depth (manual)', d:0.03, u:'m'},
  ],
  grit: [
    {k:'grit_OR', l:'Surface loading rate', d:500, u:'m/day'},
    {k:'grit_n', l:'Number of chambers', d:1, u:''},
    {k:'grit_W', l:'Chamber width', d:0.6, u:'m'},
  ],
  gos: [
    {k:'gos_n', l:'Number of units', d:1, u:''},
    {k:'GOS_BOD', l:'BOD removal', d:5, u:'%'},
    {k:'GOS_TSS', l:'TSS removal', d:15, u:'%'},
    {k:'GOS_FreeOil', l:'Free oil removal', d:90, u:'%'},
  ],
  eq: [
    {k:'eq_RT', l:'Retention time', d:4, u:'hr'},
    {k:'eq_n', l:'Number of tanks', d:1, u:''},
    {k:'eq_shape', l:'Shape', d:'circular', u:'', opts:[['circular','Circular'],['rectangular','Rectangular']]},
    {k:'eq_WL', l:'Operating level', d:4.7, u:'m'},
  ],
  rfs: [
    {k:'rfs_blockage', l:'Blockage ratio', d:60, u:'%'},
    {k:'rfs_n', l:'Number of screens', d:1, u:''},
    {k:'RFS_BOD', l:'BOD removal', d:5, u:'%'},
    {k:'RFS_TSS', l:'TSS removal', d:20, u:'%'},
  ],
  dafchem: [
    {k:'chem_targetPH', l:'Target pH', d:8, u:''},
    {k:'chem_coagDose', l:'Coagulant dose', d:100, u:'mg/l'},
    {k:'chem_polyDose', l:'Polymer dose', d:1, u:'mg/l'},
  ],
  daf: [
    {k:'daf_n', l:'Number of units', d:1, u:''},
    {k:'DAF_BOD', l:'BOD removal', d:55, u:'%'},
    {k:'DAF_TSS', l:'TSS removal', d:85, u:'%'},
    {k:'daf_solidsConc', l:'DAF sludge concentration', d:6, u:'%'},
  ],
  aeration: [
    {k:'aer_type', l:'Treatment system', d:'Conventional Activated Sludge', u:'', opts:[['Conventional Activated Sludge','Conventional Activated Sludge'],['Extended Aeration','Extended Aeration'],['MBBR','MBBR'],['MBR','MBR']]},
    {k:'aer_BODout', l:'BOD target in effluent', d:200, u:'mg/l'},
    {k:'aer_TSSout', l:'TSS target in effluent', d:300, u:'mg/l'},
    {k:'aer_FM', l:'F/M', d:0.4, u:'day⁻¹'},
    {k:'aer_MLSS', l:'MLSS', d:3000, u:'mg/l'},
    {k:'aer_n', l:'Number of tanks', d:1, u:''},
    {k:'aer_Y', l:'Sludge yield coefficient Y', d:0.6, u:''},
    {k:'aer_SVI', l:'SVI', d:100, u:'ml/g'},
  ],
  settling: [
    {k:'set_OR', l:'Surface loading rate', d:24, u:'m/day'},
    {k:'set_n', l:'Number of tanks', d:2, u:''},
    {k:'set_W', l:'Tank width', d:5, u:'m'},
    {k:'set_WL', l:'Operating level', d:3, u:'m'},
  ],
  sht: [
    {k:'sht_n', l:'Number of tanks', d:1, u:''},
    {k:'sht_HRT', l:'Target retention time', d:2, u:'day'},
    {k:'sht_W', l:'Width', d:4, u:'m'},
  ],
  blowers: [
    {k:'blow_compFactor', l:'Blower compression factor', d:78, u:'%'},
    {k:'blow_duty', l:'Number of blowers', d:2, u:''},
    {k:'blow_safety', l:'Safety factor', d:1.25, u:''},
  ],
  chlorine_tank: [
    {k:'cct_RT', l:'Contact time', d:1.33, u:'hr'},
    {k:'cct_L', l:'Length', d:7, u:'m'},
    {k:'cct_W', l:'Width', d:2.2, u:'m'},
  ],
  chlorine_dose: [
    {k:'cld_dose', l:'Chlorine dose', d:10, u:'mg/l'},
  ],
  mmf: [
    {k:'mmf_n', l:'Number of filters', d:2, u:''},
    {k:'mmf_rate', l:'Filtration rate', d:10, u:'m/hr'},
  ],
  cf: [
    {k:'cf_rateTie', l:'Filtration rate/Tie', d:0.65, u:'m³/hr'},
  ],
  rochem: [
    {k:'rc_smbsDose', l:'SMBS dose', d:3, u:'mg/l'},
    {k:'rc_antiDose', l:'Antiscalant dose', d:3, u:'mg/l'},
  ],
  ro: [
    {k:'ro_recovery', l:'Recovery', d:65, u:'%'},
    {k:'ro_flux', l:'Flux', d:22, u:'LMH'},
  ],
  sludgeqty: [],
  dewater: [
    {k:'dw_alt', l:'Dewatering system', d:'belt', u:'', opts:[['belt','Belt Press'],['press','Filter Press']]},
    {k:'dw_outletConc', l:'Thickened sludge concentration', d:5, u:'%'},
    {k:'dw_cakeConc', l:'Final cake concentration', d:26, u:'%'},
    {k:'dw_polyDose', l:'Polymer dose', d:4, u:'g/kg DS'},
  ],
  supernatant: [
    {k:'sup_workHours', l:'Operating hours', d:16, u:'hr'},
  ],
};

function getP(id){
  const p = state.params[id] || (state.params[id]={});
  return p;
}
function fieldVal(id,f){
  const p = getP(id);
  return p[f.k] !== undefined ? p[f.k] : f.d;
}
function renderFields(id){
  const flds = FIELDS[id]||[];
  if(!flds.length) return '';
  let h = '<div class="inline-inputs">';
  flds.forEach(f=>{
    const val = fieldVal(id,f);
    if(f.opts){
      h += `<div class="field"><label>${f.l}</label><select data-fkey="${id}:${f.k}" onchange="updateParam('${id}','${f.k}',this.value,false,this)">`;
      f.opts.forEach(o=>{ h+=`<option value="${o[0]}" ${o[0]===val?'selected':''}>${o[1]}</option>`; });
      h += '</select></div>';
    } else {
      h += `<div class="field"><label>${f.l}<span class="unit">${f.u}</span></label><input type="number" inputmode="decimal" step="any" ${Validate.attrs(f.k)} data-fkey="${id}:${f.k}" value="${val}" onchange="updateParam('${id}','${f.k}',this.value,true,this)"></div>`;
    }
  });
  h += '</div>';
  return h;
}
window.updateParam = function(id,key,val,isNum,el){
  let v = val;
  if(isNum){
    const chk = Validate.check(key,val);
    if(!chk.ok){
      if(el){ Validate.flag(el,chk.msg); el.value = fieldValueOf(id,key); }
      toast(chk.msg,'err');
      return;
    }
    v = chk.value; if(el) Validate.clear(el);
  }
  keepFocus(()=>{ getP(id)[key] = v; runAll(); });
};
function fieldValueOf(id,key){
  const f=(FIELDS[id]||[]).find(x=>x.k===key); const p=getP(id);
  return p[key]!==undefined ? p[key] : (f?f.d:'');
}
/* keep the keyboard open when the user taps from one field straight into another
   (a change re-renders the cards, which would otherwise drop focus) */
function keepFocus(fn){
  const ae=document.activeElement; const key=ae&&ae.dataset?ae.dataset.fkey:null;
  fn();
  if(key){ const el=document.querySelector('[data-fkey="'+key+'"]'); if(el&&el!==document.activeElement){ el.focus(); if(el.select&&el.type==='number'){ try{el.select();}catch(e){} } } }
}

/* ---------------------------------------------------------------------
   Global inputs sidebar sections
--------------------------------------------------------------------- */
const GLOBAL_FIELDS = [
  {sec:'basic', title:'1. Basic Data', tag:'INPUT', fields:[
    {k:'Qavg', l:'Average Daily Flow', u:'m³/day'},
    {k:'opHours', l:'Daily Operating Hours', u:'hr/day'},
    {k:'peakFactor', l:'Peak factor', u:''},
  ]},
  {sec:'influent', title:'2. Raw Water Characteristics (Influent)', tag:'INPUT', fields:[
    {k:'BOD', l:'BOD5', u:'mg/l'},
    {k:'COD', l:'COD', u:'mg/l'},
    {k:'TSS', l:'TSS', u:'mg/l'},
    {k:'FOG', l:'FOG', u:'mg/l'},
    {k:'pH', l:'pH', u:''},
  ]},
  {sec:'secondary', title:'3. Secondary Target Effluent', tag:'TARGET', fields:[
    {k:'sec_BOD', l:'BOD5', u:'mg/l'},
    {k:'sec_COD', l:'COD', u:'mg/l'},
    {k:'sec_TSS', l:'TSS', u:'mg/l'},
    {k:'sec_FOG', l:'FOG', u:'mg/l'},
  ]},
  {sec:'tertiary', title:'4. Final Target Effluent (Reuse)', tag:'TARGET', fields:[
    {k:'ter_BOD', l:'BOD5', u:'mg/l'},
    {k:'ter_COD', l:'COD', u:'mg/l'},
    {k:'ter_TSS', l:'TSS', u:'mg/l'},
    {k:'ter_FOG', l:'FOG', u:'mg/l'},
  ]},
];

function buildSidebar(){
  const el = document.getElementById('sidebar');
  let h = ProjectsUI.sidebarHtml();
  GLOBAL_FIELDS.forEach(sec=>{
    h += `<div class="side-section"><div class="side-head" onclick="toggleSide('${sec.sec}')">${sec.title}<span class="tag">${sec.tag}</span></div>
      <div class="side-body" id="side-${sec.sec}">`;
    h += '<div class="row2">';
    sec.fields.forEach(f=>{
      h += `<div class="field"><label>${f.l}<span class="unit">${f.u}</span></label>
        <input type="number" inputmode="decimal" step="any" ${Validate.attrs(f.k)} id="gin-${f.k}" value="${I[f.k]}" onchange="updateGlobal('${f.k}',this.value,this)"></div>`;
    });
    h += '</div></div></div>';
  });

  // Treatment train toggles
  h += `<div class="side-section"><div class="side-head" onclick="toggleSide('train')">5. Selected Treatment Train<span class="tag">TRAIN</span></div>
    <div class="side-body" id="side-train">`;
  let lastCat = '';
  UNIT_DEFS.forEach((u,idx)=>{
    if(u.cat!==lastCat){ h+=`<div style="font-size:10.5px;font-weight:700;color:#8AA0A3;margin-top:${lastCat?'8px':'0'};text-transform:uppercase;letter-spacing:.5px;">${u.cat}</div>`; lastCat=u.cat; }
    h += `<label class="unit-toggle ${state.units[u.id]?'':'off'}" id="toggle-${u.id}">
      <span class="num">${idx+1}</span><span class="name">${u.name.split('(')[0]}</span>
      <span class="switch"><input type="checkbox" ${state.units[u.id]?'checked':''} onchange="toggleUnit('${u.id}',this.checked)"><span class="slider"></span></span>
    </label>`;
  });
  h += '</div></div>';

  el.innerHTML = h;
}
window.toggleSide = function(sec){
  document.getElementById('side-'+sec).classList.toggle('collapsed');
};
window.updateGlobal = function(k,v,el){
  const chk = Validate.check(k,v);
  if(!chk.ok){
    if(el){ Validate.flag(el,chk.msg); el.value = I[k]; }
    toast(chk.msg,'err');
    return;
  }
  if(el) Validate.clear(el);
  I[k] = chk.value;
  runAll();
};
window.toggleUnit = function(id,val){
  state.units[id]=val;
  document.getElementById('toggle-'+id).classList.toggle('off',!val);
  runAll();
};

/* ---------------------------------------------------------------------
   Orchestrator — runs enabled units in sequence, chaining mass balance
--------------------------------------------------------------------- */
const WQ_CHAIN_UNITS = ['gos','rfs','daf','aeration','settling']; // units that can alter stream quality

let LAST = {results:{}, order:[], stream:null, mbTrace:[]};


/* ---------------------------------------------------------------------
   Engineering safety layer (does not alter any formula)
--------------------------------------------------------------------- */
const BIO_DEPENDENTS = ['settling','sht','blowers'];
function bioGuard(stream,p){
  const target = p.aer_BODout ?? I.sec_BOD;
  return {
    html: `<div class="note err"><b>Aeration Tank cannot be sized.</b> The BOD5 entering the biological stage (${n(stream.BOD,0)} mg/l) is not above the target effluent BOD5 (${n(target,0)} mg/l), so the removal required is zero or negative. Lower the target, or review the removal assumed in the upstream units.</div>`,
    headLoss: 0.20,
    out: {BOD:stream.BOD, TSS:stream.TSS, FOG:stream.FOG, COD:stream.COD, pH:stream.pH, invalid:true,
          RASratio:0, excessSludgeVol:0, MLSS:0, bioSolidsMass:0, aerationVol:0, SVI:0, _hourlyAir:0}
  };
}
/* scan a unit's rendered table values for invalid numbers */
function scanResult(def, r, issues){
  const html = String(r.html||'');
  const vals = [...html.matchAll(/class="val">([^<]*)</g)].map(m=>m[1].trim());
  const bad = vals.filter(v=>/(^|\s)(—|∞|-∞)(\s|$)|NaN/.test(v));
  const neg = vals.filter(v=>/^-\d/.test(v));
  const name = def.name.split('(')[0].trim();
  if(bad.length) issues.push({level:'error',unit:def.id,msg:`${name}: ${bad.length} result(s) could not be calculated (division by zero or missing upstream stage). Review the inputs of this and the preceding units.`});
  else if(neg.length) issues.push({level:'warn',unit:def.id,msg:`${name}: ${neg.length} negative result(s) — check the inputs.`});
}
/* cross-parameter checks on the entered data */
function crossChecks(){
  const out=[];
  if(I.COD < I.BOD) out.push({level:'warn',unit:'basis',msg:`Raw COD (${n(I.COD,0)} mg/l) is lower than raw BOD5 (${n(I.BOD,0)} mg/l). BOD5 cannot exceed COD — please verify the lab data.`});
  if(I.sec_BOD > I.BOD) out.push({level:'warn',unit:'basis',msg:'Secondary target BOD5 is above the raw BOD5 — no biological removal is required.'});
  if(I.ter_BOD > I.sec_BOD) out.push({level:'warn',unit:'basis',msg:'Final target BOD5 is above the secondary target BOD5.'});
  if(I.pH<5||I.pH>10) out.push({level:'warn',unit:'basis',msg:`Raw pH ${n(I.pH,2)} is outside the usual 5–10 window for biological treatment — confirm pH correction is adequate.`});
  if(state.units.aeration && state.units.settling===false) out.push({level:'warn',unit:'basis',msg:'Aeration is enabled but the Final Settling Tank is disabled.'});
  if(!Object.values(state.units).some(Boolean)) out.push({level:'warn',unit:'basis',msg:'No treatment units are enabled.'});
  return out;
}
function renderChecks(){
  const el=document.getElementById('checksBox'); if(!el) return;
  const list=LAST.issues||[];
  if(!list.length){ el.innerHTML=`<div class="checks ok">✓ Design checks passed — no invalid or inconsistent values detected.</div>`; return; }
  const errs=list.filter(i=>i.level==='error').length;
  el.innerHTML=`<div class="checks ${errs?'bad':'warn'}"><div class="checks-h">${errs?'⚠ '+errs+' error(s) – results marked below are not reliable':'⚠ '+list.length+' warning(s)'}</div><ul>${list.map(i=>`<li class="${i.level}">${esc(i.msg)}</li>`).join('')}</ul></div>`;
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function toast(msg,kind){
  let el=document.getElementById('toast');
  if(!el){ el=document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
  el.className='toast '+(kind||'info')+' show'; el.textContent=msg;
  clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'),3800);
}

function runAll(){
  let stream = {BOD:I.BOD, COD:I.COD, TSS:I.TSS, FOG:I.FOG, pH:I.pH};
  const results = {};
  const order = [];
  const mbTrace = [{stage:'Raw Influent (Raw)', ...stream}];
  const issues = [];

  const ctx = {p:null, stream:null, upstream:results, results:results};

  UNIT_DEFS.forEach(def=>{
    if(!state.units[def.id]) return;
    const fn = CALC[def.id];
    if(!fn) return;
    ctx.p = getP(def.id);
    ctx.stream = stream;
    let r;
    const blocked = BIO_DEPENDENTS.includes(def.id) && results.aeration && results.aeration.invalid;
    try{
      if(def.id==='aeration' && stream.BOD <= (ctx.p.aer_BODout ?? I.sec_BOD)){
        r = bioGuard(stream, ctx.p);
      } else if(blocked){
        r = {html:`<div class="note err">Not calculated — this unit needs a valid biological (aeration) stage. Fix the Aeration Tank inputs first.</div>`, headLoss:def.headLoss, out:{}};
        issues.push({level:'error',unit:def.id,msg:def.name.split('(')[0].trim()+': not calculated because the Aeration Tank is invalid.'});
      } else {
        r = fn(ctx);
      }
    } catch(e){
      r = {html:`<div class="note err">Calculation error: ${e.message}</div>`, headLoss:def.headLoss, out:{}};
    }
    scanResult(def, r, issues);
    results[def.id] = r.out||{};
    results[def.id].html = r.html;
    results[def.id].headLoss = (r.headLoss!==undefined?r.headLoss:def.headLoss);
    order.push(def.id);

    if(WQ_CHAIN_UNITS.includes(def.id) && r.out && r.out.BOD!==undefined){
      stream = {BOD:r.out.BOD, COD:r.out.COD, TSS:r.out.TSS, FOG:r.out.FOG, pH:r.out.pH!==undefined?r.out.pH:stream.pH};
      mbTrace.push({stage: UNIT_DEFS.find(u=>u.id===def.id).name.split('(')[0], ...stream});
    }
  });

  LAST = {results, order, stream, mbTrace, issues: issues.concat(crossChecks())};
  renderCards();
  renderChecks();
  renderSummary();
  renderHydraulic();
  renderMassBalance();
  renderReport();
  if(typeof Store!=='undefined') Store.scheduleSave();
}

/* ---------------------------------------------------------------------
   Render: unit cards
--------------------------------------------------------------------- */
const openCards = new Set(['lift']);
function cardBanner(id){
  const list=(LAST.issues||[]).filter(i=>i.unit===id);
  if(!list.length) return '';
  return list.map(i=>`<div class="note ${i.level==='error'?'err':'warn'}">${esc(i.msg)}</div>`).join('');
}
function renderCards(){
  const el = document.getElementById('unitCards');
  let h = '';
  LAST.order.forEach((id,idx)=>{
    const def = UNIT_DEFS.find(u=>u.id===id);
    const r = LAST.results[id];
    const isOpen = openCards.has(id);
    h += `<div class="unit-card ${isOpen?'open':''}" id="card-${id}">
      <div class="unit-card-head" onclick="toggleCard('${id}')">
        <span class="badge">${idx+1}</span>
        <h3>${def.name}${r.headLoss?`<span class="pill">Δh ${r.headLoss} m</span>`:''}</h3>
        <span class="chev">▶</span>
      </div>
      <div class="unit-card-body">${cardBanner(id)}${renderFields(id)}${r.html}</div>
    </div>`;
  });
  if(!h) h = '<div class="note">No units enabled — please select the treatment train from the Inputs panel.</div>';
  el.innerHTML = h;
}
window.toggleCard = function(id){
  if(openCards.has(id)) openCards.delete(id); else openCards.add(id);
  document.getElementById('card-'+id).classList.toggle('open');
};

/* ---------------------------------------------------------------------
   Render: summary strip
--------------------------------------------------------------------- */
function renderSummary(){
  const el = document.getElementById('summaryStrip');
  const finalStream = LAST.stream;
  const removalBOD = ((I.BOD-finalStream.BOD)/I.BOD*100);
  const removalCOD = ((I.COD-finalStream.COD)/I.COD*100);
  const removalTSS = ((I.TSS-finalStream.TSS)/I.TSS*100);
  const nUnits = LAST.order.length;
  el.innerHTML = `
    <div class="stat-card"><div class="k">Design Flow</div><div class="v">${n(I.Qavg,0)}</div><div class="u">m³/day</div></div>
    <div class="stat-card"><div class="k">Enabled stages</div><div class="v">${nUnits}</div><div class="u">of ${UNIT_DEFS.length}</div></div>
    <div class="stat-card"><div class="k">Total BOD5 removal</div><div class="v">${n(removalBOD,1)}</div><div class="u">%</div></div>
    <div class="stat-card"><div class="k">Total COD removal</div><div class="v">${n(removalCOD,1)}</div><div class="u">%</div></div>
    <div class="stat-card"><div class="k">Total TSS removal</div><div class="v">${n(removalTSS,1)}</div><div class="u">%</div></div>
    <div class="stat-card"><div class="k">BOD5 Final</div><div class="v">${n(finalStream.BOD,0)}</div><div class="u">mg/l</div></div>
  `;
}

/* ---------------------------------------------------------------------
   Render: hydraulic profile (schematic)
--------------------------------------------------------------------- */
function renderHydraulic(){
  const holder = document.getElementById('hpSvgHolder');
  const units = LAST.order.map(id=>({id, def:UNIT_DEFS.find(u=>u.id===id), headLoss:LAST.results[id].headLoss||0}));
  const boxW = 132, gap = 26, boxH = 70, padTop = 60, padBottom = 110;
  const totalW = units.length*(boxW+gap)+gap;
  const pumpHead = getP('lift').lift_staticHead ? (getP('lift').lift_staticHead + (getP('lift').lift_losses??1.5) + (getP('lift').lift_remPress??1.5)) : 11.1;
  let elevation = 0; // relative elevation, start at 0 = pump discharge
  const elevations = [elevation];
  units.forEach(u=>{ elevation -= u.headLoss; elevations.push(elevation); });
  const minElev = Math.min(...elevations), maxElev = Math.max(...elevations);
  const elevRange = Math.max(maxElev-minElev, 1);
  const chartH = 190;
  const yFor = (e)=> padTop + ( (maxElev-e)/elevRange )*chartH;

  let svg = `<svg viewBox="0 0 ${totalW} ${chartH+padTop+padBottom}" xmlns="http://www.w3.org/2000/svg" style="min-width:${totalW}px;font-family:'JetBrains Mono',monospace;">`;
  // baseline grid
  svg += `<text x="10" y="24" font-size="13" font-weight="700" fill="#0B2536">Hydraulic Profile (Schematic)</text>`;

  // water level polyline
  let pts = [];
  units.forEach((u,i)=>{
    const x1 = gap + i*(boxW+gap);
    const x2 = x1+boxW;
    const yIn = yFor(elevations[i]);
    const yOut = yFor(elevations[i+1]);
    pts.push(`${x1},${yIn}`, `${x2},${yOut}`);
  });
  svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="#0E7C74" stroke-width="3" stroke-linejoin="round"/>`;

  units.forEach((u,i)=>{
    const x = gap + i*(boxW+gap);
    const y = padTop+chartH+16;
    const yIn = yFor(elevations[i]);
    svg += `<circle cx="${x}" cy="${yIn}" r="4" fill="#0E7C74"/>`;
    svg += `<text x="${x}" y="${yIn-10}" font-size="10.5" fill="#3E6E93" text-anchor="middle">${n(elevations[i],2)}</text>`;
    svg += `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="7" fill="#0B2536" opacity="0.92"/>`;
    const label = u.def.name.split('(')[0].trim();
    const words = label.split(' ');
    let line1='', line2='';
    words.forEach(w=>{ if((line1+w).length<16) line1+=w+' '; else line2+=w+' '; });
    svg += `<text x="${x+boxW/2}" y="${y+26}" font-size="10.5" fill="#EAF2F0" text-anchor="middle" font-family="'IBM Plex Sans',system-ui,sans-serif">${line1}</text>`;
    svg += `<text x="${x+boxW/2}" y="${y+42}" font-size="10.5" fill="#EAF2F0" text-anchor="middle" font-family="'IBM Plex Sans',system-ui,sans-serif">${line2}</text>`;
    svg += `<text x="${x+boxW/2}" y="${y+60}" font-size="10" fill="#0E7C74" text-anchor="middle" font-weight="700">#${i+1}</text>`;
    if(u.headLoss>0){
      svg += `<text x="${x+boxW/2}" y="${y-6}" font-size="9.5" fill="#C67F2E" text-anchor="middle">Δh=${u.headLoss}m</text>`;
    }
  });
  const lastX = gap+(units.length-1)*(boxW+gap)+boxW;
  svg += `<text x="${lastX+10}" y="${yFor(elevations[elevations.length-1])}" font-size="10.5" fill="#B84A3E" font-weight="700">Final discharge</text>`;
  svg += '</svg>';

  holder.innerHTML = svg;
}

/* ---------------------------------------------------------------------
   Render: mass balance table
--------------------------------------------------------------------- */
function renderMassBalance(){
  const el = document.getElementById('mbHolder');
  let rows = '';
  LAST.mbTrace.forEach(r=>{
    rows += `<tr><td class="stage">${r.stage}</td><td>${n(r.BOD,0)}</td><td>${n(r.COD,0)}</td><td>${n(r.TSS,0)}</td><td>${n(r.FOG,1)}</td><td>${n(r.pH,2)}</td></tr>`;
  });
  el.innerHTML = `
    <div class="hp-wrap">
      <div class="subsec-title" style="margin-bottom:14px;">Mass Balance Across Treatment Stages</div>
      <table class="mb-table">
        <thead><tr><th>Stage</th><th>BOD5 (mg/l)</th><th>COD (mg/l)</th><th>TSS (mg/l)</th><th>FOG (mg/l)</th><th>pH</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="note" style="margin-top:14px;">Values are based on the design removal ratios entered for each unit (editable inside each unit card). Actual operating values depend on the plant’s actual loads and operating efficiency.</div>
    </div>`;
}

/* ---------------------------------------------------------------------
   Render: printable report
--------------------------------------------------------------------- */
function renderReport(){
  const el = document.getElementById('reportDoc');
  const finalStream = LAST.stream;
  let unitsHtml = '';
  LAST.order.forEach((id,idx)=>{
    const def = UNIT_DEFS.find(u=>u.id===id);
    unitsHtml += `<div class="unit-card open" style="margin-bottom:18px;"><div class="unit-card-head"><span class="badge">${idx+1}</span><h3>${def.name}</h3></div><div class="unit-card-body" style="display:block;">${LAST.results[id].html}</div></div>`;
  });
  let mbRows='';
  LAST.mbTrace.forEach(r=>{
    mbRows += `<tr><td class="stage">${r.stage}</td><td>${n(r.BOD,0)}</td><td>${n(r.COD,0)}</td><td>${n(r.TSS,0)}</td><td>${n(r.FOG,1)}</td></tr>`;
  });

  el.innerHTML = `
    <div class="report-cover">
      <div class="co-logo">${esc(ProjectsUI.initials())}</div>
      <h1>${esc(Store.meta.name)}</h1>
      <p>Industrial Wastewater Treatment Plant — Preliminary Engineering Design Report</p>
      <p style="font-family:'JetBrains Mono',monospace;margin-top:10px;">Doc No: ${esc(ProjectsUI.docNo())} | Rev ${esc(Store.meta.revision)} | ${ProjectsUI.today()}</p>
      <table class="cover-info"><tbody>
        <tr><td>Client</td><td>${esc(Store.meta.client||'-')}</td></tr>
        <tr><td>Site / location</td><td>${esc(Store.meta.site||'-')}</td></tr>
        <tr><td>Project no.</td><td>${esc(Store.meta.number||'-')}</td></tr>
      </tbody></table>
      <div class="prep"><div class="lbl">Prepared by</div><div class="nm">${esc(Store.profile.name)}</div><div class="dp">${esc(Store.profile.department)}</div></div>
    </div>

    <div class="report-sec">
      <h2>1. Executive Summary</h2>
      ${table([
          row('Design Flow', n(I.Qavg,0), 'm³/day'),
          row('Operating hours', I.opHours, 'hr/day'),
          row('Number of selected treatment stages', LAST.order.length, 'stage'),
          row('BOD5 Influent → Final', `${n(I.BOD,0)} → ${n(finalStream.BOD,0)}`, 'mg/l'),
          row('COD Influent → Final', `${n(I.COD,0)} → ${n(finalStream.COD,0)}`, 'mg/l'),
          row('TSS Influent → Final', `${n(I.TSS,0)} → ${n(finalStream.TSS,0)}`, 'mg/l'),
        ])}
    </div>

    <div class="report-sec">
      <h2>2. Design Basis</h2>
      ${table([
        row('Raw BOD5', n(I.BOD,0), 'mg/l'), row('Raw COD', n(I.COD,0), 'mg/l'),
        row('Raw TSS', n(I.TSS,0), 'mg/l'), row('Raw FOG', n(I.FOG,0), 'mg/l'),
        row('Raw pH', n(I.pH,2), ''),
        row('Final target discharge specification — BOD/COD/TSS/FOG', `${I.ter_BOD} / ${I.ter_COD} / ${I.ter_TSS} / ${I.ter_FOG}`, 'mg/l'),
      ])}
    </div>

    <div class="report-sec">
      <h2>3. Mass Balance Across the Treatment Train</h2>
      <table class="mb-table">
        <thead><tr><th>Stage</th><th>BOD5</th><th>COD</th><th>TSS</th><th>FOG</th></tr></thead>
        <tbody>${mbRows}</tbody>
      </table>
    </div>

    <div class="report-sec">
      <h2>4. Hydraulic Profile</h2>
      <div id="reportHpHolder"></div>
      <p style="font-size:11.5px;color:#5C7075;">* Schematic profile based on typical level differences for each unit — requires verification by an actual topographic site survey.</p>
    </div>

    <div class="report-sec">
      <h2>5. Detailed Engineering Calculations</h2>
      ${unitsHtml}
    </div>

    <div class="report-sec">
      <h2>6. Design Checks</h2>
      ${(LAST.issues&&LAST.issues.length)?`<ul>${LAST.issues.map(i=>`<li class="${i.level}">${esc(i.msg)}</li>`).join('')}</ul>`:'<p>All automatic design checks passed — no invalid or inconsistent values were detected.</p>'}
      ${(Store.meta.notes||'').trim()?`<p><b>Project notes:</b> ${esc(Store.meta.notes)}</p>`:''}
    </div>

    <div class="report-sec" style="text-align:center;color:#8AA0A3;font-size:11px;border-top:1px solid var(--line);padding-top:14px;">
      ${esc(Store.profile.name)} — ${esc(Store.profile.department)} | Preliminary report for design and pricing purposes — subject to final engineering review before construction
    </div>
  `;
  // clone hydraulic svg into report
  const src = document.getElementById('hpSvgHolder').innerHTML;
  document.getElementById('reportHpHolder').innerHTML = `<div class="hp-wrap" style="padding:10px;">${src}</div>`;
}

/* ---------------------------------------------------------------------
   Tabs
--------------------------------------------------------------------- */
window.switchTab = function(tab){
  const isInputs = tab==='inputs';
  document.body.classList.toggle('mode-inputs', isInputs);
  if(!isInputs){
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('panel-'+tab).classList.add('active');
  }
  document.querySelectorAll('#bottomNav button').forEach(b=>b.classList.toggle('active', b.dataset.go===tab));
  window.scrollTo(0,0);
};
document.querySelectorAll('#bottomNav button').forEach(b=> b.addEventListener('click', ()=>switchTab(b.dataset.go)) );
document.querySelectorAll('.tab-btn').forEach(b=> b.addEventListener('click', ()=>switchTab(b.dataset.tab)) );

/* ---------------------------------------------------------------------
   Init
--------------------------------------------------------------------- */

