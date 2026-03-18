# Project Styring

## Dokumentrolle

Dette dokumentet oversetter [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) til aktiv prosjektstyring for `v1.5`.

Bruk det for:

- scope og faseavgrensning
- arkitekturretning og migreringsregler
- aktive beslutninger og guardrails
- risiko, akseptkriterier og milepaeler

Nar dokumenter spriker, er `PROJECT_CONTEXT.md` og dette dokumentet den autoritative baseline for repoet.

Separate forretnings-, pitch- eller kommersialiseringsspor kan dokumenteres i tillegg, men de skal ikke erstatte denne baseline uten eksplisitt oppdatering her.

## 1. Styringsbaseline for `v1.5`

Prosjektet styres etter disse faste punktene:

- repoet er `web`-first
- `web/` er eneste aktive operatorflate i dette repoet
- `packages/core/` er felles domene- og kontraktslag
- `firmware/` dekker dagens wired hardware-baseline
- aktiv hardwareprofil er `CURRENT_UNO_HX711`
- fremtidig maalprofil er `TARGET_XIAO_BLE_HX711`
- Tindeq Progressor er tillatt som ekstern total-force-only enhet
- produktet skilles tydelig mellom `LIVE`, `TEST` og `TRAIN`
- Serial og fremtidig BLE skal mappe til samme logiske sample-kontrakt

## 2. Scope i denne fasen

I scope na:

- beholde eksisterende `web/` informasjonsarkitektur som baseline
- levere og stabilisere godkjent `LIVE` first-screen redesign
- tydeliggjore rollefordelingen mellom `LIVE`, `TEST` og `TRAIN`
- holde device- og metricslogikk capability-aware
- innfore runtime-verifisering som blokkerer uverifisert visning og lagring av kraftdata
- flytte eller samle delt parsing-, kalibrerings-, metrics- og workoutlogikk i `packages/core`
- rydde repo, dokumentasjon og onboarding for videre web/BLE-migrering
- bevare secure-context krav for Web Serial og Web Bluetooth-kompatible flows

## 3. Utenfor scope i denne fasen

Ikke i scope na:

- full redesign av hele web-UI eller ny navigasjonsstruktur utenfor godkjent `LIVE` first screen
- produksjonsklar BLE-runtime i web
- full implementasjon av `TARGET_XIAO_BLE_HX711`
- native mobilapp
- hosted backend eller synk som forutsetning for lokal maaling
- ny desktop-surface eller alternativ operatorflate
- e-commerce, CAD-automatisering eller 3D-print ordrelogikk som del av denne repo-baselinen

Sistnevnte kan utforskes separat, men skal behandles som et eget strategispor til det eventuelt blir tatt inn i prosjektstyringen.

## 4. Produktmodell

Produktet skal behandles som tre tydelige flater:

### `LIVE`

- raske lokale maalinger
- quick capture
- connection flow og live visualisering
- siste resultat og enkel session entry

### `TEST`

- formelle benchmarker
- repeterbar maaling
- score, analyse og historisk sammenligning

### `TRAIN`

- guidede okter
- prescriptions og anbefalinger
- treningsresultater og progresjon

Styringsregel:

- `LIVE` er for rask bruk her og na
- `TEST` er for standardisert maaling
- `TRAIN` bruker testgrunnlag, men skal ikke lagre resultater som benchmarker

## 5. Navaerende baseline

### Aktiv hardwareprofil

`CURRENT_UNO_HX711`

Bekreftet oppsett:

- 1 x Arduino UNO
- 4 x HX711
- 4 x load cell / strain channels
- USB serial mellom device og host

### Aktiv softwareflate

- `web/`
  - aktiv produktflate
  - browser-app med Web Serial i dag
  - Tindeq-stotte for total-force-only capture
- `packages/core/`
  - delt TypeScript logikk for parsing, kalibrering, smoothing, segmentering, metrics og workouts
- `firmware/`
  - Arduino-firmware for dagens wired setup

### Canonical runtime- og device-regler

- en forbindelse skal ha nøyaktig en aktiv stream-modus om gangen: `raw` eller `kg`
- transporten er newline-delimited tekst
- sample payloads kan vaere CSV med eller uten timestamp, eller JSON etter definert kontrakt
- status- og debuglinjer starter med `#`
- per-finger analytics skal bare vises nar device faktisk leverer per-finger data

## 6. Maalarkitektur

### Maalprofil

`TARGET_XIAO_BLE_HX711`

Planlagt hardware:

- 1 x Seeed XIAO BLE nRF52840
- 4 x HX711
- 4 x load cells
- 1 x 500 mAh LiPo
- 1 x liten skyvebryter
- 1 x delt GND/3V3-distribusjon

### Planlagt software-retning

- firmware med samme logiske sample- og command-kontrakt over Serial og BLE
- `packages/core` som fortsatt felles domene- og kontraktslag
- `web/` som fungerende webflate for dagens Serial-baseline
- native mobilapp senere som primar BLE-klient
- eventuell webtjeneste senere for lagring, review eller admin

Migreringsregel:

Ny firmware, nye klienter og framtidige BLE-flows skal alltid kunne spores tilbake til `CURRENT_UNO_HX711` og fremover til `TARGET_XIAO_BLE_HX711` uten ny, separat data-kontrakt.

## 7. Styringsregler og guardrails

Alle endringer i repoet skal holde disse reglene:

- produktrettet arbeid skjer i `web/` og `packages/core/`
- `web/`-strukturen bevares med mindre endringen retter bug, tydeliggjor kontrakt eller stotter migreringsarkitekturen
- delt domenelogikk skal bo i `packages/core/`, ikke dupliseres i hver klient
- hardwareprofiler skal refereres med profilnavn, ikke uformell fritekst
- Tindeq Progressor behandles som ekstern total-force-device, ikke som alternativ full-fidelity hardwareprofil
- total-force-only enheter skal ikke fa fake per-finger UI eller fake per-finger metrics
- nye transportformat eller enhetskontrakter skal ikke innfores utenfor delt kjerne
- secure-context krav for browser runtime ma forbli eksplisitte i docs og deployoppsett
- brukerrettede kraftverdier skal ikke vises, brukes i guided flyt eller lagres nar runtime-verifisering staar i `checking` eller `critical`

## 8. Aktive beslutninger

- `web/` er hovedretning videre.
  - Status: aktiv
  - Dato: 2026-03-11
  - Begrunnelse: browserbasert UI gir rask iterasjon mens BLE og mobil bygges senere.

- `LIVE` er quick-check-flaten, mens `TEST` er benchmark-flaten.
  - Status: aktiv
  - Dato: 2026-03-16
  - Begrunnelse: raske maalinger og formelle benchmarker skal ikke blandes i samme brukerflyt.

- `TRAIN` skal bygge pa benchmark- og profildata, men ikke lagre som testresultat.
  - Status: aktiv
  - Dato: 2026-03-17
  - Begrunnelse: treningsgjennomforing og benchmarkhistorikk trenger ulike datamodeller og ulike brukerforventninger.

- `LIVE` first screen kan redesignes rundt connection hero, quick-mode rail, per-finger-first live-scene og total-force fallback.
  - Status: aktiv
  - Dato: 2026-03-17
  - Begrunnelse: native hardware sin unike verdi er fire samtidige fingerkanaler, og dette ma synes tydelig i live-bruk.

- Den gamle desktop-surface er fjernet fra repoet.
  - Status: aktiv
  - Dato: 2026-03-16
  - Begrunnelse: repoet skal vaere web-only i denne fasen.

- Shared domain logic skal ligge i `packages/core`.
  - Status: aktiv
  - Dato: 2026-03-11
  - Begrunnelse: samme tall og kontrakter skal kunne brukes pa tvers av Serial, simulator, Tindeq og senere BLE/mobile.

- E-commerce- og custom-produktlogikk holdes utenfor denne baselinen til det er eksplisitt tatt inn som eget scope.
  - Status: aktiv
  - Dato: 2026-03-17
  - Begrunnelse: repoet er i dag et maalings- og treningsprodukt, ikke en ordre- og produksjonsplattform.

## 9. Aapne spoersmaal

- Hvordan XIAO best handterer GPIO-, timing- og stroembehov for 4 x HX711.
- Om BLE-protokollen skal vaere ren tekst som Serial, eller binar payload med adapter i klientlaget.
- Hvilken mobilstack som egner seg best for senere BLE-klient.
- Hvordan batteristatus, sleep, reconnect og firmware-update skal eksponeres i framtidige klienter.
- Hvilke deler av dagens `web/src/analytics` som fortsatt skal flyttes inn i `packages/core`.

## 10. Risikoer og tiltak

- Risiko: brukerflate viser kraftdata for firmware-modus er bekreftet.
  - Konsekvens: kg og raw kan forveksles, og tallene kan bli misvisende.
  - Sannsynlighet: middels.
  - Tiltak: runtime-verifisering skal starte i `checking`, vente pa mode-bekreftelse og blokkere visning/lagring til gyldig sample er verifisert.

- Risiko: tare drift eller negative maaleverdier slipper gjennom som gyldig live-data.
  - Konsekvens: display, recording og guided flyt kan bygge pa feil nullpunkt.
  - Sannsynlighet: middels.
  - Tiltak: `tare required` skal vaere kritisk runtime-feil som skjuler live-tall og avbryter aktive flyter uten a lagre delresultat.

- Risiko: total-force-only device far per-finger UI eller per-finger analyser.
  - Konsekvens: misvisende feedback og feil treningsanbefalinger.
  - Sannsynlighet: middels.
  - Tiltak: capability gating og runtime sample-shape verifisering i baade dataflyt, analyse og UI.

- Risiko: total og per-finger summer driver fra hverandre i klientlaget.
  - Konsekvens: brukeren kan se inkonsistente tall mellom kort, grafer og resultater.
  - Sannsynlighet: lav til middels.
  - Tiltak: delt verifiseringslogikk i `packages/core` skal kontrollere sample-shape, total-vs-sum og tidsrekkefolge for alle brukerrettede samples.

- Risiko: domenelogikk og verifiseringsregler blir duplisert mellom `web/` og `packages/core`.
  - Konsekvens: ulike blokkregler og ulike tall mellom skjermer og klienter.
  - Sannsynlighet: middels.
  - Tiltak: hold parser-, metrics-, analyse- og verifiseringslogikk samlet i delt kjerne der det er mulig.

## 11. Test- og akseptkriterier

Denne fasen er godkjent nar:

- `web/` fortsatt fungerer mot `CURRENT_UNO_HX711`
- overordnet webstruktur er stabil, med godkjent `LIVE` first-screen redesign
- `LIVE` viser connection hero, quick-mode rail, per-finger live-scene pa native hardware og total-force fallback pa Tindeq
- runtime-verifisering viser `Verifying`, `Verified`, `Attention` eller `Blocked`, og blokkerer recording, `TEST` og `TRAIN` i `checking` eller `critical`
- `README.md`, `PROJECT_CONTEXT.md`, `REPO_MAP.md` og dette dokumentet peker nye brukere til riktig baseline
- parsing, kalibrering, metrics og workoutregler er forankret i `packages/core` eller tydelig under flytting dit
- repoet ikke inneholder utfaset desktop-surface eller desktop-spesifikke instrukser
- web har automatisk testdekning for parser, capability gating, runtime-verifisering, settings og sentrale live/test/train flows

Manuell hardware-verifisering som fortsatt kreves:

- Serial connect/disconnect
- tare
- `kg`-stream
- `raw`-stream
- mode mismatch og recovery etter ny bekreftelse
- runtime blokkering ved feil tare/nullpunkt
- benchmark-flyt
- train-flyt
- session save/export

## 12. Milepaeler

- Milepael 1: stabil Serial- og core-baseline pa `CURRENT_UNO_HX711`
- Milepael 2: tydelig web-only repo- og dokumentasjonsbaseline
- Milepael 3: ferdig capability-aware LIVE/TEST/TRAIN-opplevelse i web
- Milepael 4: XIAO firmware spike med samme logiske kontrakt
- Milepael 5: native BLE-klient
- Milepael 6: eventuell lagrings-, review- eller adminflate senere

## 13. Relaterte dokumenter

- [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)
- [REPO_MAP.md](../REPO_MAP.md)
- [BENCHMARK_WORKOUT_ENGINE.md](./BENCHMARK_WORKOUT_ENGINE.md)
- [TRAINING_PROTOCOL_DESIGN.md](./TRAINING_PROTOCOL_DESIGN.md)

## 14. Endringslogg

- 2026-03-11: Opprettet web-first styringsbaseline for `v1.5`.
- 2026-03-16: Fjernet desktop-surface og formaliserte Tindeq som ekstern total-force-device.
- 2026-03-17: Godkjente `LIVE` first-screen redesign.
- 2026-03-17: Restrukturerte styringsdokumentet for tydeligere scope, guardrails og dokumentflyt.
- 2026-03-18: La til runtime-verifisering som guardrail, risiko- og akseptkriterium for korrekt visning og lagring av data.
