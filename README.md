# Krimblokk v1.5

Krimblokk is a four-channel finger-force measurement system for structured testing, live capture, guided training, and session review. This repository is now web-only: `web/` is the product surface, `packages/core/` holds shared domain logic, and `firmware/` contains the Arduino firmware for the current wired hardware.

Start with [V1_5_NOTE.md](V1_5_NOTE.md), then read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the authoritative product and hardware baseline. For architecture and roadmap direction, read [docs/PROJECT_STYRING.md](docs/PROJECT_STYRING.md). Benchmark and training behavior are documented in [docs/BENCHMARK_WORKOUT_ENGINE.md](docs/BENCHMARK_WORKOUT_ENGINE.md) and [docs/TRAINING_PROTOCOL_DESIGN.md](docs/TRAINING_PROTOCOL_DESIGN.md).

## Current Product Baseline

- hardware profile `CURRENT_UNO_HX711`
- Arduino UNO + 4 x HX711 + 4 x load cell channels
- wired serial transport for full per-finger capture
- Tindeq Progressor support for total-force-only BLE capture
- `web/` as the only operator UI in this repository

## Repository Layout

```text
firmware/
  firmware.ino

packages/
  core/
    src/

web/
  src/
```

## Active Surfaces

- `web/`
  - browser application for live capture, test workflows, training workflows, history, and analysis
  - secure-context app for Web Serial and Web Bluetooth-compatible device flows
- `packages/core/`
  - shared TypeScript parsing, calibration, smoothing, segmentation, metrics, workouts, and session analysis
- `firmware/`
  - Arduino firmware for `CURRENT_UNO_HX711`

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

Run the web app locally:

```bash
npm run dev:web
```

Build, lint, and test:

```bash
npm run build:web
npm run lint:web
npm run test:web
```

## Hosted Deployment

For a hosted deployment or custom domain:

1. Run `npm run build:web`.
2. Publish the generated `web/dist/` output as a static site with SPA fallback to `index.html`.
3. Use `https` on the final domain.

Important browser/runtime constraints:

- Web Serial requires a secure context and a Chromium-based browser.
- Web Bluetooth device flows also require a secure context and supported browser/device combinations.
- iOS Safari is not a full replacement for Chromium Web Serial workflows.

If you are preparing a public-facing hosted version, `web/` is the only source of truth in this repository.
