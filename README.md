# Krimblokk v1.5

Read [V1_5_NOTE.md](V1_5_NOTE.md) first for the purpose of this snapshot fork. Then read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md). It is the authoritative project entrypoint for purpose, current hardware, target hardware, and transport rules. For architecture, migration, and roadmap decisions, also read [docs/PROJECT_STYRING.md](docs/PROJECT_STYRING.md). For the workout engine and benchmark model, read [docs/BENCHMARK_WORKOUT_ENGINE.md](docs/BENCHMARK_WORKOUT_ENGINE.md). For training session design and source basis, read [docs/TRAINING_PROTOCOL_DESIGN.md](docs/TRAINING_PROTOCOL_DESIGN.md).

## Current vs Future

Current physical/software baseline:

- hardware profile `CURRENT_UNO_HX711`
- Arduino UNO + 4 x HX711 + 4 x strain/load cell
- wired serial transport
- `web/` is the active UI baseline

Future target:

- hardware profile `TARGET_XIAO_BLE_HX711`
- Seeed XIAO BLE nRF52840 + 4 x HX711 + 4 x load cell + LiPo + switch
- BLE-capable mobile-first control surface later
- optional web service later

This snapshot is intentionally experimental. The original repo remains the frozen baseline, while this `v1.5` folder carries the benchmark/workout-engine fork.

## Repository Layout

```text
firmware/
  firmware.ino

packages/
  core/
    src/

web/
  src/

app/
  acquisition/
  analytics/
  calibration/
  persistence/
  tests/
  ui/
```

## Surfaces

- `web/`
  - primary direction
  - browser UI with Web Serial today
- `packages/core/`
  - shared TypeScript parsing, calibration, smoothing, segmentation, metrics, session analysis, and device command contract
- `app/`
  - legacy Python desktop reference/fallback
- `firmware/`
  - current Arduino firmware

## Canonical Transport Contract

- newline-delimited text
- CSV with timestamp: `t_ms,f0,f1,f2,f3`
- CSV without timestamp: `f0,f1,f2,f3`
- JSON: `{"t_ms":123,"f":[f0,f1,f2,f3]}`
- one active stream mode per connection: `raw` or `kg`
- status/debug lines start with `#`

## Run Web

Start `v1.5` web-appen:

```bash
cd "/Users/brage/Documents/Krimblokk_4 fingre v1.5/web"
npm ci
npm run dev
```

## Run Legacy Desktop App

```bash
cd app
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./run_app.sh
```

## Tests

Web:

```bash
cd web
npm test
```

Python reference app:

```bash
cd app
python -m pytest -q
```
