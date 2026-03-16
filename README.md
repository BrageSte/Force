# Krimblokk v1.5

Krimblokk is a four-channel finger-force measurement system for structured testing, live capture, and session review. In this repository, `web/` is the active product surface and the only UI that should be used for normal operation.

Read [V1_5_NOTE.md](V1_5_NOTE.md) for the purpose of this version, then [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the authoritative product and hardware baseline. For architecture, migration, and roadmap decisions, also read [docs/PROJECT_STYRING.md](docs/PROJECT_STYRING.md). Benchmark and training logic are documented in [docs/BENCHMARK_WORKOUT_ENGINE.md](docs/BENCHMARK_WORKOUT_ENGINE.md) and [docs/TRAINING_PROTOCOL_DESIGN.md](docs/TRAINING_PROTOCOL_DESIGN.md).

## Product Direction

Current baseline:

- hardware profile `CURRENT_UNO_HX711`
- Arduino UNO + 4 x HX711 + 4 x load cell channels
- wired serial transport
- `web/` as the active browser UI

Target direction:

- hardware profile `TARGET_XIAO_BLE_HX711`
- compact XIAO BLE based device
- BLE-connected mobile app later
- optional web service or hosted workflows later

`app/` remains in the repository only as a legacy Python reference while logic is consolidated in TypeScript. It is not the product surface to run, package, or share with users.

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
  ... legacy Python reference only
```

## Active Surfaces

- `web/`
  - current product UI
  - browser app with Web Serial against `CURRENT_UNO_HX711`
- `packages/core/`
  - shared TypeScript parsing, calibration, smoothing, segmentation, metrics, workouts, and session analysis
- `firmware/`
  - Arduino firmware for the current wired device
- `app/`
  - legacy code archive/reference during migration

## Canonical Transport Contract

- newline-delimited text
- CSV with timestamp: `t_ms,f0,f1,f2,f3`
- CSV without timestamp: `f0,f1,f2,f3`
- JSON: `{"t_ms":123,"f":[f0,f1,f2,f3]}`
- one active stream mode per connection: `raw` or `kg`
- status/debug lines start with `#`

## Quick Start

Install dependencies from the repo root:

```bash
npm ci
```

Run the active web app:

```bash
npm run dev:web
```

Build, lint, and test the web app:

```bash
npm run build:web
npm run lint:web
npm run test:web
```

If you are preparing a public-facing or hosted version, use `web/` as the source of truth. Do not build new product features into `app/`.

## Reference-Only Legacy App

The Python desktop app is kept only for parity checks and historical reference. Most contributors and all end users can ignore it.

Optional legacy verification:

```bash
cd app
python -m pytest -q
```
