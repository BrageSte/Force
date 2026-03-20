# V1.5 Web-First Transition Snapshot

This file is a helper note, not the authoritative project baseline.

For governing project truth, start with [docs/source-of-truth/INDEX.md](docs/source-of-truth/INDEX.md).

## Why This Note Still Exists

This repository is still the active `v1.5` working tree for the web-first transition. This note is here to summarize the transition mindset quickly for humans and AI tools.

## Transition Intent

- keep `web/` as the only active operator surface in this repo
- keep benchmark, prescription, and train-runner work inside the TypeScript/web stack
- keep shared product logic in `packages/core`
- prepare the project for a shareable web application now and a BLE-connected mobile app later

## Practical Rules

- run, demo, and validate from `web/`
- keep shared parsing, calibration, metrics, workouts, and verification logic in `packages/core`
- keep hosted deployment requirements explicit: secure context, supported browser, and static SPA hosting
- treat `docs/source-of-truth/` as the official baseline when this note is too compressed

## Read Order

1. [docs/source-of-truth/INDEX.md](docs/source-of-truth/INDEX.md)
2. [docs/source-of-truth/PRODUCT_SCOPE.md](docs/source-of-truth/PRODUCT_SCOPE.md)
3. [docs/source-of-truth/SYSTEM_ARCHITECTURE.md](docs/source-of-truth/SYSTEM_ARCHITECTURE.md)
4. [docs/source-of-truth/METRICS_AND_PROTOCOLS.md](docs/source-of-truth/METRICS_AND_PROTOCOLS.md)
5. [REPO_MAP.md](REPO_MAP.md)
