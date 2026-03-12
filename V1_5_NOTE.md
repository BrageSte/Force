# V1.5 Experimental Fork

This folder is the active experimental fork for the benchmark, prescription, and train-runner refactor.

Intent:

- preserve the original repo at `/Users/brage/Documents/Krimblokk_4 fingre` as the frozen baseline
- run all benchmark/workout-engine work only inside this snapshot
- keep `TEST` as the benchmark surface
- grow `TRAIN` into the prescription and guided-workout surface

Snapshot rules:

- `.git` is intentionally not copied into this folder
- runtime artifacts such as `node_modules`, virtualenvs, and build outputs were excluded from the snapshot
- any new benchmark, train UI, custom workout, or recommendation work belongs here first

Read order for work in this fork:

1. [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
2. [docs/PROJECT_STYRING.md](docs/PROJECT_STYRING.md)
3. [docs/BENCHMARK_WORKOUT_ENGINE.md](docs/BENCHMARK_WORKOUT_ENGINE.md)
4. [docs/TRAINING_PROTOCOL_DESIGN.md](docs/TRAINING_PROTOCOL_DESIGN.md)
