# REPO_MAP

> Snapshot: 2026-03-17
> Repo: `BrageSte/Force`
> Produktnavn i aktiv baseline: `Krimblokk v1.5`

Formalet med denne filen er a gjore repoet raskere a navigere for mennesker og LLM-er, og redusere gjentatt "hvor bor dette?"-arbeid i nye chatter.

## 1. Hva dette repoet er

Krimblokk / Force er et firekanals finger-force-maalesystem bygget rundt:

- dagens wired hardware-baseline: `CURRENT_UNO_HX711`
- browser-UI i `web/`
- delt domenelogikk i `packages/core/`
- Arduino-firmware i `firmware/`

Repoet er na `web`-first.

Eventuell selskaps- eller merkevarekontekst utenfor repoet, som BS Climbing, er ikke del av denne repo-baselinen. Denne filen beskriver bare Force/Krimblokk-prosjektet.

Produktrettet arbeid skal i praksis skje i:

- `web/`
- `packages/core/`

## 2. Anbefalt leserekkefolge

Nar du starter pa nytt arbeid i repoet, les i denne rekkefolgen:

1. `PROJECT_CONTEXT.md`
2. `docs/PROJECT_STYRING.md`
3. `docs/BENCHMARK_WORKOUT_ENGINE.md`
4. `docs/TRAINING_PROTOCOL_DESIGN.md`
5. `V1_5_NOTE.md`
6. `README.md`
7. denne filen: `REPO_MAP.md`

## 3. Hoynivaa repo-struktur

```text
Force/
├── docs/
│   ├── pitch/
│   ├── BENCHMARK_WORKOUT_ENGINE.md
│   ├── PROJECT_STYRING.md
│   ├── STYRINGSMAL.md
│   └── TRAINING_PROTOCOL_DESIGN.md
├── firmware/
│   └── firmware.ino
├── packages/
│   └── core/
│       ├── package.json
│       └── src/
├── web/
│   ├── scripts/
│   ├── src/
│   ├── README.md
│   ├── package.json
│   ├── vite.config.ts
│   ├── eslint.config.js
│   ├── index.html
│   └── tsconfig*.json
├── AGENTS.md
├── PROJECT_CONTEXT.md
├── README.md
├── REPO_MAP.md
├── V1_5_NOTE.md
├── package.json
└── package-lock.json
```

## 4. Root-filer

## `PROJECT_CONTEXT.md`

Viktigste kontekstfil i repoet. Definerer:

- hva produktet er
- hvorfor det finnes
- aktiv hardware- og software-baseline
- canonical terminology
- canonical data contract
- ikke-forhandlingsbar retning

## `README.md`

Kort repo-intro for mennesker. Bruk den for:

- rask forstaelse av produktbaselinen
- quick start
- hosted deployment-krav
- pekere til videre dokumentasjon

## `V1_5_NOTE.md`

Kort overgangsnotat for `v1.5`. Bruk den for:

- web-first overgangen
- hvorfor `web/` er eneste aktive operatorflate
- hvordan `packages/core/` brukes i migreringen

## `AGENTS.md`

Instrukser for AI-agenter. Viktig fordi den:

- tvinger riktig leserekkefolge
- peker pa autoritative dokumenter
- beskytter `web/` og `packages/core/` som aktive produktflater

## `package.json`

Root workspace-orchestrator.

Bekreftet workspace-oppsett:

- `web`
- `packages/core`

Viktige scripts:

- `npm run dev:web`
- `npm run build:web`
- `npm run test:web`
- `npm run lint:web`

## 5. `/docs`-kart

## `docs/PROJECT_STYRING.md`

Formelt styringsdokument for aktiv fase.

Bruk det nar du trenger:

- scope og guardrails
- migreringsretning
- aktive beslutninger
- akseptkriterier og milepaeler

## `docs/BENCHMARK_WORKOUT_ENGINE.md`

Definerer benchmark- og workout-motoren.

Bruk det nar du jobber med:

- benchmarkbiblioteket
- workout-definisjoner
- scoring
- capability gating
- prescription logic

## `docs/TRAINING_PROTOCOL_DESIGN.md`

Definerer `TRAIN`-retningen.

Bruk det nar du jobber med:

- train runner
- built-in workouts
- target logic
- treningsresultater og progresjon

## `docs/STYRINGSMAL.md`

Mal for nye styrings-, fase- eller migreringsdokumenter.

## `docs/pitch/`

Pitch- og presentasjonsressurser.

Bekreftet innhold:

- `pdf/`
- `pitch.css`
- `program-overview-firstpage.png`
- `program-overview-page1.png`
- `program-overview.html`
- `test-battery.html`

Render-utility:

- `web/scripts/render-pitch-pdfs.mjs`

## 6. `/packages/core`-kart

`packages/core/` er delt TypeScript-domene.

Filer og roller:

- `src/index.ts`
  - eksportpunkt for delt kjerne
- `src/types.ts`
  - sentrale delte typer
- `src/parsing.ts`
  - sample-parsing fra transportpayloads
- `src/calibration.ts`
  - offsets, scales og kg/raw-konvertering
- `src/settings.ts`
  - settings-normalisering og kontraktshjelpere
- `src/smoothing.ts`
  - smoothing/logikk for signalbehandling
- `src/segmentation.ts`
  - effort-detektering og segmentering
- `src/metrics.ts`
  - sentrale force-metrikker
- `src/curveAnalysis.ts`
  - force-curve-analyse
- `src/sessionAnalyzer.ts`
  - aggregate session-analyse
- `src/deviceCommands.ts`
  - serial/device command helpers
- `src/workouts.ts`
  - benchmark- og workout-definisjoner

Arbeidsregel:

Hvis ny parser-, metrics-, analyse- eller workoutlogikk skal deles mellom views eller klienter, start i `packages/core/`.

## 7. `/web`-kart

`web/` er aktiv produktflate.

## `web/src/components/`

Hoved-UI per produktflate:

- `live/`
  - `LIVE`-skjermer, quick capture, live scene og siste resultat
- `test/`
  - benchmarker, guided capture, resultater og testbibliotek
- `train/`
  - guided workouts, prescriptions og train-resultater
- `history/`
  - historikk, analyse og sammenligning
- `profile/`
  - brukerprofil og benchmarkreferanser
- `settings/`
  - runtime- og device-innstillinger
- `device/`
  - device picker og device-relatert UI
- `analysis/`
  - analysegrafer og view models
- `layout/`
  - app shell, topbar, sidebar
- `shared/`
  - UI-byggeklosser

## `web/src/device/`

Device providers og transportnaere adapters:

- `NativeBsDeviceProvider.ts`
- `TindeqDeviceProvider.ts`
- `WebSerialSource.ts`
- `SimulatedSource.ts`
- `deviceProfiles.ts`
- `capabilityChecks.ts`
- `tindeqProtocol.ts`

## `web/src/pipeline/`

- `SamplePipeline.ts`
  - sampleflyt fra input til normalisert runtime-data

## `web/src/live/`

- `quickMeasure.ts`
- `sessionWorkflow.ts`

Disse styrer raske maalinger og lokal capture-logikk.

## `web/src/storage/`

Lokal lagring og bootstrap:

- IndexedDB-oppsett
- sessions
- settings
- profiles

## `web/src/stores/`

Zustand stores for app-, device- og live-state.

## `web/src/analytics/`

Transition-omraade. Flere filer speiler eller overlapper ansvar som ogsa finnes i `packages/core/`.

Nar du jobber her:

- sjekk forst om logikken bor flyttes eller konsolideres i `packages/core/`
- unnga ny permanent duplisering hvis samme tall skal brukes flere steder

## `web/src/test/`

Vitest- og component-/integration-tester for live, test, train, parsing, capability gating og storage.

## 8. `/firmware`-kart

## `firmware/firmware.ino`

Arduino-firmware for `CURRENT_UNO_HX711`.

Den gjor i praksis dette:

- leser 4 HX711-kanaler
- streamer seriedata
- stotter tare og kalibrering
- stotter `raw`- og `kg`-modus
- lagrer kalibreringsdata i EEPROM

Bekreftede serielle kommandoer:

- `t`
- `c <channel> <known_kg>`
- `p`
- `m raw`
- `m kg`

Bekreftet stream-format:

```text
t_ms,v0,v1,v2,v3
```

## 9. Nyttige kommandoer

Installer:

```bash
npm ci
```

Kjor web lokalt:

```bash
npm run dev:web
```

Bygg, lint og test:

```bash
npm run build:web
npm run lint:web
npm run test:web
```

Pitch-PDF render:

```bash
npm --workspace web run pitch:pdf
```

## 10. Praktiske arbeidsregler

- Hvis endringen er produktrettet, start i `web/` eller `packages/core/`.
- Hvis endringen berorer hardware, transport eller migrering, les `PROJECT_CONTEXT.md` og `docs/PROJECT_STYRING.md` forst.
- Hvis endringen berorer benchmarker eller trening, les ogsaa benchmark- og training-docs forst.
- Bruk hardwareprofilnavnene `CURRENT_UNO_HX711` og `TARGET_XIAO_BLE_HX711`.
- Ikke la total-force-only devices skape fake per-finger dataflyt.
