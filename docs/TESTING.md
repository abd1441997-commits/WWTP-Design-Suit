# Test checklist (run on a real phone before relying on the app)

Automated (already green in CI/local): `npm test`, `tests/e2e/browser.py`, `tests/e2e/native_sim.py`.
Manual device checks — tick each on **Android** and **iPhone**:

## Engineering
- [ ] Open the app → default project (200 m³/day) shows BOD 2,103 → final 200 mg/l, 18 stages.
- [ ] Compare 3 stages against your own calculation sheet with your own inputs (Lifting station, Aeration tank, Settling tank).
- [ ] Toggle optional units (Cartridge filters, RO) and alternatives (Basket screen, Filter press, rectangular tanks): numbers change, no blank cards.
- [ ] Enter an invalid value (flow 0, pH 15, 1.5 pumps): field turns red, a message appears, calculation unchanged.
- [ ] Set BOD to 150 mg/l: Aeration shows the red “cannot be sized” message and dependent units say “Not calculated” (no NaN/∞).
- [ ] Hydraulic Profile tab: swipe sideways; every enabled unit appears in order.

## Persistence
- [ ] Change inputs + project name, wait for “Saved hh:mm”, force-close the app, reopen → everything is back.
- [ ] Projects → New → edit → open the first project again → its own values return.
- [ ] Projects → Export on the phone → share sheet appears → save to Drive/Files; delete the project; Import the file → identical results.
- [ ] Airplane mode on: app opens, calculates, saves.

## PDF report
- [ ] Report tab → Export PDF → share sheet appears → save/open the PDF in a PDF viewer.
- [ ] Cover shows your project/profile data; tables not cut off; hydraulic profile pages readable; page numbers; no blank pages.
- [ ] Open the PDF on a PC and confirm text is selectable.

## Mobile experience
- [ ] Icon and name correct on the home screen; splash screen shows then the app opens full-screen.
- [ ] Keyboard: tapping a field scrolls it into view; bottom bar hides while typing; tapping from one field to the next keeps the keyboard.
- [ ] Notch/status bar and gesture bar do not overlap the header or the bottom bar; rotate to landscape and on a tablet.
- [ ] Android back button: from Report returns to Design; from Design leaves the app. Project sheet closes with back.
- [ ] Android: share sheet offers Drive/Files/WhatsApp; iOS: “Save to Files” works.

## Release
- [ ] Version shown/updated (Android versionName `1.0.<run>`), installing a newer APK over an older one succeeds (same key).
