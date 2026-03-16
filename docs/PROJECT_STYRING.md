# Project Styring

## Formaal

Denne fasen etablerer en web-first baseline som kan brukes trygt pa dagens Arduino UNO-oppsett samtidig som repoet ryddes for videre migrering til XIAO BLE og mobilapp.

I scope:

- beholde eksisterende `web/` UI-struktur
- rydde repoet for lokale runtime-artefakter og utdaterte innganger
- rydde transport- og kalibreringskontrakter
- flytte delt domenelogikk til `packages/core`
- dokumentere dagens og fremtidig hardware/software tydelig
- beholde `app/` som legacy/reference uten aktiv bruk

Utenfor scope i denne fasen:

- redesign av web-UI
- faktisk BLE runtime i web
- full XIAO firmwareimplementasjon
- publisering av mobilapp

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
- `packages/core/`
  - felles TypeScript domene- og kontraktslag

Referanseflater:

- `app/`
  - Python desktop legacy-reference
  - brukes som kode- og parityreferanse til web/core overtar fullt
  - skal ikke brukes som aktiv produktflate

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

- `app/` beholdes som legacy/reference inntil TS-paritet er god nok.
  - Status: aktiv
  - Dato: 2026-03-11
  - Begrunnelse: Python-koden inneholder eksisterende analysemassasje og er nyttig som referanse under migrering.

- `app/` skal ikke brukes som aktiv operativ flate lenger.
  - Status: aktiv
  - Dato: 2026-03-15
  - Begrunnelse: produktretningen er web na, mens framtidig sluttflate er BLE-tilkoblet mobilapp.

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

## Aapne spoersmaal

- Hvordan GPIO- og strømoppsettet pa XIAO best håndterer 4 x HX711 uten a skape pin- eller strømbegrensninger.
- Om BLE-protokollen skal vaere ren tekst som Serial, eller en binar payload med tekstkompatibel adapter i klientlaget.
- Hvordan mobilappen skal distribueres teknisk:
  - React Native/Expo
  - Flutter
  - eller annen native BLE-stack
- Hvordan batteristatus, sleep, reconnect og firmware update skal eksponeres i en framtidig mobilflate.

## Risikoer

- Risiko: web- og app-analytics driver fra hverandre igjen.
  - Konsekvens: ulike tall for samme test.
  - Sannsynlighet: hoy hvis ny logikk legges to steder.
  - Tiltak: all ny domenelogikk flyttes til `packages/core`, og Python brukes som referanse inntil parity er bekreftet.

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
- README og styringsdokumenter peker nye brukere til `web/`, ikke `app/`.
- Domenelogikk for parsing, kalibrering, smoothing, segmentering, metrics og session analysis er flyttet til `packages/core`.
- Repoet har `AGENTS.md`, `PROJECT_CONTEXT.md` og dette styringsdokumentet pa plass.
- Web har automatiske tester for parser, settings-normalisering, raw/kg-modus og lagring.
- Python-testkjoring er robust baade via `python -m pytest` og vanlig `pytest`.

Manuell verifisering som kreves senere pa fysisk hardware:

- Serial connect/disconnect
- tare
- kg-stream
- raw-stream
- testflyt
- session save/export

## Milepaeler

- Milepael 1: stabil web/core kontrakt pa dagens UNO serial-oppsett
- Milepael 2: parity mellom Python-referanse og TS-core for sentrale metrics
- Milepael 3: XIAO firmware spike med samme command/sample-kontrakt
- Milepael 4: BLE-klient i mobilapp
- Milepael 5: eventuell webtjeneste og synk/admin-funksjoner

## Endringslogg

- 2026-03-11: Opprettet formell styringsbaseline for web-first migrering.
- 2026-03-11: Formaliserte hardwareprofilene `CURRENT_UNO_HX711` og `TARGET_XIAO_BLE_HX711`.
- 2026-03-11: Fastla at `app/` beholdes som referanse/legacy mens `web/` og `packages/core` tar over som hovedretning.
- 2026-03-15: Ryddet repoet for lokale runtime-artefakter og tydeliggjorde `web/` som eneste aktive produktflate.
