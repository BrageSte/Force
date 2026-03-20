# System Architecture

## System View

GripSense is a capability-aware measurement system with three active layers in this repository:

1. device and firmware input
2. shared domain logic in `packages/core/`
3. browser UI in `web/`

The product architecture must preserve the native four-finger model while degrading cleanly for total-force-only devices.

## Active Runtime Baseline

### Hardware profile

- Active: `CURRENT_UNO_HX711`
- Target: `TARGET_XIAO_BLE_HX711`

### Active surfaces

- `firmware/`
  - Arduino UNO firmware for the wired baseline
- `packages/core/`
  - shared parsing, calibration, smoothing, segmentation, metrics, workouts, verification, and session analysis
- `web/`
  - active browser app for `LIVE`, `TEST`, `TRAIN`, `SESSION`, `HISTORY`, `PROFILE`, and `SETTINGS`

## Capability-Aware Device Model

The system distinguishes between:

### Native GripSense hardware

- total force
- per-finger force
- load distribution and FingerMap™ analytics
- tare and start/stop controls

### Total-force-only external devices

- total force only
- no per-finger force
- no fake FingerMap™ visuals or per-finger metrics

Current source kinds in software are `Serial`, `Simulator`, and `Tindeq`. `BLE_UART` is reserved for the future XIAO BLE path and is not implemented in `web/` yet.

## Data Contract

### Canonical logical contract

Serial and future BLE flows should map to the same logical sample model:

- newline-delimited text framing
- accepted sample shapes:
  - `t_ms,f0,f1,f2,f3`
  - `f0,f1,f2,f3`
  - `{"t_ms":123,"f":[f0,f1,f2,f3]}`
- exactly one stream mode per connection: `raw` or `kg`
- status and debug lines start with `#`

### Current firmware reality

`CURRENT_UNO_HX711` firmware currently emits timestamped CSV lines only and reports commands/status through `#` prefixed lines. The broader logical contract exists so future firmware and transport adapters can preserve one shared sample model.

## Runtime Verification Rule

User-facing force data is gated by verification:

- verification states are `checking`, `verified`, `warning`, and `critical`
- `LIVE`, `TEST`, and `TRAIN` must block start actions while verification is `checking` or `critical`
- per-finger display must be blocked on total-force-only devices
- tare, sample shape, timestamp order, mode confirmation, and total-vs-sum consistency are part of the verification baseline

## Current-to-Target Migration Rule

All migration work must trace back to `CURRENT_UNO_HX711` and forward to `TARGET_XIAO_BLE_HX711` without creating a separate product model or incompatible data contract.

That means:

- shared domain rules stay in `packages/core/`
- new transports adapt into the same logical sample model
- native per-finger capability stays the product anchor
- compatibility paths must degrade features, not redefine them
