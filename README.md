# GripSense

GripSense is a four-channel finger-force measurement product for climbing-related testing, training, and follow-up over time. Its differentiator is `FingerMap™`: per-finger force measurement and analysis across Index, Middle, Ring, and Pinky.

This repository is the primary source of truth for the project. Inside the repo, the authoritative documentation lives in `docs/source-of-truth/`.

## Start Here

Read these first:

1. `docs/source-of-truth/INDEX.md`
2. `docs/source-of-truth/PROJECT_GOVERNANCE.md`
3. `docs/source-of-truth/PRODUCT_SCOPE.md`
4. `docs/source-of-truth/SYSTEM_ARCHITECTURE.md`

If you are onboarding a collaborator or using an AI assistant, also read `docs/source-of-truth/WORKING_WITH_AI.md` after `docs/source-of-truth/INDEX.md` for the practical repo-working rules.

Supporting material lives in `docs/reference/`. It is useful for onboarding, research, and AI quickstarts, but it is not authoritative if it conflicts with `docs/source-of-truth/`.

## Current Repo Baseline

- Active hardware profile: `CURRENT_UNO_HX711`
- Current hardware: Arduino UNO + 4 x HX711 + 4 x load cells over USB serial
- Active product surface: `web/`
- Shared domain layer: `packages/core/`
- Current firmware baseline: `firmware/firmware.ino`
- Supported compatibility device: Tindeq Progressor as total-force-only

## Repo Layout

```text
docs/
  source-of-truth/
  reference/
  decisions/

firmware/
  firmware.ino

packages/
  core/
    src/

web/
  src/
```

## Documentation Rules

- `docs/source-of-truth/` defines the official current state.
- `docs/reference/` is derived and supporting material.
- `docs/plans/`, chats, PDFs, and loose notes are working material, not governing truth.
- If docs conflict, `docs/source-of-truth/` wins.

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

## Browser And Hosting Notes

- Web Serial requires a secure context and a Chromium-based browser.
- Web Bluetooth flows also require a secure context and supported browser/device combinations.
- For hosted deployments, publish `web/dist/` as a static SPA with fallback to `index.html`.
- Browser support is useful, but the longer-term product direction still includes BLE and a later native mobile client.

## Additional Helpers

- `V1_5_NOTE.md`
  - transition note and quick orientation
- `REPO_MAP.md`
  - repo navigation helper
- `docs/reference/00_CODEX_QUICKSTART.md`
  - fast AI-oriented reminder after reading the canonical docs
