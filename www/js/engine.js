/* Industrial WWTP Design Suite - calculation engine.
   Extracted UNCHANGED from the original single-file app (verified by tests/run-tests.js
   against golden results generated from the original). Do not edit formulas here without
   regenerating tests/golden.json and documenting the engineering reason. */
/* ---------------------------------------------------------------------
   Global input model
--------------------------------------------------------------------- */
const I = {
  Qavg: 200,            // m3/day
  opHours: 24,           // hr/day
  peakFactor: 2.0,
  BOD: 2103, COD: 3931, TSS: 1830, FOG: 254, pH: 7.37,
  sec_BOD: 200, sec_COD: 400, sec_TSS: 300, sec_FOG: 100,
  ter_BOD: 15, ter_COD: 20, ter_TSS: 15, ter_FOG: 10,
};

/* Removal ratio defaults (%) per unit — editable */
const R = {
  GOS_BOD:5, GOS_TSS:15, GOS_FreeOil:90, GOS_EmulOil:0,
  RFS_BOD:5, RFS_TSS:20, RFS_FreeOil:0, RFS_EmulOil:0, RFS_NonSolCOD:10,
  DAF_BOD:55, DAF_TSS:85, DAF_FreeOil:85, DAF_EmulOil:80, DAF_SolCOD:55, DAF_NonSolCOD:85,
};

/* Unit process definitions: id, order, name, category, default enabled */
const UNIT_DEFS = [
  {id:'lift',   name:'Lifting Station', cat:'Headworks', on:true, headLoss:0},
  {id:'screen', name:'Screening', cat:'Headworks', on:true, headLoss:0.10},
  {id:'grit',   name:'Grit & Grease Chamber', cat:'Headworks', on:true, headLoss:0.10},
  {id:'gos',    name:'GOS Unit', cat:'Pre-Treatment', on:true, headLoss:0.20},
  {id:'eq',     name:'Balancing / Equalization Tank', cat:'Pre-Treatment', on:true, headLoss:0.30},
  {id:'rfs',    name:'Rotary Fine Screen', cat:'Pre-Treatment', on:true, headLoss:0.10},
  {id:'dafchem',name:'DAF Chemical Dosing System', cat:'Physico-Chemical', on:true, headLoss:0},
  {id:'daf',    name:'DAF Unit', cat:'Physico-Chemical', on:true, headLoss:0.30},
  {id:'aeration',name:'Aeration Tank', cat:'Biological', on:true, headLoss:0.20},
  {id:'settling',name:'Final Settling Tank', cat:'Biological', on:true, headLoss:0.25},
  {id:'sht',    name:'Sludge Holding Tank', cat:'Sludge Line', on:true, headLoss:0},
  {id:'blowers',name:'Air Blowers', cat:'Biological', on:true, headLoss:0},
  {id:'chlorine_tank', name:'Chlorine Contact Tank', cat:'Tertiary', on:true, headLoss:0.15},
  {id:'chlorine_dose', name:'Chlorine Dosing Set', cat:'Tertiary', on:true, headLoss:0},
  {id:'mmf',    name:'Multimedia Filters', cat:'Tertiary', on:true, headLoss:0.60},
  {id:'cf',     name:'Cartridge Filters', cat:'Tertiary', on:false, headLoss:0.40},
  {id:'rochem', name:'RO Chemical Dosing System', cat:'RO / Advanced', on:false, headLoss:0},
  {id:'ro',     name:'RO Skid', cat:'RO / Advanced', on:false, headLoss:1.20},
  {id:'sludgeqty',name:'Total Sludge Quantity', cat:'Sludge Line', on:true, headLoss:0},
  {id:'dewater',name:'Sludge Dewatering', cat:'Sludge Line', on:true, headLoss:0},
  {id:'supernatant',name:'Supernatant Sump', cat:'Sludge Line', on:true, headLoss:0},
];

const state = { units:{}, params:{} };
UNIT_DEFS.forEach(u=>state.units[u.id]=u.on);

/* ---------------------------------------------------------------------
   Helpers
--------------------------------------------------------------------- */
function n(v,d=2){
  if(v===undefined||v===null||isNaN(v)) return '—';
  return Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
}
function roundUpTo(v, step){ return Math.ceil(v/step)*step; }
function roundUpStd(v, list){ for(const s of list){ if(v<=s) return s; } return list[list.length-1]; }
const STD_DIAMETERS = [0.6,0.8,1.0,1.2,1.4,1.6,1.8,2.0,2.4,2.8,3.2,3.6,4.0,4.5,5.0,5.5,6.0,6.6,7.2,8.0,9.0,10.0];

function row(label, value, unit, cls){
  return {label,value,unit,cls:cls||''};
}
function table(rows){
  let h = '<table class="calc"><thead><tr><th>Parameter</th><th>Value</th><th>Unit</th></tr></thead><tbody>';
  rows.forEach(r=>{
    h += `<tr class="${r.cls}"><td>${r.label}</td><td class="val">${r.value}</td><td class="unit">${r.unit||''}</td></tr>`;
  });
  h += '</tbody></table>';
  return h;
}
function subsec(title, innerHtml){
  return `<div class="subsec"><div class="subsec-title">${title}</div>${innerHtml}</div>`;
}
function noteBox(text, cls){ return `<div class="note ${cls||''}">${text}</div>`; }

/* generic dosing-set calculator (used by NaOH / Coagulant / Polymer / Chlorine / SMBS / Antiscalant) */
function dosingSet(Q_m3day, dosage_mgL, rawConcPct, density_kgm3, dosingConcPct, storageDays, opHours, pumpFactor){
  pumpFactor = pumpFactor||0.49;
  const dailyConsumption = (Q_m3day*dosage_mgL/1000)/(rawConcPct/100);           // kg/day
  const dosingRate = (dailyConsumption/(dosingConcPct/100)/density_kgm3)*1000/opHours; // l/hr
  const pumpSizing = dosingRate/pumpFactor;                                       // l/hr
  const tankVolume = dosingRate*storageDays*24;                                   // l
  return {dailyConsumption, dosingRate, pumpSizing, tankVolume};
}

/* ---------------------------------------------------------------------
   Per-unit calculation modules
   Each returns {html, out:{...stage effluent + key handoffs}, headLoss}
--------------------------------------------------------------------- */
const CALC = {};

/* ===================== 1. LIFTING STATION ===================== */
CALC.lift = function(ctx){
  const p = ctx.p;
  const Qavg_hr = I.Qavg/I.opHours;
  const Qpeak_hr = Qavg_hr*I.peakFactor;
  const duty = p.lift_duty ?? 1, standby = p.lift_standby ?? 1;
  const totalPumps = duty+standby;
  const flowPerPump = Qpeak_hr/duty;
  const roundedFlow = roundUpTo(flowPerPump,5);
  const Qp = roundedFlow/3600;
  const opH = p.lift_opHours ?? 10;
  const WT = p.lift_WT ?? 4;
  const interval = 3600/WT;
  const Vmin = (duty*Qp*interval)/4;
  const nsumps = p.lift_nsumps ?? 1;
  const Vsump = Vmin/nsumps;
  const H = p.lift_H ?? 0.8;
  const area = Vsump/H;
  const diameter = roundUpStd(Math.sqrt(4*area/Math.PI), STD_DIAMETERS);
  const actualArea = Math.PI/4*diameter*diameter;
  const actualVol = actualArea*H;
  const freeboard = p.lift_freeboard ?? 0.5;
  const LLL = p.lift_LLL ?? 0.3;
  const totalDepth = H+freeboard+LLL;

  const staticHead = p.lift_staticHead ?? 8.1;
  const losses = p.lift_losses ?? 1.5;
  const remPress = p.lift_remPress ?? 1.5;
  const head = staticHead+losses+remPress;
  const roundedHead = roundUpTo(head,1);

  const html =
    subsec('1.1 Wet Well Sizing', table([
      row('Average hourly flow', n(Qavg_hr), 'm³/hr'),
      row('Peak hourly flow', n(Qpeak_hr), 'm³/hr', 'hl'),
      row('Number of pumps (duty+standby)', `${duty} + ${standby} = ${totalPumps}`, 'pumps'),
      row('Calculated pump flow', n(flowPerPump), 'm³/hr'),
      row('Pump flow (rounded)', n(roundedFlow,1), 'm³/hr'),
      row('Minimum storage volume (V)', n(Vmin), 'm³'),
      row('Number of sumps', nsumps, ''),
      row('Required volume / sump', n(Vsump), 'm³'),
      row('Operating water level', n(H,2), 'm'),
      row('Required area', n(area), 'm²'),
      row('Diameter (circular - rounded)', n(diameter,1), 'm', 'hl'),
      row('Actual area', n(actualArea), 'm²'),
      row('Actual volume', n(actualVol), 'm³'),
      row('Total depth (water level + freeboard + LLL)', n(totalDepth,2), 'm'),
    ])) +
    subsec('1.2 Pump Head', table([
      row('Static Head', n(staticHead,1), 'm'),
      row('Friction losses', n(losses,1), 'm'),
      row('Required residual pressure', n(remPress,1), 'm'),
      row('Required total head', n(head,2), 'm'),
      row('Total head (rounded)', n(roundedHead,0), 'm', 'hl'),
    ])) +
    noteBox('It is recommended to review the pump performance curve (Pump Curve) to match the operating point BEP with the values above, and to consider the NPSH available.');

  return {html, headLoss:0, out:{}};
};

/* ===================== 2. SCREENING ===================== */
CALC.screen = function(ctx){
  const p = ctx.p;
  const type = p.screen_type || 'manual';
  const Qpeak = (I.Qavg/I.opHours)*I.peakFactor;
  const n_screens = p.screen_n ?? 1;
  let html;
  if(type==='basket'){
    const vp = p.screen_vel ?? 0.65;
    const A = (Qpeak/3600)/vp/n_screens;
    const D = Math.sqrt(4*A/Math.PI);
    const fillRatio = p.screen_fill ?? 70;
    const Hw = D*(fillRatio/100)*0.85;
    const clearRatio = p.screen_clear ?? 30;
    const W = D/(clearRatio/100);
    const s = p.screen_spacing ?? 20, b = p.screen_barWidth ?? 10;
    const nbars = Math.ceil((W-(s/1000))/((s+b)/1000));
    const Aw = Hw*W*0.7;
    html = subsec('2.1 Basket Screen', table([
      row('Peak flow', n(Qpeak), 'm³/hr'),
      row('Pipe velocity', n(vp,2), 'm/sec'),
      row('Number of screens', n_screens, ''),
      row('Pipe cross-section area', n(A,4), 'm²'),
      row('Pipe diameter', n(D,3), 'm', 'hl'),
      row('Number of bars (approx.)', nbars, 'bars'),
      row('Actual screen width', n(W,2), 'm'),
    ]));
  } else {
    const vc = p.screen_vel ?? 0.65;
    const A = (Qpeak/3600)/vc/n_screens;
    const Hch = p.screen_H ?? 0.03;
    const Wch = A/Hch;
    const s = p.screen_spacing ?? 20, b = p.screen_barWidth ?? 10;
    const nbars = Math.ceil((Wch-(s/1000))/((s+b)/1000));
    const actualW = ((nbars*(s+b))+s)/1000;
    const roundedW = roundUpTo(actualW,0.1);
    const wetArea = roundedW*Hch;
    const actualVc = (Qpeak/3600)/(wetArea*n_screens);
    const angle = p.screen_angle ?? 60;
    const vperp = actualVc*Math.sin(angle*Math.PI/180);
    html = subsec('2.1 Manual Bar Screen', table([
      row('Peak flow', n(Qpeak), 'm³/hr'),
      row('Channel velocity', n(vc,2), 'm/sec'),
      row('Number of screens', n_screens, ''),
      row('Channel cross-section area', n(A,4), 'm²'),
      row('Channel water depth', n(Hch,2), 'm'),
      row('Actual channel width (rounded)', n(roundedW,2), 'm', 'hl'),
      row('Number of bars', nbars, 'bars'),
      row('Actual channel velocity', n(actualVc,3), 'm/sec', actualVc>=0.3&&actualVc<=1.2?'':'warn'),
      row('Inclination angle', angle, 'deg'),
      row('Velocity perpendicular to bars', n(vperp,3), 'm/sec', vperp<=0.6?'':'warn'),
    ]));
  }
  html += noteBox('The screen applies no calculated change to the concentrations of BOD/TSS/FOG in the Mass Balance model (coarse-material removal only), per the original sheet methodology.');
  return {html, headLoss:0.10, out:{}};
};

/* ===================== 3. GRIT & GREASE CHAMBER ===================== */
CALC.grit = function(ctx){
  const p = ctx.p;
  const Qpeak = (I.Qavg/I.opHours)*I.peakFactor;
  const OR_day = p.grit_OR ?? 500;
  const OR_hr = OR_day/24;
  const A = Qpeak/OR_hr;
  const nCh = p.grit_n ?? 1;
  const Achamber = A/nCh;
  const W = p.grit_W ?? 0.6;
  const Lraw = Achamber/W;
  const L = roundUpTo(Lraw,0.5);
  const H = p.grit_H ?? 0.6;
  const vh = (Qpeak/3600)/(W*H*nCh);
  const V = nCh*L*W*H;
  const HRT_min = (V/Qpeak)*60;
  const actualOR = (Qpeak/(nCh*L*W))*24;
  const sandRate = p.grit_sandRate ?? 100;
  const sandVol = (Qpeak*24/1000)*sandRate;

  const html = subsec('3.1 Grit & Grease Chamber', table([
    row('Peak Flow', n(Qpeak), 'm³/hr'),
    row('Surface loading rate', n(OR_day,0)+' / '+n(OR_hr,2), 'm/day  |  m/hr'),
    row('Required area', n(A), 'm²'),
    row('Number of chambers', nCh, ''),
    row('Chamber width', n(W,2), 'm'),
    row('Chamber length (rounded)', n(L,2), 'm', 'hl'),
    row('Water level', n(H,2), 'm'),
    row('Horizontal velocity', n(vh,3), 'm/sec', vh>=0.15&&vh<=0.4?'':'warn'),
    row('Net volume', n(V), 'm³'),
    row('Retention time (HRT)', n(HRT_min,1), 'min'),
    row('Actual loading rate', n(actualOR,1), 'm/day'),
    row('Sand production rate', n(sandVol,1), 'lit/day'),
  ])) + noteBox('No documented removal ratios for BOD/COD/TSS at this stage in the reference methodology — its primary function is to protect downstream equipment from sand and large free oils.');
  return {html, headLoss:0.10, out:{}};
};

/* ===================== 4. GOS UNIT ===================== */
CALC.gos = function(ctx){
  const p = ctx.p;
  const s = ctx.stream;
  const Qpeak = (I.Qavg/I.opHours)*I.peakFactor;
  const nUnits = p.gos_n ?? 1;
  const flowPerUnit = Qpeak/nUnits;
  const rounded = roundUpTo(flowPerUnit,5);

  const rBOD = p.GOS_BOD ?? R.GOS_BOD, rTSS = p.GOS_TSS ?? R.GOS_TSS;
  const rFree = p.GOS_FreeOil ?? R.GOS_FreeOil, rEmul = p.GOS_EmulOil ?? R.GOS_EmulOil;
  const freeOilIn = s.FOG*0.9, emulOilIn = s.FOG*0.1;
  const freeOilOut = freeOilIn*(100-rFree)/100;
  const emulOut = emulOilIn*(100-rEmul)/100;
  const FOGout = freeOilOut+emulOut;
  const BODout = s.BOD*(100-rBOD)/100;
  const TSSout = s.TSS*(100-rTSS)/100;
  const codRemovalFactor = p.gos_codFogFactor ?? 3; // mg COD / mg FOG
  const codRemoved = codRemovalFactor*(s.FOG-FOGout);
  const CODout = Math.max(s.COD-codRemoved,0);
  const FOGtotalRemoval = ((s.FOG-FOGout)/s.FOG)*100;

  const fogRemovedKgDay = I.Qavg*(s.FOG-FOGout)/1000;
  const fogConc = p.gos_fogConc ?? 50;
  const fogMass = fogRemovedKgDay*100/fogConc;
  const fogDensity = p.gos_fogDensity ?? 850;
  const fogVol = fogMass/fogDensity;
  const storageDays = p.gos_storage ?? 2;
  const containerVol = fogVol*storageDays*1000;
  const roundedContainer = roundUpStd(containerVol,[100,150,200,300,500,1000,2000]);

  const html =
    subsec('4.1 Unit Capacity', table([
      row('Number of units', nUnits, ''),
      row('Unit flow', n(flowPerUnit), 'm³/hr'),
      row('Rounded flow / unit', n(rounded,1), 'm³/hr', 'hl'),
    ])) +
    subsec('4.2 Removal Ratios and Resulting Concentrations', table([
      row('BOD5 In / Out', `${n(s.BOD,0)} → ${n(BODout,0)}`, 'mg/l'),
      row('TSS In / Out', `${n(s.TSS,0)} → ${n(TSSout,0)}`, 'mg/l'),
      row('FOG In / Out', `${n(s.FOG,1)} → ${n(FOGout,1)}`, 'mg/l', 'hl'),
      row('Total FOG removal ratio', n(FOGtotalRemoval,1), '%'),
      row('COD In / Out', `${n(s.COD,0)} → ${n(CODout,0)}`, 'mg/l'),
    ])) +
    subsec('4.3 Removed Oil Quantity', table([
      row('Removed oils', n(fogRemovedKgDay,2), 'kg/day'),
      row('Oil mass (at concentration of '+fogConc+'%)', n(fogMass,2), 'kg/day'),
      row('Removed oil volume', n(fogVol,3), 'm³/day'),
      row('Storage duration', storageDays, 'day'),
      row('Required collection tank volume (rounded)', roundedContainer, 'liter', 'hl'),
    ]));

  return {html, headLoss:0.20, out:{BOD:BODout, TSS:TSSout, FOG:FOGout, COD:CODout, pH:s.pH}};
};

/* ===================== 5. BALANCING / EQUALIZATION TANK ===================== */
CALC.eq = function(ctx){
  const p = ctx.p;
  const Qavg_hr = I.Qavg/I.opHours;
  const Qpeak_hr = Qavg_hr*I.peakFactor;
  const RT = p.eq_RT ?? 4;
  const Vmin = (Qpeak_hr-Qavg_hr)*RT;
  const nTanks = p.eq_n ?? 1;
  const Vtank = Vmin/nTanks;
  const H = p.eq_H ?? 5;
  const WL = p.eq_WL ?? 4.7;
  const area = Vtank/WL;
  const shape = p.eq_shape || 'circular';
  let actualArea, dims;
  if(shape==='circular'){
    const D = roundUpStd(Math.sqrt(4*area/Math.PI), STD_DIAMETERS);
    actualArea = Math.PI/4*D*D;
    dims = `Ø ${n(D,1)} m`;
  } else {
    const W = p.eq_W ?? 3;
    const L = roundUpTo(area/W,0.5);
    actualArea = W*L;
    dims = `${n(W,1)} × ${n(L,1)} m`;
  }
  const actualVol = actualArea*WL*nTanks;
  const actualRT = actualVol/(Qpeak_hr-Qavg_hr);

  const dutyPumps = p.eq_duty ?? 1, standby = p.eq_standby ?? 1;
  const pumpFlow = Qavg_hr/dutyPumps;
  const roundedPumpFlow = roundUpTo(pumpFlow,5);

  const airRate = p.eq_airRate ?? 1;
  const airQty = airRate*actualVol;

  const html =
    subsec('5.1 Balancing Tank Dimensions', table([
      row('Adopted retention time', RT, 'hr'),
      row('Minimum required volume', n(Vmin), 'm³'),
      row('Number of tanks', nTanks, ''),
      row('Tank volume', n(Vtank), 'm³'),
      row('Total height', n(H,2), 'm'),
      row('Operating water level', n(WL,2), 'm'),
      row('Required area', n(area), 'm²'),
      row('Actual dimensions ('+(shape==='circular'?'Circular':'Rectangular')+')', dims, '', 'hl'),
      row('Actual volume', n(actualVol), 'm³'),
      row('Actual retention time', n(actualRT,2), 'hr', 'hl'),
    ])) +
    subsec('5.2 Feed Pumps', table([
      row('Number of pumps (duty+standby)', `${dutyPumps} + ${standby}`, 'pumps'),
      row('Pump flow', n(pumpFlow), 'm³/hr'),
      row('Rounded flow', n(roundedPumpFlow,1), 'm³/hr', 'hl'),
    ])) +
    subsec('5.3 Mixing Air', table([
      row('Air rate', airRate, 'm³ Air/hr/m³'),
      row('Required air quantity', n(airQty,1), 'm³ Air/hr', 'hl'),
    ]));

  return {html, headLoss:0.30, out:{}};
};

/* ===================== 6. ROTARY FINE SCREEN ===================== */
CALC.rfs = function(ctx){
  const p = ctx.p;
  const s = ctx.stream;
  const Qavg_hr = I.Qavg/I.opHours;
  const blockage = p.rfs_blockage ?? 60;
  const nScreens = p.rfs_n ?? 1;
  const nominal = Qavg_hr/(blockage/100)/nScreens;
  const rounded = roundUpTo(nominal,5);

  const rBOD = p.RFS_BOD ?? R.RFS_BOD, rTSS = p.RFS_TSS ?? R.RFS_TSS;
  const rFree = p.RFS_FreeOil ?? R.RFS_FreeOil, rEmul = p.RFS_EmulOil ?? R.RFS_EmulOil;
  const rNonSolCOD = p.RFS_NonSolCOD ?? R.RFS_NonSolCOD;
  const freeIn = s.FOG*0.9, emulIn = s.FOG*0.1;
  const freeOut = freeIn*(100-rFree)/100, emulOut = emulIn*(100-rEmul)/100;
  const FOGout = freeOut+emulOut;
  const BODout = s.BOD*(100-rBOD)/100;
  const TSSout = s.TSS*(100-rTSS)/100;
  const solCODin = s.COD*0.5, nonSolCODin = s.COD*0.5;
  const nonSolCODout = nonSolCODin*(100-rNonSolCOD)/100;
  const CODout = solCODin+nonSolCODout;

  const screeningsRate = p.rfs_rate ?? 100;
  const screeningsVol = (screeningsRate*I.Qavg/1000);
  const storageDays = p.rfs_storage ?? 2;
  const containerVol = screeningsVol*storageDays;
  const rounded2 = roundUpStd(containerVol,[40,60,100,200,300]);

  const html =
    subsec('6.1 Screen Capacity', table([
      row('Average hourly flow', n(Qavg_hr), 'm³/hr'),
      row('Assumed blockage ratio', blockage, '%'),
      row('Number of screens', nScreens, ''),
      row('Nominal flow', n(nominal), 'm³/hr'),
      row('Rounded flow', n(rounded,1), 'm³/hr', 'hl'),
    ])) +
    subsec('6.2 Removal Ratios and Resulting Concentrations', table([
      row('BOD5 In / Out', `${n(s.BOD,0)} → ${n(BODout,0)}`, 'mg/l'),
      row('TSS In / Out', `${n(s.TSS,0)} → ${n(TSSout,0)}`, 'mg/l'),
      row('FOG In / Out', `${n(s.FOG,1)} → ${n(FOGout,1)}`, 'mg/l'),
      row('COD In / Out', `${n(s.COD,0)} → ${n(CODout,0)}`, 'mg/l', 'hl'),
    ])) +
    subsec('6.3 Screenings', table([
      row('Production rate', screeningsRate, 'l/1000m³'),
      row('Daily volume', n(screeningsVol,2), 'l/day'),
      row('Storage duration', storageDays, 'day'),
      row('Required container volume (rounded)', rounded2, 'liter', 'hl'),
    ]));

  return {html, headLoss:0.10, out:{BOD:BODout, TSS:TSSout, FOG:FOGout, COD:CODout, pH:s.pH}};
};

/* ===================== 7. DAF CHEMICAL DOSING ===================== */
CALC.dafchem = function(ctx){
  const p = ctx.p;
  const s = ctx.stream;

  // pH adjustment
  const targetPH = p.chem_targetPH ?? 8;
  const doseFactor = p.chem_phFactor ?? 10; // mg/l per 0.1 pH
  const naohDose = Math.max((targetPH - s.pH)*doseFactor/0.1, 0);
  const naoh = dosingSet(I.Qavg, naohDose, p.chem_naohRawConc??48, p.chem_naohDensity??1524, p.chem_naohDoseConc??12, p.chem_naohStorage??2, I.opHours);

  // Coagulant
  const coagDose = p.chem_coagDose ?? 100;
  const coag = dosingSet(I.Qavg, coagDose, p.chem_coagRawConc??48, p.chem_coagDensity??1150, p.chem_coagDoseConc??12, p.chem_coagStorage??2, I.opHours);

  // Polymer / Flocculant
  const polyDose = p.chem_polyDose ?? 1;
  const poly = dosingSet(I.Qavg, polyDose, p.chem_polyRawConc??100, p.chem_polyDensity??1500, p.chem_polyDoseConc??1, p.chem_polyStorage??2, I.opHours);

  function tankRound(v){return roundUpStd(v,[60,100,150,200,300,500,1000]);}

  const html =
    subsec('7.1 pH Adjustment System (NaOH)', table([
      row('Influent / Target pH', `${n(s.pH,2)} → ${targetPH}`, ''),
      row('Caustic soda dose', n(naohDose,1), 'mg/l'),
      row('Daily consumption', n(naoh.dailyConsumption,2), 'kg/day'),
      row('Dosing rate', n(naoh.dosingRate,2), 'l/hr'),
      row('Dosing pump capacity', n(naoh.pumpSizing,2), 'l/hr'),
      row('Storage tank volume (rounded)', tankRound(naoh.tankVolume), 'liter', 'hl'),
    ])) +
    subsec('7.2 Coagulant Dosing System', table([
      row('Coagulant dose', coagDose, 'mg/l'),
      row('Daily consumption', n(coag.dailyConsumption,2), 'kg/day'),
      row('Dosing rate', n(coag.dosingRate,2), 'l/hr'),
      row('Dosing pump capacity', n(coag.pumpSizing,2), 'l/hr'),
      row('Storage tank volume (rounded)', tankRound(coag.tankVolume), 'liter', 'hl'),
    ])) +
    subsec('7.3 Polymer Dosing System', table([
      row('Polymer dose', polyDose, 'mg/l'),
      row('Daily consumption', n(poly.dailyConsumption,3), 'kg/day'),
      row('Dosing rate', n(poly.dosingRate,2), 'l/hr'),
      row('Dosing pump capacity', n(poly.pumpSizing,2), 'l/hr'),
      row('Storage tank volume (rounded)', tankRound(poly.tankVolume), 'liter', 'hl'),
    ]));

  return {html, headLoss:0, out:{pH:targetPH}};
};

/* ===================== 8. DAF UNIT ===================== */
CALC.daf = function(ctx){
  const p = ctx.p;
  const s = ctx.stream;
  const Qavg_hr = I.Qavg/I.opHours;
  const nUnits = p.daf_n ?? 1;
  const flowPerUnit = Qavg_hr/nUnits;
  const rounded = roundUpTo(flowPerUnit,5);

  const rBOD = p.DAF_BOD ?? R.DAF_BOD, rTSS = p.DAF_TSS ?? R.DAF_TSS;
  const rFree = p.DAF_FreeOil ?? R.DAF_FreeOil, rEmul = p.DAF_EmulOil ?? R.DAF_EmulOil;
  const rSolCOD = p.DAF_SolCOD ?? R.DAF_SolCOD, rNonSolCOD = p.DAF_NonSolCOD ?? R.DAF_NonSolCOD;

  const freeIn = s.FOG*0.9, emulIn = s.FOG*0.1;
  const freeOut = freeIn*(100-rFree)/100, emulOut = emulIn*(100-rEmul)/100;
  const FOGout = freeOut+emulOut;
  const BODout = s.BOD*(100-rBOD)/100;
  const TSSout = s.TSS*(100-rTSS)/100;
  const solCODin = s.COD*0.5, nonSolCODin = s.COD*0.5;
  const solCODout = solCODin*(100-rSolCOD)/100, nonSolCODout = nonSolCODin*(100-rNonSolCOD)/100;
  const CODout = solCODout+nonSolCODout;

  // sludge
  const prodFactor = p.daf_prodFactor ?? 1.2;
  const solidsRemoved = I.Qavg*((s.TSS-TSSout)+(s.FOG-FOGout))/1000*prodFactor;
  const solidsConc = p.daf_solidsConc ?? 6;
  const dryMass = solidsRemoved*100/solidsConc;
  const sludgeDensity = p.daf_sludgeDensity ?? 1030;
  const sludgeVol = dryMass/sludgeDensity;

  const html =
    subsec('8.1 DAF Unit Capacity', table([
      row('Average hourly flow', n(Qavg_hr), 'm³/hr'),
      row('Number of units', nUnits, ''),
      row('Unit flow', n(flowPerUnit), 'm³/hr'),
      row('Rounded flow / unit', n(rounded,1), 'm³/hr', 'hl'),
    ])) +
    subsec('8.2 Removal Ratios and Resulting Concentrations', table([
      row('BOD5 In / Out', `${n(s.BOD,0)} → ${n(BODout,0)}`, 'mg/l', 'hl'),
      row('TSS In / Out', `${n(s.TSS,0)} → ${n(TSSout,0)}`, 'mg/l', 'hl'),
      row('FOG In / Out', `${n(s.FOG,1)} → ${n(FOGout,1)}`, 'mg/l'),
      row('COD In / Out', `${n(s.COD,0)} → ${n(CODout,0)}`, 'mg/l', 'hl'),
    ])) +
    subsec('8.3 DAF Sludge Produced', table([
      row('Solids removed (incl. dosing factor)', n(solidsRemoved,1), 'kg/day'),
      row('Solids concentration in sludge', solidsConc, '%'),
      row('Dry sludge mass', n(dryMass,1), 'kg/day'),
      row('Sludge density', sludgeDensity, 'kg/m³'),
      row('DAF sludge volume', n(sludgeVol,2), 'm³/day', 'hl'),
    ]));

  return {html, headLoss:0.30, out:{BOD:BODout, TSS:TSSout, FOG:FOGout, COD:CODout, pH:s.pH, dafSludgeVol:sludgeVol, dafDryMass:dryMass}};
};

/* ===================== 9. AERATION TANK ===================== */
CALC.aeration = function(ctx){
  const p = ctx.p;
  const s = ctx.stream;
  const type = p.aer_type || 'Conventional Activated Sludge';
  const BODin = s.BOD, TSSin = s.TSS;
  const BODout = p.aer_BODout ?? I.sec_BOD;
  const TSSout = p.aer_TSSout ?? I.sec_TSS;

  const FM = p.aer_FM ?? 0.4;
  const MLSS = p.aer_MLSS ?? 3000;
  const MLVSSratio = p.aer_MLVSSratio ?? 0.8;
  const MLVSS = MLSS*MLVSSratio;

  const HRT_day = (BODin-BODout)/(FM*MLVSS);
  const HRT_hr = HRT_day*24;
  const Vreq = I.Qavg*HRT_day;
  const nTanks = p.aer_n ?? 1;
  const Vtank = Vreq/nTanks;
  const WL = p.aer_WL ?? 4;
  const area = Vtank/WL;
  const shape = p.aer_shape || 'circular';
  let actualArea, dims;
  if(shape==='circular'){
    const D = roundUpStd(Math.sqrt(4*area/Math.PI), STD_DIAMETERS);
    actualArea = Math.PI/4*D*D; dims = `Ø ${n(D,1)} m`;
  } else {
    const W = p.aer_W ?? 6;
    const L = roundUpTo(area/W,0.1);
    actualArea = W*L; dims = `${n(W,1)} × ${n(L,1)} m`;
  }
  const actualVol = actualArea*WL*nTanks;
  const Qavg_hr = I.Qavg/I.opHours;
  const actualHRT_hr = actualVol/Qavg_hr;
  const volLoading = (I.Qavg*BODin/1000)/actualVol;

  const actualMLVSS = (BODin-BODout)/(FM*(actualHRT_hr/24));
  const actualMLSS = actualMLVSS/MLVSSratio;

  const Yfactor = p.aer_Y ?? 0.6;
  const excessSolids = ((BODin-BODout)*Yfactor+(TSSin-TSSout))*I.Qavg/1000;
  const SVI = p.aer_SVI ?? 100;
  const C2pct = 1e6/SVI/10000;
  const Ms = excessSolids*100/C2pct;
  const sludgeDensity = p.aer_sludgeDensity ?? 1030;
  const Qw = Ms/sludgeDensity;
  const C2mgl = C2pct*10000;
  const SRT = (actualVol*actualMLSS)/(Qw*C2mgl);
  const RASratio = (actualMLSS/(C2mgl-actualMLSS))*100;

  const bodLoad = I.Qavg*(BODin-BODout)/1000;
  const AORfactor = p.aer_AORfactor ?? 1.2;
  const AOR = bodLoad*AORfactor;
  const AORSORratio = p.aer_AORSOR ?? 0.4;
  const SOR = AOR/AORSORratio;
  const O2ratio = p.aer_O2ratio ?? 23.1;
  const airMass = SOR/(O2ratio/100);
  const airDensity = p.aer_airDensity ?? 1.201;
  const airVolDay = airMass/airDensity;
  const OTErate = p.aer_OTErate ?? 5.5;
  const waterOverDiff = WL-0.2;
  const OTE = OTErate*waterOverDiff;
  const hourlyAir = airVolDay/(OTE/100)/I.opHours;

  const html =
    subsec('9.1 Treatment Type and Design Load', table([
      row('Biological treatment type', type, ''),
      row('BOD5 Influent (after primary treatment)', n(BODin,0), 'mg/l'),
      row('BOD5 target in effluent', n(BODout,0), 'mg/l'),
      row('Food-to-microorganism ratio (F/M)', FM, 'day⁻¹'),
      row('MLSS concentration (adopted)', n(MLSS,0), 'mg/l'),
      row('MLVSS', n(MLVSS,0), 'mg/l'),
    ])) +
    subsec('9.2 Aeration Tank Volume', table([
      row('Hydraulic retention time (HRT)', `${n(HRT_day,3)} day  |  ${n(HRT_hr,2)} hr`, ''),
      row('Required volume', n(Vreq), 'm³'),
      row('Number of tanks', nTanks, ''),
      row('Water level', n(WL,2), 'm'),
      row('Actual dimensions', dims, '', 'hl'),
      row('Actual volume', n(actualVol), 'm³', 'hl'),
      row('Actual retention time', n(actualHRT_hr,2), 'hr'),
      row('Volumetric loading rate', n(volLoading,3), 'kg BOD/m³/day', volLoading<=1.6?'':'warn'),
    ])) +
    subsec('9.3 Actual Operating Concentrations and Excess Sludge', table([
      row('Actual MLVSS', n(actualMLVSS,0), 'mg/l'),
      row('Actual MLSS', n(actualMLSS,0), 'mg/l', 'hl'),
      row('Sludge yield coefficient (Y)', Yfactor, 'kg SS/kg BOD'),
      row('Excess solids', n(excessSolids,1), 'kg/day'),
      row('SVI (assumed)', SVI, 'ml/g'),
      row('Excess sludge volume (Qw)', n(Qw,2), 'm³/day', 'hl'),
      row('Sludge age (SRT)', n(SRT,2), 'day'),
      row('Return sludge ratio (RAS)', n(RASratio,1), '%'),
    ])) +
    subsec('9.4 Aeration Air', table([
      row('BOD load removed', n(bodLoad,2), 'kg BOD/day'),
      row('Actual oxygen required (AOR)', n(AOR,1), 'kg O2/day'),
      row('Standard oxygen required (SOR)', n(SOR,1), 'kg O2/day'),
      row('Required air mass', n(airMass,1), 'kg Air/day'),
      row('Daily air volume', n(airVolDay,1), 'm³/day'),
      row('Oxygen transfer efficiency (OTE)', n(OTE,2), '%'),
      row('Required hourly air rate', n(hourlyAir,1), 'm³/hr', 'hl'),
    ]));

  return {html, headLoss:0.20, out:{BOD:BODout, TSS:TSSout, FOG:s.FOG, COD:s.COD, pH:s.pH,
      RASratio, excessSludgeVol:Qw, MLSS:actualMLSS, bioSolidsMass: excessSolids, aerationVol:actualVol,
      SVI, _hourlyAir:hourlyAir}};
};

/* ===================== 10. SETTLING TANK ===================== */
CALC.settling = function(ctx){
  const p = ctx.p;
  const s = ctx.stream;
  const Qavg_hr = I.Qavg/I.opHours;
  const RAS = ctx.upstream.aeration ? ctx.upstream.aeration.RASratio : 50;
  const MLSS = ctx.upstream.aeration ? ctx.upstream.aeration.MLSS : 3000;

  const OR = p.set_OR ?? 24;
  const totalArea = I.Qavg/OR;
  const nTanks = p.set_n ?? 2;
  const areaPerTank = totalArea/nTanks;
  const W = p.set_W ?? 5;
  const Lraw = areaPerTank/W;
  const L = roundUpTo(Lraw,0.5);
  const actualArea = nTanks*W*L;
  const surfLoadCheck = I.Qavg/actualArea;
  const solidsLoading = (Qavg_hr*MLSS/1000)/actualArea;
  const weirLenPerTank = L;
  const totalWeirLen = nTanks*weirLenPerTank;
  const weirLoading = I.Qavg/totalWeirLen;

  const WL = p.set_WL ?? 3;
  const netVol = actualArea*WL;
  const HRT = netVol/Qavg_hr;

  const SVI = p.set_SVI ?? (ctx.upstream.aeration ? ctx.upstream.aeration.SVI : 100);
  const Vo = 8.53094*Math.exp(-0.00165*(p.set_SVI ?? 100));
  const K = 0.20036+0.00001*(p.set_SVI ?? 100);

  const html =
    subsec('10.1 Surface Loading', table([
      row('Surface loading rate', OR, 'm/day'),
      row('Total required area', n(totalArea), 'm²'),
      row('Number of tanks', nTanks, ''),
      row('Area per tank', n(areaPerTank), 'm²'),
      row('Tank width', n(W,2), 'm'),
      row('Tank length (rounded)', n(L,2), 'm', 'hl'),
      row('Total actual area', n(actualArea), 'm²'),
    ])) +
    subsec('10.2 Loading Rate Checks', table([
      row('Actual surface loading rate', n(surfLoadCheck,2), 'm/day', surfLoadCheck<=32?'':'warn'),
      row('Solids loading rate', n(solidsLoading,3), 'kg/hr/m²', solidsLoading<=0.6?'':'warn'),
      row('Total weir length', n(totalWeirLen,1), 'm'),
      row('Weir loading rate', n(weirLoading,1), 'm³/day/m', weirLoading<=185?'':'warn'),
    ])) +
    subsec('10.3 Volume and Retention Time', table([
      row('Water level', n(WL,2), 'm'),
      row('Net volume', n(netVol), 'm³'),
      row('Retention time (HRT)', n(HRT,2), 'hr', 'hl'),
    ])) +
    subsec('10.4 State Point Indicators', table([
      row('SVI (assumed)', SVI, 'ml/g'),
      row('Initial settling velocity (Vo)', n(Vo,2), 'm/hr'),
      row('Equation constant (K)', n(K,4), 'l/g'),
      row('Return sludge ratio (from aeration)', n(RAS,1), '%'),
    ])) +
    noteBox('Preliminary settleability indicators are shown. A full graphical Solids Flux / State Point analysis (SPA) is recommended at final detailed design to confirm the operating point does not exceed the critical concentration curve.');

  return {html, headLoss:0.25, out:{BOD:s.BOD, TSS:s.TSS, FOG:s.FOG, COD:s.COD, pH:s.pH}};
};

/* ===================== 11. SLUDGE HOLDING TANK ===================== */
CALC.sht = function(ctx){
  const p = ctx.p;
  const Qw = ctx.upstream.aeration ? ctx.upstream.aeration.excessSludgeVol : 0;
  const qty = p.sht_n ?? 1;
  const targetHRT = p.sht_HRT ?? 2;
  const Vreq = Qw*targetHRT;
  const sludgeLevel = p.sht_level ?? 3.5;
  const depth = p.sht_depth ?? 4;
  const area = Vreq/(qty*sludgeLevel);
  const W = p.sht_W ?? 4;
  const L = roundUpTo(area/W,0.1);
  const actualVol = qty*L*W*sludgeLevel;
  const actualHRT = actualVol/Qw;
  const bioSolids = ctx.upstream.aeration ? ctx.upstream.aeration.bioSolidsMass : 0;
  const solidLoadRate = bioSolids/(qty*L*W);
  const airRate = p.sht_airRate ?? 1.2;
  const airQty = airRate*actualVol;

  const html = subsec('11.1 Sludge Holding Tank Volume', table([
      row('Incoming excess sludge flow', n(Qw,2), 'm³/day'),
      row('Number of tanks', qty, ''),
      row('Target retention time', targetHRT, 'day'),
      row('Required volume', n(Vreq,2), 'm³'),
      row('Sludge level', n(sludgeLevel,2), 'm'),
      row('Width', n(W,2), 'm'),
      row('Length (rounded)', n(L,2), 'm', 'hl'),
      row('Actual volume', n(actualVol,2), 'm³'),
      row('Actual retention time', n(actualHRT,2), 'day', 'hl'),
      row('Solids loading rate', n(solidLoadRate,2), 'kg/m²/day'),
    ])) +
    subsec('11.2 Mixing Air', table([
      row('Air rate', airRate, 'm³ Air/hr/m³'),
      row('Required air quantity', n(airQty,1), 'm³ Air/hr', 'hl'),
    ]));
  return {html, headLoss:0, out:{shtAir:airQty}};
};

/* ===================== 12. AIR BLOWERS ===================== */
CALC.blowers = function(ctx){
  const p = ctx.p;
  const compFactor = p.blow_compFactor ?? 78;
  const eqAir = ctx.results.eq ? ctx.results.eq.airQty : 0;
  const aerAir = ctx.upstream.aeration ? ctx.upstream.aeration._hourlyAir : 0;
  const settTanks = ctx.p.set_n ?? 2;
  const airLiftRate = p.blow_airLiftRate ?? 30;
  const airLift = settTanks*airLiftRate;
  const shtAir = ctx.results.sht ? ctx.results.sht.shtAir : 0;

  const total = aerAir + (eqAir+airLift+shtAir)/(compFactor/100);
  const duty = p.blow_duty ?? 2;
  const perBlower = total/duty;
  const safetyMultiplier = p.blow_safety ?? 1.25;
  const rounded = perBlower*safetyMultiplier;
  const marginPct = ((rounded/perBlower)-1)*100;

  const html = subsec('12.1 Total Air Demand', table([
      row('Balancing tank air', n(eqAir,1), 'm³/hr'),
      row('Aeration tank air', n(aerAir,1), 'm³/hr'),
      row('Air-lift pump air', n(airLift,1), 'm³/hr'),
      row('Sludge holding tank air', n(shtAir,1), 'm³/hr'),
      row('Blower compression factor', compFactor, '%'),
      row('Total required air', n(total,1), 'm³/hr', 'hl'),
      row('Number of blowers (duty)', duty, ''),
      row('Requirement per blower', n(perBlower,1), 'm³/hr'),
      row('Selected blower capacity (with safety margin)', n(rounded,1), 'm³/hr', 'hl'),
      row('Safety margin', n(marginPct,1), '%'),
    ]));
  return {html, headLoss:0, out:{}};
};

/* ===================== 13. CHLORINE CONTACT TANK ===================== */
CALC.chlorine_tank = function(ctx){
  const p = ctx.p;
  const Qhr = p.cct_Q ?? (I.Qavg/I.opHours);
  const RT = p.cct_RT ?? 1.33;
  const Vreq = Qhr*RT;
  const nTanks = p.cct_n ?? 1;
  const VperTank = Vreq/nTanks;
  const L = p.cct_L ?? 7, W = p.cct_W ?? 2.2, depth = p.cct_depth ?? 4;
  const WL = p.cct_WL ?? 3.4;
  const actualVol = L*W*WL*nTanks;
  const actualRT = actualVol/Qhr;

  const html = subsec('13.1 Chlorine Contact Tank', table([
      row('Design hourly flow', n(Qhr,2), 'm³/hr'),
      row('Required contact time', RT, 'hr'),
      row('Required volume', n(Vreq,2), 'm³'),
      row('Number of tanks', nTanks, ''),
      row('Dimensions (L×W×water level)', `${n(L,1)} × ${n(W,1)} × ${n(WL,1)} m`, ''),
      row('Actual volume', n(actualVol,2), 'm³', 'hl'),
      row('Actual contact time', n(actualRT,2), 'hr', 'hl'),
    ]));
  return {html, headLoss:0.15, out:{}};
};

/* ===================== 14. CHLORINE DOSING SET ===================== */
CALC.chlorine_dose = function(ctx){
  const p = ctx.p;
  const dose = p.cld_dose ?? 10;
  const d = dosingSet(I.Qavg, dose, p.cld_rawConc??65, p.cld_density??1100, p.cld_doseConc??12, p.cld_storage??3, I.opHours);
  const tank = roundUpStd(d.tankVolume,[60,100,150,200,300]);
  const html = subsec('14.1 Sodium Hypochlorite Dosing System', table([
      row('Chlorine dose', dose, 'mg/l'),
      row('Daily consumption', n(d.dailyConsumption,2), 'kg/day'),
      row('Dosing rate', n(d.dosingRate,2), 'l/hr'),
      row('Dosing pump capacity', n(d.pumpSizing,2), 'l/hr'),
      row('Storage tank volume (rounded)', tank, 'liter', 'hl'),
    ]));
  return {html, headLoss:0, out:{}};
};

/* ===================== 15. MULTIMEDIA FILTERS ===================== */
CALC.mmf = function(ctx){
  const p = ctx.p;
  const Qhr = p.mmf_Q ?? (I.Qavg/I.opHours);
  const nFilters = p.mmf_n ?? 2;
  const rate = p.mmf_rate ?? 10;
  const totalArea = Qhr/rate;
  const areaPerFilter = totalArea/nFilters;
  const Draw = Math.sqrt(4*areaPerFilter/Math.PI);
  const D = roundUpStd(Draw, STD_DIAMETERS);
  const actualAreaPer = Math.PI/4*D*D;
  const actualTotalArea = actualAreaPer*nFilters;
  const actualRate = Qhr/actualTotalArea;

  const html = subsec('15.1 Multimedia Filters', table([
      row('Design hourly flow', n(Qhr,2), 'm³/hr'),
      row('Number of filters', nFilters, ''),
      row('Filtration rate', rate, 'm/hr'),
      row('Total required area', n(totalArea,2), 'm²'),
      row('Area per filter', n(areaPerFilter,2), 'm²'),
      row('Filter diameter (standard, rounded)', n(D,1), 'm', 'hl'),
      row('Total actual area', n(actualTotalArea,2), 'm²'),
      row('Actual filtration rate at operation', n(actualRate,2), 'm/hr', actualRate<=15?'':'warn'),
    ]));
  return {html, headLoss:0.60, out:{}};
};

/* ===================== 16. CARTRIDGE FILTERS ===================== */
CALC.cf = function(ctx){
  const p = ctx.p;
  const Qhr = I.Qavg/I.opHours;
  const rateTie = p.cf_rateTie ?? 0.65;
  const cartLen = p.cf_cartLen ?? 40;
  const tieLen = p.cf_tieLen ?? 10;
  const requiredTies = Qhr/rateTie;
  const requiredCartridges = (tieLen*requiredTies)/cartLen;
  const rounded = Math.ceil(requiredCartridges);
  const actualRateTie = Qhr/(rounded*(cartLen/tieLen));

  const html = subsec('16.1 Cartridge Filters', table([
      row('Hourly flow', n(Qhr,2), 'm³/hr'),
      row('Filtration rate / Tie', rateTie, 'm³/hr/tie'),
      row('Required number of Ties', n(requiredTies,2), ''),
      row('Required number of cartridges', n(requiredCartridges,2), ''),
      row('Number of cartridges (rounded)', rounded, 'cartridges', 'hl'),
      row('Actual filtration rate', n(actualRateTie,3), 'm³/hr/tie', 'hl'),
    ]));
  return {html, headLoss:0.40, out:{}};
};

/* ===================== 17. RO CHEMICAL DOSING ===================== */
CALC.rochem = function(ctx){
  const p = ctx.p;
  const permeateFlow = ctx.results.ro ? ctx.results.ro.permeateFlow : I.Qavg*0.65;

  const smbs = dosingSet(I.Qavg, p.rc_smbsDose??3, p.rc_smbsRawConc??98, p.rc_smbsDensity??1480, p.rc_smbsDoseConc??20, p.rc_smbsStorage??2, I.opHours);
  const antisc = dosingSet(I.Qavg, p.rc_antiDose??3, p.rc_antiRawConc??100, p.rc_antiDensity??1010, p.rc_antiDoseConc??50, p.rc_antiStorage??2, I.opHours);
  const phpost = dosingSet(permeateFlow, p.rc_phDose??50, p.rc_phRawConc??48, p.rc_phDensity??1500, p.rc_phDoseConc??12, p.rc_phStorage??2, I.opHours);
  function tr(v){return roundUpStd(v,[60,100,150,200,300]);}

  const html =
    subsec('17.1 SMBS Dosing (Dechlorination)', table([
      row('Dose', p.rc_smbsDose??3, 'mg/l'),
      row('Daily consumption', n(smbs.dailyConsumption,3), 'kg/day'),
      row('Dosing rate', n(smbs.dosingRate,3), 'l/hr'),
      row('Storage tank volume', tr(smbs.tankVolume), 'liter', 'hl'),
    ])) +
    subsec('17.2 Antiscalant Dosing', table([
      row('Dose', p.rc_antiDose??3, 'mg/l'),
      row('Daily consumption', n(antisc.dailyConsumption,3), 'kg/day'),
      row('Dosing rate', n(antisc.dosingRate,3), 'l/hr'),
      row('Storage tank volume', tr(antisc.tankVolume), 'liter', 'hl'),
    ])) +
    subsec('17.3 Post-Treatment pH Adjustment', table([
      row('Permeate flow', n(permeateFlow,1), 'm³/day'),
      row('Dose', p.rc_phDose??50, 'mg/l'),
      row('Daily consumption', n(phpost.dailyConsumption,2), 'kg/day'),
      row('Storage tank volume', tr(phpost.tankVolume), 'liter', 'hl'),
    ]));
  return {html, headLoss:0, out:{}};
};

/* ===================== 18. RO SKID ===================== */
CALC.ro = function(ctx){
  const p = ctx.p;
  const feed = I.Qavg;
  const recovery = p.ro_recovery ?? 65;
  const permeateFlow = feed*recovery/100;
  const rejectFlow = feed-permeateFlow;
  const flux = p.ro_flux ?? 22; // LMH
  const permeateHr = permeateFlow/I.opHours*1000; // l/hr
  const requiredArea = permeateHr/flux; // m2
  const elementArea = p.ro_elementArea ?? 37.16; // m2 (8" x 40" element ~ 400 sqft)
  const elements = Math.ceil(requiredArea/elementArea);
  const elemPerVessel = p.ro_elemPerVessel ?? 6;
  const vessels = Math.ceil(elements/elemPerVessel);

  const html = subsec('18.1 RO Skid', table([
      row('Feed flow', n(feed,1), 'm³/day'),
      row('Recovery', recovery, '%'),
      row('Permeate flow', n(permeateFlow,1), 'm³/day', 'hl'),
      row('Reject flow (Brine)', n(rejectFlow,1), 'm³/day'),
      row('Flux', flux, 'LMH'),
      row('Required membrane area', n(requiredArea,1), 'm²'),
      row('Number of membrane elements (8"×40")', elements, 'elements'),
      row('Number of pressure vessels (6 elements/vessel)', vessels, 'vessels', 'hl'),
    ])) + noteBox('Element and vessel counts are approximate, for preliminary pricing only — they must be verified with the supplier’s official membrane design software (ROSA / WAVE / IMSDesign) before final approval.');
  return {html, headLoss:1.20, out:{permeateFlow, rejectFlow}};
};

/* ===================== 19. TOTAL SLUDGE QUANTITY ===================== */
CALC.sludgeqty = function(ctx){
  const dafVol = ctx.results.daf ? ctx.results.daf.dafSludgeVol : 0;
  const dafDry = ctx.results.daf ? ctx.results.daf.dafDryMass : 0;
  const bioVol = ctx.upstream.aeration ? ctx.upstream.aeration.excessSludgeVol : 0;
  const bioSolids = ctx.upstream.aeration ? ctx.upstream.aeration.bioSolidsMass : 0;
  const totalVol = dafVol+bioVol;
  const totalDry = dafDry+bioSolids;
  const html = subsec('19.1 Total Sludge Quantity Produced', table([
      row('DAF sludge (volume / dry solids)', `${n(dafVol,2)} m³/d  |  ${n(dafDry,1)} kg/d`, ''),
      row('Excess biological sludge (volume / dry solids)', `${n(bioVol,2)} m³/d  |  ${n(bioSolids,1)} kg/d`, ''),
      row('Total sludge flow', n(totalVol,2), 'm³/day', 'hl'),
      row('Total dry solids', n(totalDry,1), 'kg/day', 'hl'),
    ]));
  return {html, headLoss:0, out:{totalSludgeVol:totalVol, totalDrySolids:totalDry}};
};

/* ===================== 20. SLUDGE DEWATERING ===================== */
CALC.dewater = function(ctx){
  const p = ctx.p;
  const totalVol = ctx.results.sludgeqty ? ctx.results.sludgeqty.totalSludgeVol : 0;
  const totalDry = ctx.results.sludgeqty ? ctx.results.sludgeqty.totalDrySolids : 0;
  const sludgeDensity = p.dw_density ?? 1030;
  const outletConc = p.dw_outletConc ?? 5;
  const thickenedVol = (totalDry*100/outletConc)/sludgeDensity;
  const supernatant1 = totalVol-thickenedVol;
  const cakeConc = p.dw_cakeConc ?? 26;
  const cakeVol = (totalDry*100/cakeConc)/sludgeDensity;
  const cakeVolL = cakeVol*1000;

  const alt = p.dw_alt || 'belt';
  let procHtml, supernatantTotal;

  // Polymer conditioning (shared)
  const polyDoseFactor = p.dw_polyDose ?? 4; // g/kg DS
  const polyMass = totalDry*polyDoseFactor/1000; // kg/day
  const polyRawConc = p.dw_polyRawConc ?? 0.2;
  const polyDaily = polyMass*100/polyRawConc;
  const polyDensity = p.dw_polyDensity ?? 1400;
  const polyDosingRate = (polyDaily/polyDensity)*1000/24;
  const polyPump = polyDosingRate/0.49;
  const polyStorage = p.dw_polyStorage ?? 2;
  const polyTank = polyDosingRate*polyStorage*24;
  const polyTankR = roundUpStd(polyTank,[100,200,300,500,1000,2000,5000,7500]);

  if(alt==='belt'){
    const workHours = p.dw_workHours ?? 16;
    const capacity = thickenedVol/workHours;
    const rounded = roundUpStd(capacity,[1,1.5,2,2.5,3,4,5,7.5,10]);
    supernatantTotal = thickenedVol-cakeVol;
    const bufferRT = p.dw_bufferRT ?? 15;
    const bufferVol = rounded*(bufferRT/60);
    const bufferRounded = roundUpStd(bufferVol,[0.5,1,1.5,2,3,5]);
    const actualBufferRT = (bufferRounded/rounded)*60;
    procHtml = subsec('20.2 Belt Press Capacity', table([
        row('Daily Operating Hours', workHours, 'hr'),
        row('Required capacity', n(capacity,2), 'm³/hr'),
        row('Selected standard capacity', n(rounded,1), 'm³/hr', 'hl'),
        row('Belt feed pump', n(rounded,1), 'm³/hr'),
      ])) + subsec('20.3 Buffer / Flocculation Tank', table([
        row('Target retention time', bufferRT, 'min'),
        row('Required volume', n(bufferVol,2), 'm³'),
        row('Rounded volume', bufferRounded, 'm³', 'hl'),
        row('Actual retention time', n(actualBufferRT,1), 'min'),
      ]));
  } else {
    const nPresses = p.dw_nPresses ?? 1;
    const batches = p.dw_batches ?? 4;
    const batchVol = (cakeVol/batches/nPresses)*1000;
    const feedVol = thickenedVol/batches;
    const feedDuration = p.dw_feedDuration ?? 1;
    const totalWorkHours = feedDuration*batches;
    const feedPump = feedVol/feedDuration;
    const roundedPump = roundUpStd(feedPump,[1,2,3,5,7.5,10,15,20]);
    supernatantTotal = thickenedVol-cakeVol;
    procHtml = subsec('20.2 Filter Press Capacity', table([
        row('Number of units', nPresses, ''),
        row('Batches/day', batches, 'batch/day'),
        row('Batch volume', n(batchVol,1), 'l/batch'),
        row('Feed volume/batch', n(feedVol,2), 'm³/batch'),
        row('Feed duration', feedDuration, 'hr'),
        row('Total operating hours', totalWorkHours, 'hr/day'),
        row('Feed pump (rounded)', roundedPump, 'm³/hr', 'hl'),
      ])) + subsec('20.3 Buffer Tank', table([
        row('Required volume', n(feedVol,2), 'm³'),
        row('Rounded volume', roundUpStd(feedVol,[0.5,1,1.5,2,3,5]), 'm³', 'hl'),
      ]));
  }

  const html =
    subsec('20.1 Cake and Thickened Sludge Volume', table([
      row('Incoming sludge flow', n(totalVol,2), 'm³/day'),
      row('Total dry solids', n(totalDry,1), 'kg/day'),
      row('Thickened sludge concentration', outletConc, '%'),
      row('Thickened sludge volume', n(thickenedVol,2), 'm³/day'),
      row('Final cake concentration', cakeConc, '%'),
      row('Resulting cake volume', `${n(cakeVol,3)} m³/day  |  ${n(cakeVolL,1)} l/day`, '', 'hl'),
    ])) + procHtml +
    subsec('20.4 Polymer Dosing System (Conditioning)', table([
      row('Polymer dose', polyDoseFactor, 'g/kg DS'),
      row('Required mass', n(polyMass,2), 'kg/day'),
      row('Daily consumption (solution)', n(polyDaily,1), 'kg/day'),
      row('Dosing rate', n(polyDosingRate,2), 'l/hr'),
      row('Dosing pump capacity', n(polyPump,2), 'l/hr'),
      row('Storage tank volume (rounded)', polyTankR, 'liter', 'hl'),
    ]));

  return {html, headLoss:0, out:{supernatantVol:supernatantTotal}};
};

/* ===================== 21. SUPERNATANT SUMP ===================== */
CALC.supernatant = function(ctx){
  const p = ctx.p;
  const supFlow = ctx.results.dewater ? ctx.results.dewater.supernatantVol : 0;
  const workHours = p.sup_workHours ?? 16;
  const hourlyFlow = supFlow/workHours;
  const duty = p.sup_duty ?? 1, standby = p.sup_standby ?? 1;
  const flowPerPump = hourlyFlow/duty;
  const rounded = roundUpStd(flowPerPump,[0.5,1,1.5,2,3,5,10]);
  const Qp = rounded/3600;
  const actualOpHrs = supFlow/(duty*rounded);
  const WT = p.sup_WT ?? 4;
  const interval = 3600/WT;
  const Vmin = (duty*Qp*interval)/WT;
  const nsumps = p.sup_n ?? 1;
  const Vsump = Vmin/nsumps;
  const level = p.sup_level ?? 0.4;
  const area = Vsump/level;
  const W = p.sup_W ?? 0.4;
  const L = roundUpTo(area/W,0.1);
  const actualVol = nsumps*level*W*L;
  const freeboard = p.sup_freeboard ?? 0.3, LLL = p.sup_LLL ?? 0.3;
  const totalDepth = level+freeboard+LLL;

  const html = subsec('21.1 Supernatant Sump', table([
      row('Incoming supernatant flow', n(supFlow,2), 'm³/day'),
      row('Operating hours', workHours, 'hr'),
      row('Hourly flow', n(hourlyFlow,3), 'm³/hr'),
      row('Number of pumps (duty+standby)', `${duty} + ${standby}`, 'pumps'),
      row('Pump flow (rounded)', rounded, 'm³/hr', 'hl'),
      row('Minimum sump volume', n(Vmin,3), 'm³'),
      row('Water level', n(level,2), 'm'),
      row('Required area', n(area,3), 'm²'),
      row('Dimensions', `${n(W,2)} × ${n(L,2)} m`, '', 'hl'),
      row('Actual volume', n(actualVol,3), 'm³'),
      row('Total depth', n(totalDepth,2), 'm', 'hl'),
    ]));
  return {html, headLoss:0, out:{}};
};

