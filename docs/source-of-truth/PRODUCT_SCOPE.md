# Product Scope

## Product Definition

GripSense is a four-channel finger-force measurement product for climbing-related testing, training, and follow-up over time.

Its key differentiator is `FingerMap™`: simultaneous per-finger force measurement and analysis across Index, Middle, Ring, and Pinky.

## Product Purpose

GripSense exists to do more than show live force numbers. The product is intended to:

- capture force from four fingers at the same time
- support quick local checks and short captures in `LIVE`
- support repeatable benchmark workflows in `TEST`
- support guided workouts and prescriptions in `TRAIN`
- analyze peak force, average force, impulse, RFD, drift, stability, fatigue, and finger contribution patterns
- retain session data for comparison over time

## Users

Primary users are people who need structured finger-force testing and follow-up over time, including:

- climbing training and performance use cases
- return-to-load and rehab-adjacent use cases
- technical evaluation where per-finger distribution matters

## Active Product Surfaces

### `LIVE`

- quick checks and short local captures
- connection flow and runtime readiness
- live total-force and per-finger visualization when the device supports it
- latest-result summary

### `TEST`

- formal benchmarks
- repeatable measurements
- result scoring, comparison, and history

### `TRAIN`

- guided sessions
- deterministic recommendations and prescriptions
- training execution and training-result review

## Current Scope

The active repo scope is:

- `web/` as the current shippable operator surface
- `packages/core/` as the shared domain and contract layer
- `firmware/` as the current wired-device firmware baseline
- capability-aware support for both native GripSense hardware and total-force-only external devices such as Tindeq Progressor
- web-safe hosted deployment that preserves secure-context requirements for device features

## Explicitly Out of Scope Right Now

- a new desktop runtime surface
- full implementation of `TARGET_XIAO_BLE_HX711`
- a production-ready native mobile app
- a required backend or sync service for local measurement
- a full information-architecture rewrite outside the approved baseline
- e-commerce, CAD automation, or manufacturing workflow as part of this repo baseline

## Directional Guardrails

- `web/` remains the primary product direction in this repository.
- `CURRENT_UNO_HX711` is the only active full-fidelity FingerMap™ hardware profile today.
- Tindeq Progressor is first-class as a total-force-only external device, but it must not redefine the native four-finger model.
- `LIVE`, `TEST`, and `TRAIN` stay distinct in purpose.
