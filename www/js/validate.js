/* Input validation: every numeric input is range-checked before it reaches the engine. */
const Validate = (function () {
  // key: [min, max, integerOnly]
  const RULES = {
    // basic data
    Qavg:[1,2000000], opHours:[1,24], peakFactor:[1,10],
    // influent / targets (mg/l)
    BOD:[0,100000], COD:[0,300000], TSS:[0,200000], FOG:[0,100000], pH:[0,14],
    sec_BOD:[0,300000], sec_COD:[0,300000], sec_TSS:[0,200000], sec_FOG:[0,100000],
    ter_BOD:[0,300000], ter_COD:[0,300000], ter_TSS:[0,200000], ter_FOG:[0,100000],
    // lifting station
    lift_duty:[1,10,true], lift_standby:[0,10,true], lift_H:[0.1,10], lift_staticHead:[0,200],
    // screening / grit
    screen_n:[1,10,true], screen_vel:[0.1,3], screen_H:[0.005,2],
    grit_OR:[50,5000], grit_n:[1,10,true], grit_W:[0.1,5],
    // physical / physico-chemical
    gos_n:[1,20,true], GOS_BOD:[0,100], GOS_TSS:[0,100], GOS_FreeOil:[0,100],
    eq_RT:[0.1,48], eq_n:[1,20,true], eq_WL:[0.5,15],
    rfs_blockage:[5,100], rfs_n:[1,20,true], RFS_BOD:[0,100], RFS_TSS:[0,100],
    chem_targetPH:[0,14], chem_coagDose:[0,2000], chem_polyDose:[0,100],
    daf_n:[1,20,true], DAF_BOD:[0,100], DAF_TSS:[0,100], daf_solidsConc:[0.1,100],
    // biological
    aer_BODout:[1,5000], aer_TSSout:[1,5000], aer_FM:[0.02,2], aer_MLSS:[500,20000],
    aer_n:[1,20,true], aer_Y:[0.05,1.5], aer_SVI:[30,400],
    set_OR:[5,100], set_n:[1,20,true], set_W:[1,40], set_WL:[1,8],
    sht_n:[1,10,true], sht_HRT:[0.1,30], sht_W:[0.5,30],
    blow_compFactor:[10,100], blow_duty:[1,10,true], blow_safety:[1,3],
    // tertiary / RO
    cct_RT:[0.1,10], cct_L:[0.5,100], cct_W:[0.5,100], cld_dose:[0,500],
    mmf_n:[1,20,true], mmf_rate:[1,40], cf_rateTie:[0.05,10],
    rc_smbsDose:[0,100], rc_antiDose:[0,100], ro_recovery:[10,95], ro_flux:[5,60],
    // sludge
    dw_outletConc:[0.5,30], dw_cakeConc:[5,60], dw_polyDose:[0,50],
    dw_batches:[1,24,true], dw_nPresses:[1,20,true], sup_workHours:[1,24]
  };
  const DEFAULT_RULE = [0, 1e7];

  function labelOf(key) {
    try {
      for (const sec of GLOBAL_FIELDS) for (const f of sec.fields) if (f.k === key) return f.l;
      for (const id in FIELDS) for (const f of FIELDS[id]) if (f.k === key) return f.l;
    } catch (e) {}
    return key;
  }
  function parse(raw) {
    if (typeof raw === 'number') return raw;
    const s = String(raw == null ? '' : raw).trim().replace(',', '.');
    if (s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return NaN;
    return parseFloat(s);
  }
  function check(key, raw) {
    const x = parse(raw);
    const r = RULES[key] || DEFAULT_RULE;
    const name = labelOf(key);
    if (!isFinite(x)) return { ok: false, msg: name + ': enter a valid number.' };
    if (r[2] && !Number.isInteger(x)) return { ok: false, msg: name + ': enter a whole number (' + r[0] + '–' + r[1] + ').' };
    if (x < r[0] || x > r[1]) return { ok: false, msg: name + ': value must be between ' + r[0] + ' and ' + r[1] + '.' };
    return { ok: true, value: x };
  }
  function attrs(key) {
    const r = RULES[key] || DEFAULT_RULE;
    return 'min="' + r[0] + '" max="' + r[1] + '"' + (r[2] ? ' step="1"' : '');
  }
  function flag(el, msg) { if (!el) return; el.classList.add('invalid'); el.title = msg; }
  function clear(el) { if (!el) return; el.classList.remove('invalid'); el.removeAttribute('title'); }
  return { check, attrs, flag, clear, parse, rules: RULES };
})();
window.Validate = Validate;
