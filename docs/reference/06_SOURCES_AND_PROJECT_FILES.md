# Sources and Project Files

## Canonical Source Layer

The authoritative project baseline now lives in:

- `docs/source-of-truth/INDEX.md`
- `docs/source-of-truth/PROJECT_GOVERNANCE.md`
- `docs/source-of-truth/PRODUCT_SCOPE.md`
- `docs/source-of-truth/SYSTEM_ARCHITECTURE.md`
- `docs/source-of-truth/HARDWARE_SPEC.md`
- `docs/source-of-truth/SOFTWARE_ARCHITECTURE.md`
- `docs/source-of-truth/METRICS_AND_PROTOCOLS.md`
- `docs/source-of-truth/VALIDATION_PLAN.md`
- `docs/source-of-truth/ROADMAP.md`

## Repo Files Used To Build The Canonical Layer

Primary repo-backed inputs for the current doc refresh:

- `package.json`
- `firmware/firmware.ino`
- `packages/core/src/index.ts`
- `packages/core/src/types.ts`
- `packages/core/src/workouts.ts`
- `packages/core/src/verification.ts`
- `web/src/App.tsx`
- `web/src/device/deviceProfiles.ts`
- `web/src/setup/setupReadiness.ts`
- `web/src/components/test/testLibrary.ts`
- `web/src/components/train/trainLibrary.ts`
- `web/src/components/test/aiCoaching.ts`

## Legacy Docs Folded Into The New Structure

The following legacy docs were used as migration inputs and then replaced by the new structure:

- `PROJECT_CONTEXT.md`
- `docs/PROJECT_STYRING.md`
- `docs/BENCHMARK_WORKOUT_ENGINE.md`
- `docs/TRAINING_PROTOCOL_DESIGN.md`
- `docs/reference/README.md`
- `docs/reference/Force_styringsdokument_v1_0.md`

These legacy files were intentionally removed after their content was redistributed into the canonical and numbered reference docs.

## Supporting Working Material

Useful but non-authoritative supporting files still in the repo include:

- `docs/plans/GripSense v2 Status Roadmap.md`
- `docs/plans/move-hand-selector.md`
- `docs/pitch/`
- `V1_5_NOTE.md`
- `REPO_MAP.md`

## What This Reference Layer Is For

This reference layer is for:

- fast onboarding
- AI quickstart context
- supporting research and positioning summaries
- practical checklists

It is not the governing truth when it differs from `docs/source-of-truth/`.
