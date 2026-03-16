# Agent Instructions

## Mandatory Read Order

1. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) before analysis, planning, review, or code changes.
2. If the task touches architecture, hardware, BLE, transport contracts, roadmap, or migration strategy, also read [docs/PROJECT_STYRING.md](docs/PROJECT_STYRING.md) before continuing.
3. If the task touches benchmarks, training, workouts, custom protocols, prescription logic, or train/test UI, also read [docs/BENCHMARK_WORKOUT_ENGINE.md](docs/BENCHMARK_WORKOUT_ENGINE.md) and [docs/TRAINING_PROTOCOL_DESIGN.md](docs/TRAINING_PROTOCOL_DESIGN.md).

Do not skip these files. They define the current product purpose, the active Arduino UNO based setup, the future XIAO BLE direction, and the repo decisions that keep web stable during migration.

## Project Guardrails

- Preserve the current `web/` UI structure unless a change fixes a bug, clarifies a contract, or supports the migration architecture.
- Treat `web/` as the primary product direction.
- Treat `web/` and `packages/core/` as the only active product surfaces in this repository.
- Use the hardware profile names from `docs/PROJECT_STYRING.md` instead of informal descriptions:
  - `CURRENT_UNO_HX711`
  - `TARGET_XIAO_BLE_HX711`

## Working Rule

When the code and documentation disagree, update the code or docs so that `PROJECT_CONTEXT.md` and `docs/PROJECT_STYRING.md` remain the authoritative baseline. Do not reintroduce an alternative desktop/runtime surface without updating those documents first.
