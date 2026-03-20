# Roadmap

## Active Direction

The active baseline is a web-first GripSense product with:

- stable `LIVE`, `TEST`, and `TRAIN` separation
- `web/` as the active operator surface
- `packages/core/` as the shared domain layer
- `CURRENT_UNO_HX711` as the active native hardware baseline
- Tindeq Progressor as a supported total-force-only external device

## Active Decisions

- Keep the overall web information architecture stable in the current phase.
- Preserve the approved `LIVE` first-screen direction around connection, quick actions, per-finger-first live use on native hardware, and a simpler total-force fallback on Tindeq.
- Keep `LIVE`, `TEST`, and `TRAIN` distinct in purpose.
- Keep the repo web-first and do not reintroduce a desktop surface.
- Keep shared domain logic in `packages/core/`.
- Do not let total-force-only devices redefine the native FingerMap™ model.

## Near-Term Milestones

1. Keep the Serial and shared-core baseline stable on `CURRENT_UNO_HX711`.
2. Finish documentation and onboarding cleanup around the new source-of-truth structure.
3. Complete a capability-aware `LIVE` / `TEST` / `TRAIN` experience in web.
4. Reduce remaining duplication between `web/` and `packages/core/`.
5. Run a XIAO firmware spike that preserves the shared logical contract.

## Near-Term Work Phases

### Phase A

- polish setup readiness and copy
- manually QA first-run, reconnect, verification, raw/kg, tare-required, and total-force-only flows
- fix the current lint issues in the live components

### Phase B

- lock the next information-architecture decision before adding a new front page or app shell changes
- decide whether `HOME`, `ME`, routing, or navigation consolidation belongs in a later phase

### Phase C

- only after the IA decision, consider a broader shell/front-page change
- only after that, evaluate PWA or mobile-wrapper work

### Phase D

- later BLE client work
- later native mobile client work
- optional hosted review/admin workflows later

## Not Now

Do not treat these as already approved:

- making `HOME` the default page
- removing `SESSION` from navigation
- merging `PROFILE` and `SETTINGS` into `ME`
- adding router/PWA/mobile wrapper work into the current cleanup phase
- treating a backend as a prerequisite for local measurement

## Open Questions

- the best BLE payload/adapter strategy for the XIAO path
- the best mobile-client stack for the later native BLE client
- battery, sleep, reconnect, and firmware-update behavior for the target device
- which remaining analytics code should move from `web/` into `packages/core/`
