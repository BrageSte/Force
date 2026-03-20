# Software Architecture

## Repo Structure

Active product-facing work in this repository lives in:

- `web/`
- `packages/core/`

Supporting implementation for the active hardware baseline lives in:

- `firmware/`

Root workspace orchestration is defined in `package.json` with these workspaces:

- `web`
- `packages/core`

## `web/` Responsibilities

`web/` is the current operator surface and browser runtime.

Current top-level page structure in `web/src/App.tsx`:

- `live`
- `train`
- `test`
- `session`
- `history`
- `profile`
- `settings`

The web app currently handles:

- live connection flow and visualization
- benchmark execution and results
- training execution and results
- session/history review
- profile and settings management
- hosted deployment as a secure-context browser app

## `packages/core/` Responsibilities

`packages/core/src/index.ts` exports the shared domain layer for:

- types
- settings
- calibration
- parsing
- smoothing
- segmentation
- metrics
- curve analysis
- session analysis
- device commands
- workouts
- verification

This package is the shared contract and logic layer for current Serial, Simulator, Tindeq, and future BLE paths.

## Device Providers and Sources

Current active providers in `web/` support:

- `Serial`
  - native GripSense path over Web Serial
- `Simulator`
  - development and testing path
- `Tindeq`
  - total-force-only BLE device path

`BLE_UART` exists as a reserved future source kind but is not implemented in `web/`.

## Runtime Readiness Model

The current setup/readiness model combines:

- connection state
- device capability state
- runtime verification state
- raw-mode tare/calibration readiness
- profile basics
- first benchmark availability

The setup-readiness states in `web/src/setup/setupReadiness.ts` are:

- `profile_basics_missing`
- `device_disconnected`
- `verification_checking`
- `verification_blocked`
- `raw_mode_needs_tare_or_calibration`
- `first_benchmark_missing`
- `ready`

## Verification Boundaries

Shared verification logic lives in `packages/core/src/verification.ts`.

The software baseline requires:

- trusted sample shape before display
- timestamp order checks
- sample finiteness checks
- total-vs-sum checks when per-finger data exists
- mode confirmation checks
- tare-required blocking
- capability-aware per-finger gating

## Persistence

The web app uses local persistence for:

- settings
- profiles
- sessions and results

Current storage layers include IndexedDB-backed session/profile/settings persistence plus local browser state for runtime behavior.

## Current Cleanup Boundary

Some analytics logic still exists in both `web/src/analytics/` and `packages/core/`.

Canonical direction:

- shared parsing, metrics, analysis, and verification logic should converge into `packages/core/` where practical
- `web/` should focus on UI, orchestration, and browser/runtime integration
