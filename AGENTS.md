# Agent Instructions

## Mandatory Read Order

1. Read [docs/source-of-truth/INDEX.md](docs/source-of-truth/INDEX.md) before analysis, planning, review, or code changes.
2. If the task touches architecture, hardware, BLE, transport contracts, roadmap, or migration strategy, also read [docs/source-of-truth/SYSTEM_ARCHITECTURE.md](docs/source-of-truth/SYSTEM_ARCHITECTURE.md), [docs/source-of-truth/HARDWARE_SPEC.md](docs/source-of-truth/HARDWARE_SPEC.md), and [docs/source-of-truth/ROADMAP.md](docs/source-of-truth/ROADMAP.md).
3. If the task touches benchmarks, training, workouts, custom protocols, prescription logic, or train/test UI, also read [docs/source-of-truth/METRICS_AND_PROTOCOLS.md](docs/source-of-truth/METRICS_AND_PROTOCOLS.md) and [docs/source-of-truth/VALIDATION_PLAN.md](docs/source-of-truth/VALIDATION_PLAN.md).

Do not skip these files. They define the current product purpose, the active Arduino UNO based setup, the future XIAO BLE direction, and the repo decisions that keep web stable during migration.

## Project Guardrails

- Preserve the current `web/` UI structure unless a change fixes a bug, clarifies a contract, or supports the migration architecture.
- Treat `web/` as the primary product direction.
- Treat `web/` and `packages/core/` as the only active product surfaces in this repository.
- Use the hardware profile names from `docs/source-of-truth/` instead of informal descriptions:
  - `CURRENT_UNO_HX711`
  - `TARGET_XIAO_BLE_HX711`

## Working Rule

When the code and documentation disagree, update the code or docs so that `docs/source-of-truth/` remains the authoritative baseline. Do not reintroduce an alternative desktop/runtime surface without updating those documents first.
