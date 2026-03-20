# GripSense Codex Quickstart

> If this file conflicts with any document in `docs/source-of-truth/`, the `docs/source-of-truth/` version wins.

## Read Order

1. `docs/source-of-truth/INDEX.md`
2. `docs/source-of-truth/PRODUCT_SCOPE.md`
3. `docs/source-of-truth/SYSTEM_ARCHITECTURE.md`
4. `docs/source-of-truth/HARDWARE_SPEC.md`
5. `docs/source-of-truth/SOFTWARE_ARCHITECTURE.md`
6. `docs/source-of-truth/METRICS_AND_PROTOCOLS.md`
7. `docs/source-of-truth/VALIDATION_PLAN.md`

Use this file after the canonical docs when you want a fast AI-friendly reminder.

## Project Identity

- Product: GripSense
- Differentiator: `FingerMap™`
- Core idea: measure force per finger with four channels, not just total hand force
- Active repo surfaces: `web/`, `packages/core/`, `firmware/`

## Quick Orientation

- `LIVE`
  - quick checks, live monitoring, short captures
- `TEST`
  - repeatable benchmarks and analysis
- `TRAIN`
  - guided sessions and deterministic recommendations

Current hardware baseline:

- `CURRENT_UNO_HX711`
- Arduino UNO
- 4 x HX711
- 4 x load cells
- USB serial to host

Future target direction:

- `TARGET_XIAO_BLE_HX711`
- Seeed XIAO BLE nRF52840
- 4 x HX711
- 4 x load cells
- LiPo-powered compact device

## Capability Model

Native GripSense hardware provides:

- total force
- per-finger force
- FingerMap™ distribution and compensation insight

Tindeq Progressor provides:

- total force only

Rules to remember:

- never fabricate per-finger outputs for total-force-only devices
- keep UI, metrics, protocols, and storage capability-aware
- preserve the native four-finger model as the product anchor

## Current Repo Facts

- Root workspaces: `web`, `packages/core`
- `web/` is the only active operator surface in this repo
- `packages/core/` exports shared parsing, calibration, metrics, workouts, verification, and session analysis
- `firmware/firmware.ino` is the active wired-device firmware baseline
- `BLE_UART` exists as a reserved source kind, but is not implemented in `web/` yet

## High-Value Metrics

- peak force
- average force
- impulse
- RFD100 / RFD200
- fatigue index
- force drift
- stability
- finger contribution
- redistribution and compensation patterns

## Common Implementation Guardrails

- separate device/transport code from domain metrics
- keep shared logic in `packages/core/` where practical
- avoid hardcoding native-only assumptions into total-force paths
- keep `LIVE`, `TEST`, and `TRAIN` distinct in purpose
- keep the shared logical sample contract stable for future BLE migration

## Current Validation Snapshot

As of 2026-03-20:

- `npm run test:web` passes
- `npm run build:web` passes, with a large bundle warning
- `npm run lint:web` fails on existing issues in `QuickMeasurePanel.tsx` and `ForceChart.tsx`

## Useful Prompts

### Code mapping

> GripSense is a web-first finger-force product. Map the chosen folder and explain responsibilities, data flow, and cleanup opportunities without breaking the capability model.

### UI work

> GripSense keeps `LIVE`, `TEST`, and `TRAIN` distinct. Improve the chosen surface while preserving native per-finger value on GripSense hardware and total-force fallback on Tindeq.

### Metrics or training logic

> GripSense uses shared workout, metrics, and verification logic. Improve the selected benchmark, prescription, or analysis behavior without inventing a new device model.

## Copy-Paste Context Block

```text
Project: GripSense
Type: four-channel finger-force measurement for climbing
Core differentiator: FingerMap™ per-finger analytics
Active repo surfaces: web/, packages/core/, firmware/
Current hardware: CURRENT_UNO_HX711 = Arduino UNO + 4 x HX711 + 4 load cells + USB serial
Target hardware: TARGET_XIAO_BLE_HX711 = XIAO BLE nRF52840 + 4 x HX711 + LiPo
Product surfaces: LIVE = quick checks, TEST = benchmarks, TRAIN = guided workouts
Capability model: GripSense native hardware = total + per-finger force, Tindeq = total-force-only
Important rule: if docs conflict, docs/source-of-truth wins
Task in this chat: [describe the specific task]
```
