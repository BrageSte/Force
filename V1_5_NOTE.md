# V1.5 Web-First Transition Snapshot

This repository is the active v1.5 working tree for the web-first product transition.

Intent:

- make `web/` the only active operator surface
- keep benchmark, prescription, and train-runner work inside the TypeScript/web stack
- keep shared product logic in `packages/core`
- prepare the project for a shareable web application now and a BLE-connected mobile app later

Working rules for this version:

- run, demo, and validate from `web/`
- keep shared parsing, calibration, metrics, and workout logic in `packages/core`
- remove local runtime artifacts before committing so the repo stays clean for GitHub and future productization
- keep hosted deployment requirements explicit: secure context, supported browser, and static SPA hosting

Read order for work in this repository:

1. [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
2. [docs/PROJECT_STYRING.md](docs/PROJECT_STYRING.md)
3. [docs/BENCHMARK_WORKOUT_ENGINE.md](docs/BENCHMARK_WORKOUT_ENGINE.md)
4. [docs/TRAINING_PROTOCOL_DESIGN.md](docs/TRAINING_PROTOCOL_DESIGN.md)
5. [REPO_MAP.md](REPO_MAP.md)
