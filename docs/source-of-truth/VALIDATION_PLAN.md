# Validation Plan

## Current Validation Snapshot

Validated on 2026-03-20:

- `npm run test:web`
  - passes
- `npm run build:web`
  - passes
  - build emits a large-chunk warning for the main app bundle
- `npm run lint:web`
  - fails on existing issues in:
    - `web/src/components/live/QuickMeasurePanel.tsx`
    - `web/src/components/live/ForceChart.tsx`

This is the current repo-backed verification baseline and should be kept explicit in future documentation updates.

## Automated Coverage Baseline

The current automated test suite covers:

- parsing
- metrics
- curve analysis
- capability gating
- verification logic
- live page behavior
- guided capture
- setup readiness
- train library and prescription logic
- Tindeq protocol behavior
- session/history-related flows

## Manual Hardware Validation Still Required

The active hardware baseline still requires manual checks for:

- Serial connect and disconnect
- tare
- `kg` stream mode
- `raw` stream mode
- mode mismatch and recovery
- tare-required or bad-zero recovery
- benchmark execution on real hardware
- train execution on real hardware
- session save and export

## Measurement-Quality Backlog

The product still needs documented validation for:

- real sample rate under active runtime conditions
- calibration flow and calibration repeatability
- drift over time
- hysteresis
- same-day test-retest reliability
- between-day test-retest reliability
- cross-talk between channels
- summed per-finger output versus total-force expectations
- practical error margins

## Acceptance Criteria for the Current Phase

The current documentation and product baseline should assume success when:

- `web/` remains functional against `CURRENT_UNO_HX711`
- capability-aware behavior is preserved between native GripSense and Tindeq flows
- runtime verification blocks untrusted live/test/train behavior
- canonical docs describe actual repo state rather than idealized future behavior
- reference docs align with the canonical layer

## Known Issues

- Lint is not yet clean because of existing React hook/compiler issues in `QuickMeasurePanel.tsx` and `ForceChart.tsx`.
- The production build currently emits a large chunk-size warning.
- Measurement-quality documentation is still behind product and UI progress.
