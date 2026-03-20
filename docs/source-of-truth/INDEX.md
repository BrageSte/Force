# GripSense Source of Truth

`docs/source-of-truth/` is the authoritative documentation layer for this repository.

If any document in `docs/reference/`, `docs/plans/`, chats, notes, PDFs, or ad hoc analyses conflicts with these files, the version in `docs/source-of-truth/` wins.

## Read First

1. `PROJECT_GOVERNANCE.md`
2. `PRODUCT_SCOPE.md`
3. `SYSTEM_ARCHITECTURE.md`
4. `HARDWARE_SPEC.md`
5. `SOFTWARE_ARCHITECTURE.md`
6. `METRICS_AND_PROTOCOLS.md`
7. `VALIDATION_PLAN.md`
8. `ROADMAP.md`

## What Lives Here

### `PROJECT_GOVERNANCE.md`
Defines documentation authority, maintenance rules, and how canonical docs relate to reference material and working notes.

### `PRODUCT_SCOPE.md`
Defines what GripSense is, who it is for, the active product surfaces, and what is explicitly in and out of scope.

### `SYSTEM_ARCHITECTURE.md`
Defines the end-to-end product architecture, capability-aware device model, transport contract, and migration path from `CURRENT_UNO_HX711` to `TARGET_XIAO_BLE_HX711`.

### `HARDWARE_SPEC.md`
Describes the active UNO-based hardware, firmware assumptions, command and stream behavior, target XIAO BLE direction, and current unknowns.

### `SOFTWARE_ARCHITECTURE.md`
Describes the repo structure, active runtime surfaces, major software modules, device providers, verification/setup-readiness model, and persistence boundaries.

### `METRICS_AND_PROTOCOLS.md`
Defines the canonical metrics, benchmark/test protocol set, training protocol set, capability gating rules, and prescription logic.

### `VALIDATION_PLAN.md`
Tracks current verification status, automated checks, manual hardware checks, measurement-quality backlog, and known issues.

### `ROADMAP.md`
Defines the active project direction, milestones, near-term phases, "not now" decisions, and open questions.

## Related Layers

- `docs/reference/`
  - Derived summaries, research synthesis, AI quickstart material, competitor notes, and supporting checklists.
- `docs/decisions/`
  - ADRs for durable repo/process decisions.
- `docs/plans/`
  - Working plans and draft roadmaps. Useful, but not authoritative when they differ from this folder.

## Maintenance Rule

When project direction changes, update the relevant file in `docs/source-of-truth/` first. Refresh reference docs only after the canonical update is complete.
