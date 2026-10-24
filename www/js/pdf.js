/* Real (vector, selectable-text) PDF report, built from the same data/DOM as the on-screen report.
   Uses bundled jsPDF + jsPDF-AutoTable, so it works offline and inside the native WebViews
   (where window.print() is not available). */
const ReportPDF = (function () {
  const C = { ink: [11, 37, 54], teal: [14, 124, 116], steel: [62, 110, 147], line: [214, 222, 218], mut: [92, 112, 117],
    hl: [232, 243, 238], warnBg: [251, 240, 223], errBg: [251, 234, 231], amber: [198, 127, 46], red: [184, 74, 62], head: [238, 243, 241] };
  const M = 14, PW = 210, PH = 297, CW = PW - 2 * M, BOTTOM = PH - 16;

  /* standard PDF fonts only cover Latin-1: map the few other symbols the report uses */
  function clean(s) {
    return String(s == null ? '' : s)
      .replace(/\u2192/g, '->').replace(/\u0394/g, 'd').replace(/\u207B\u00B9/g, '^-1').replace(/\u207B/g, '-')
      .replace(/\u2212|\u2013|\u2014/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2026/g, '...').replace(/\u2265/g, '>=').replace(/\u2264/g, '<=').replace(/[\u2713\u26A0\u25B6\u00A0]/g, ' ')
      .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '').replace(/ {2,}/g, ' ').trim();
  }
  const txt = el => clean(el.textContent);

  function ctx() { return { y: 0 }; }
  function ensure(doc, st, h) { if (st.y + h > BOTTOM) { doc.addPage(); st.y = M + 2; } }

  function cover(doc, st) {
    const meta = Store.meta, prof = Store.profile;
    doc.setFillColor(...C.ink); doc.rect(0, 0, PW, 78, 'F');
    doc.setFillColor(...C.teal); doc.rect(0, 78, PW, 2.2, 'F');
    // monogram
    doc.setDrawColor(...C.teal); doc.setLineWidth(0.8); doc.roundedRect(M, 18, 16, 16, 2, 2, 'S');
    doc.setTextColor(...C.teal); doc.setFont('courier', 'bold'); doc.setFontSize(14);
    doc.text(clean(ProjectsUI.initials()), M + 8, 28.4, { align: 'center' });
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(21);
    doc.text('Industrial Wastewater', M, 52); doc.text('Treatment Plant', M, 61);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(159, 194, 192);
    doc.text('PRELIMINARY ENGINEERING DESIGN REPORT', M, 70);

    doc.setTextColor(...C.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    const nameLines = doc.splitTextToSize(clean(meta.name), CW);
    doc.text(nameLines, M, 98);
    let y = 98 + nameLines.length * 8 + 4;
    const rows = [['Client', meta.client || '-'], ['Site / location', meta.site || '-'], ['Project no.', meta.number || '-'],
      ['Document no.', ProjectsUI.docNo()], ['Revision', meta.revision || 'A'], ['Date', ProjectsUI.today()],
      ['Design flow', n(I.Qavg, 0) + ' m3/day'], ['Treatment stages', String(LAST.order.length)]];
    callTable(doc, { startY: y, margin: { left: M, right: M }, theme: 'plain', body: rows.map(r => r.map(clean)),
      styles: { fontSize: 9.5, cellPadding: { top: 1.8, bottom: 1.8, left: 0, right: 3 }, textColor: C.ink },
      columnStyles: { 0: { cellWidth: 40, textColor: C.mut, fontStyle: 'normal' }, 1: { fontStyle: 'bold' } },
      didDrawCell: d => { doc.setDrawColor(...C.line); doc.setLineWidth(0.1); doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height); } });
    y = doc.lastAutoTable.finalY + 14;
    doc.setDrawColor(...C.line); doc.line(M, y, M + 80, y);
    doc.setFont('courier', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.mut);
    doc.text('PREPARED BY', M, y + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C.ink); doc.text(clean(prof.name), M, y + 13);
    doc.setFont('courier', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.teal); doc.text(clean(prof.department).toUpperCase(), M, y + 19);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...C.mut);
    const disc = doc.splitTextToSize('Preliminary report for design and pricing purposes - subject to final engineering review before construction. Hydraulic profile is schematic and must be verified by site survey.', CW);
    doc.text(disc, M, PH - 24);
  }

  function callTable(doc, opts) {
    if (typeof doc.autoTable === 'function') return doc.autoTable(opts);
    return window.autoTable(doc, opts);
  }

  function heading(doc, st, text, level) {
    ensure(doc, st, level === 1 ? 16 : 12);
    if (level === 1) {
      doc.setFillColor(...C.teal); doc.rect(M, st.y, 1.4, 6.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...C.ink); doc.text(clean(text), M + 4, st.y + 5);
      st.y += 11;
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...C.teal);
      doc.text(clean(text).toUpperCase(), M, st.y + 3.5);
      doc.setDrawColor(...C.teal); doc.setLineWidth(0.4); doc.line(M, st.y + 5, M + Math.min(CW, doc.getTextWidth(clean(text).toUpperCase()) + 1), st.y + 5);
      st.y += 8;
    }
  }

  function tableFromDom(doc, st, tbl) {
    if (!tbl.rows || !tbl.rows.length) return;
    const isMb = tbl.classList.contains('mb-table');
    const columnStyles = isMb ? { 0: { halign: 'left', fontStyle: 'bold', fillColor: C.head, cellWidth: 56 } }
      : { 1: { fontStyle: 'bold', cellWidth: 52 }, 2: { cellWidth: 30, textColor: C.steel } };
    ensure(doc, st, 18);
    callTable(doc, { html: tbl, startY: st.y, margin: { left: M, right: M, bottom: 18 }, theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, lineColor: C.line, lineWidth: 0.1, textColor: C.ink, overflow: 'linebreak', halign: isMb ? 'center' : 'left' },
      headStyles: { fillColor: isMb ? C.ink : C.head, textColor: isMb ? [255, 255, 255] : C.mut, fontStyle: 'bold', fontSize: 7.5 },
      columnStyles, rowPageBreak: 'avoid',
      didParseCell: d => {
        d.cell.text = d.cell.text.map(clean);
        if (d.section === 'body' && d.row.raw && d.row.raw.classList) {
          if (d.row.raw.classList.contains('hl')) d.cell.styles.fillColor = C.hl;
          if (d.row.raw.classList.contains('warn')) d.cell.styles.fillColor = C.warnBg;
        }
      } });
    st.y = doc.lastAutoTable.finalY + 4;
  }

  function note(doc, st, el) {
    const t = txt(el); if (!t) return;
    const kind = el.classList.contains('err') ? 'err' : el.classList.contains('warn') ? 'warn' : 'info';
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const lines = doc.splitTextToSize(t, CW - 8);
    const h = lines.length * 3.7 + 4;
    ensure(doc, st, h + 2);
    doc.setFillColor(...(kind === 'err' ? C.errBg : kind === 'warn' ? C.warnBg : [245, 248, 246])); doc.rect(M, st.y, CW, h, 'F');
    doc.setFillColor(...(kind === 'err' ? C.red : kind === 'warn' ? C.amber : C.steel)); doc.rect(M, st.y, 1.2, h, 'F');
    doc.setTextColor(...(kind === 'info' ? C.mut : C.ink)); doc.text(lines, M + 4, st.y + 4.6);
    st.y += h + 3;
  }

  function para(doc, st, el, small) {
    const t = txt(el); if (!t) return;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(small ? 7.5 : 9); doc.setTextColor(...C.mut);
    const lines = doc.splitTextToSize(t, CW); ensure(doc, st, lines.length * 3.6 + 2);
    doc.text(lines, M, st.y + 3); st.y += lines.length * 3.6 + 3;
  }
  function bullets(doc, st, ul) {
    ul.querySelectorAll('li').forEach(li => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(txt(li), CW - 6); ensure(doc, st, lines.length * 3.8 + 1.5);
      const err = li.classList.contains('error');
      doc.setFillColor(...(err ? C.red : C.amber)); doc.circle(M + 1.2, st.y + 2.2, 0.9, 'F');
      doc.setTextColor(...C.ink); doc.text(lines, M + 5, st.y + 3); st.y += lines.length * 3.8 + 1.5;
    });
    st.y += 2;
  }

  function unit(doc, st, card) {
    const badge = clean((card.querySelector('.badge') || {}).textContent || '');
    const name = clean((card.querySelector('h3') || {}).textContent || '').replace(/\s*d?h?\s*[\d.]+\s*m$/, '');
    ensure(doc, st, 30);
    doc.setFillColor(...C.ink); doc.roundedRect(M, st.y, CW, 8, 1, 1, 'F');
    doc.setFillColor(...C.teal); doc.roundedRect(M + 1.5, st.y + 1.5, 5, 5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('courier', 'bold'); doc.setFontSize(8); doc.text(badge, M + 4, st.y + 5.2, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(cleanName(card), M + 9, st.y + 5.4);
    st.y += 11;
    const body = card.querySelector('.unit-card-body');
    Array.from(body.children).forEach(ch => {
      if (ch.classList.contains('subsec')) {
        const t = ch.querySelector('.subsec-title'); if (t) heading(doc, st, txt(t), 2);
        ch.querySelectorAll(':scope > table').forEach(tb => tableFromDom(doc, st, tb));
        ch.querySelectorAll(':scope > .note').forEach(nn => note(doc, st, nn));
      } else if (ch.classList.contains('note')) note(doc, st, ch);
      else if (ch.tagName === 'TABLE') tableFromDom(doc, st, ch);
    });
    st.y += 4;
  }
  function cleanName(card) {
    const h = card.querySelector('h3'); if (!h) return '';
    const c = h.cloneNode(true); c.querySelectorAll('.pill').forEach(p => p.remove()); return clean(c.textContent);
  }

  /* ---------- hydraulic profile as sharp raster slices ---------- */
  async function profile(doc, st) {
    const svg = document.querySelector('#hpSvgHolder svg'); if (!svg) return;
    const vb = svg.viewBox.baseVal; const Wv = vb.width, Hv = vb.height, SC = 2;
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', Wv * SC); clone.setAttribute('height', Hv * SC); clone.style.minWidth = '';
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    const img = new Image();
    const ok = await new Promise(res => { img.onload = () => res(true); img.onerror = () => res(false); img.src = url; });
    if (!ok) { para(doc, st, Object.assign(document.createElement('p'), { textContent: '(Hydraulic profile drawing could not be rendered on this device.)' })); return; }
    const per = 6 * 158, slices = Math.max(1, Math.ceil(LAST.order.length / 6));
    for (let k = 0; k < slices; k++) {
      const sx = k * per, sw = (k === slices - 1) ? Wv - sx : per;
      const cv = document.createElement('canvas'); cv.width = Math.round(sw * SC); cv.height = Math.round(Hv * SC);
      const g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, sx * SC, 0, sw * SC, Hv * SC, 0, 0, cv.width, cv.height);
      const hh = Math.min((cv.height / cv.width) * CW, 110);
      ensure(doc, st, hh + 3);
      doc.addImage(cv.toDataURL('image/png'), 'PNG', M, st.y, CW, hh, undefined, 'FAST');
      doc.setDrawColor(...C.line); doc.setLineWidth(0.1); doc.rect(M, st.y, CW, hh, 'S');
      st.y += hh + 3;
    }
  }

  async function section(doc, st, sec) {
    const h2 = sec.querySelector(':scope > h2');
    if (!h2) return; // footer line - replaced by page footers
    if (sec.querySelector('#reportHpHolder')) ensure(doc, st, 95); // keep the heading with its first drawing
    heading(doc, st, txt(h2), 1);
    for (const ch of Array.from(sec.children)) {
      if (ch === h2) continue;
      if (ch.tagName === 'TABLE') tableFromDom(doc, st, ch);
      else if (ch.classList.contains('unit-card')) unit(doc, st, ch);
      else if (ch.id === 'reportHpHolder') await profile(doc, st);
      else if (ch.tagName === 'UL') bullets(doc, st, ch);
      else if (ch.classList.contains('note')) note(doc, st, ch);
      else if (ch.tagName === 'P') para(doc, st, ch, true);
    }
    st.y += 3;
  }

  function footers(doc) {
    const total = doc.getNumberOfPages();
    for (let i = 2; i <= total; i++) {
      doc.setPage(i);
      doc.setDrawColor(...C.line); doc.setLineWidth(0.2); doc.line(M, PH - 12, PW - M, PH - 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.mut);
      doc.text(clean(Store.meta.name) + '  |  ' + ProjectsUI.docNo() + '  |  Rev ' + clean(Store.meta.revision), M, PH - 8);
      doc.text('Page ' + i + ' of ' + total, PW - M, PH - 8, { align: 'right' });
    }
  }

  async function build() {
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('PDF library is not loaded.');
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    doc.setProperties({ title: clean(Store.meta.name) + ' - Design Report', author: clean(Store.profile.name),
      subject: 'Industrial wastewater treatment plant - preliminary engineering design', creator: 'Industrial WWTP Design Suite' });
    const st = ctx();
    cover(doc, st);
    doc.addPage(); st.y = M + 2;
    const root = document.getElementById('reportDoc');
    for (const sec of Array.from(root.querySelectorAll(':scope > .report-sec'))) await section(doc, st, sec);
    footers(doc);
    return doc.output('blob');
  }

  async function exportPDF() {
    try {
      toast('Preparing PDF…', 'info');
      renderReport();
      const blob = await build();
      const file = Native.safeName(Store.meta.name) + '_Design_Report_' + new Date().toISOString().slice(0, 10) + '.pdf';
      const r = await Native.deliver({ filename: file, mime: 'application/pdf', blob, title: Store.meta.name + ' - Design Report' });
      toast(r.method === 'download' ? 'PDF downloaded.' : r.method === 'cancelled' ? 'Share cancelled.' : 'PDF ready - choose where to save or send it.', 'ok');
      return r;
    } catch (e) { toast('PDF export failed: ' + (e.message || e), 'err'); console.error(e); }
  }
  return { build, exportPDF };
})();
window.ReportPDF = ReportPDF;
