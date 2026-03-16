# Project Styring

## Formaal

Denne fasen etablerer en web-first baseline som kan brukes trygt pa dagens Arduino UNO-oppsett samtidig som repoet ryddes for videre migrering til XIAO BLE og mobilapp.

I scope:

- beholde eksisterende `web/` UI-struktur
- rydde repoet for lokale runtime-artefakter og utdaterte innganger
- rydde transport- og kalibreringskontrakter
- flytte delt domenelogikk til `packages/core`
- dokumentere dagens og fremtidig hardware/software tydelig
- holde repoet web-only og fjerne utfaset desktop-surface

Utenfor scope i denne fasen:

- redesign av web-UI
- faktisk BLE runtime i web
- full XIAO firmwareimplementasjon
- publisering av mobilapp

Ekstern device-stotte som er tillatt i denne fasen:

- Tindeq Progressor kan brukes som BLE-basert total-force-enhet i `web/`
- dette erstatter ikke `CURRENT_UNO_HX711`
- per-finger analytics og protokoller skal fortsatt behandles som native-only

## Naavaerende hardware

Aktiv hardwareprofil: `CURRENT_UNO_HX711`

Beskrivelse:

- 1 x Arduino UNO
- 4 x HX711
- 4 x strain/load cell
- USB serial til host-maskin

Kontrakter:

- firmware: `firmware/firmware.ino`
- host sender kommandoer for tare, debug og stream-modus
- aktiv sampletransport er newline-delimited serial tekst

## Naavaerende software

Aktive flater:

- `web/`
  - primar produktflate videre
  - Web Serial mot dagens hardware
  - ekstern BLE device-provider for Tindeq Progressor i total-force-modus
- `packages/core/`
  - felles TypeScript domene- og kontraktslag

Referanseflater:
- ingen

## Maalarkitektur

Maalprofil: `TARGET_XIAO_BLE_HX711`

Planlagt fysisk oppsett:

- 1 x Seeed XIAO BLE nRF52840
- 4 x HX711
- 4 x load cell
- 1 x 500 mAh LiPo
- 1 x liten skyvebryter
- 1 x felles GND/3V3-distribusjon pa liten perfboard

Planlagt softwarearkitektur:

- firmware med samme logiske sample/command-kontrakt over Serial og BLE
- delt domene i `packages/core`
- web som fortsatt kan brukes mot Serial
- native mobilapp som primar BLE-klient
- eventuell webtjeneste senere for lagring/admin, men ikke som forutsetning for lokal maaling

## Beslutninger

- Web-UI beholdes som baseline i denne fasen.
  - Status: aktiv
  - Dato: 2026-03-11
  - Begrunnelse: prosjektet trenger intern opprydding uten unodvendig UX-regresjon.

- `web/` er hovedretning videre.
  - Status: aktiv
  - Dato: 2026-03-11
  - Begrunnelse: browserbasert UI gir rask iterasjon mens mobil/BLE bygges senere.

- Den gamle desktop-surface er fjernet fra repoet.
  - Status: aktiv
  - Dato: 2026-03-16
  - Begrunnelse: `web/` og `packages/core` dekker produktretningen, og repoet skal vaere klarere for deling, hosting og videre produktisering.

- Repoet skal holdes fritt for lokale runtime-artefakter og byggeoutput.
  - Status: aktiv
  - Dato: 2026-03-15
  - Begrunnelse: GitHub- og produktklar repo-struktur er viktig nar `web/` er den delbare hovedflaten.

- Shared domain logic skal ligge i `packages/core`.
  - Status: aktiv
  - Dato: 2026-03-11
  - Begrunnelse: reduserer duplisering og holder serial/BLE/mobile/web pa samme kontrakt.

- En transportforbindelse skal ha kun en eksplisitt aktiv stream-modus om gangen.
  - Status: aktiv
  - Dato: 2026-03-11
  - Begrunnelse: fjerner uklarhet mellom `kg`-stream, `raw`-stream og klient-side kalibrering.

- Hardware- og firmwarebeslutninger skal referere til hardwareprofilnavn, ikke fritekst.
  - Status: aktiv
  - Dato: 2026-03-11
  - Begrunnelse: hindrer at dagens UNO-oppsett og framtidig XIAO-oppsett blandes sammen.

- Tindeq Progressor skal behandles som ekstern total-force-device, ikke som alternativ hardwareprofil.
  - Status: aktiv
  - Dato: 2026-03-16
  - Begrunnelse: holder `CURRENT_UNO_HX711` som full-fidelity per-finger baseline mens total-force-only workflows kan brukes uten native hardware.

## Aapne spoersmaal

- Hvordan GPIO- og strømoppsettet pa XIAO best håndterer 4 x HX711 uten a skape pin- eller strømbegrensninger.
- Om BLE-protokollen skal vaere ren tekst som Serial, eller en binar payload med tekstkompatibel adapter i klientlaget.
- Hvordan mobilappen skal distribueres teknisk:
  - React Native/Expo
  - Flutter
  - eller annen native BLE-stack
- Hvordan batteristatus, sleep, reconnect og firmware update skal eksponeres i en framtidig mobilflate.

## Risikoer

- Risiko: analytics blir duplisert direkte i `web/` i stedet for `packages/core`.
  - Konsekvens: ulike tall mellom skjermer og framtidige klienter.
  - Sannsynlighet: middels.
  - Tiltak: all ny domenelogikk flyttes til `packages/core`, og web bygger videre pa delte kontrakter.

- Risiko: bruker tror `MODE_KG_DIRECT` og `MODE_RAW` betyr det samme.
  - Konsekvens: feilkalibrering eller misvisende kraftverdier.
  - Sannsynlighet: middels.
  - Tiltak: tydelig settings-tekst, eksplisitt stream mode, auto-switch ved tydelige raw-counts.

- Risiko: visuell noise-gating skjuler reelle onset-data i tester.
  - Konsekvens: feil RFD/tidlig fase-metrikker.
  - Sannsynlighet: middels.
  - Tiltak: skill mellom displaydata og measured/captured data.

- Risiko: BLE-planlegging starter uten at dagens kontrakt er stabil.
  - Konsekvens: ny duplisering og flere migreringslag.
  - Sannsynlighet: middels.
  - Tiltak: kontrakt og delt kjerne ferdigstilles for Serial forst.

## Test- og akseptkriterier

Fasen er godkjent nar:

- `web/` fungerer fortsatt mot dagens `CURRENT_UNO_HX711`-oppsett.
- Hovedsider og navigasjon i web er ikke redesignet.
- README og styringsdokumenter peker nye brukere til `web/`.
- Domenelogikk for parsing, kalibrering, smoothing, segmentering, metrics og session analysis er flyttet til `packages/core`.
- Repoet har `AGENTS.md`, `PROJECT_CONTEXT.md` og dette styringsdokumentet pa plass.
- Web har automatiske tester for parser, settings-normalisering, raw/kg-modus og lagring.
- Repoet inneholder ikke utfaset desktop-app eller desktop-spesifikke instruksjoner.

Manuell verifisering som kreves senere pa fysisk hardware:

- Serial connect/disconnect
- tare
- kg-stream
- raw-stream
- testflyt
- session save/export

## Milepaeler

- Milepael 1: stabil web/core kontrakt pa dagens UNO serial-oppsett
- Milepael 2: ren web-only repo- og deploy-baseline
- Milepael 3: XIAO firmware spike med samme command/sample-kontrakt
- Milepael 4: BLE-klient i mobilapp
- Milepael 5: eventuell webtjeneste og synk/admin-funksjoner

## Endringslogg

- 2026-03-11: Opprettet formell styringsbaseline for web-first migrering.
- 2026-03-11: Formaliserte hardwareprofilene `CURRENT_UNO_HX711` og `TARGET_XIAO_BLE_HX711`.
- 2026-03-15: Ryddet repoet for lokale runtime-artefakter og tydeliggjorde `web/` som eneste aktive produktflate.
- 2026-03-16: Fjernet utfaset desktop-surface fra repoet og oppdaterte dokumentasjonen til web-only baseline.
