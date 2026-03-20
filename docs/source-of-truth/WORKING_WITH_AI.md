# Working With AI

This is a practical operating guide for AI tools and human collaborators working in this repository. Use it as a companion to `PROJECT_GOVERNANCE.md`, not a replacement.

## Repository Purpose

- GripSense is a web-first four-channel finger-force measurement repository for climbing-related testing, training, and follow-up over time.
- The active product surfaces in this repo are `web/` and `packages/core/`.
- `firmware/` supports the current `CURRENT_UNO_HX711` baseline, but the main operator surface in this repository is the web app.

## Source Of Truth Hierarchy

- This GitHub repository is the master source of truth for the project.
- Inside the repo, `docs/source-of-truth/` is the authoritative documentation layer.
- `docs/reference/` contains derived summaries, quickstarts, research notes, and supporting material.
- Loose research notes, old summaries, chats, PDFs, and ad hoc documents can help with context, but they are not authoritative if they conflict with canonical docs.

## Recommended Reading Order

1. `README.md`
2. `docs/source-of-truth/INDEX.md`
3. `docs/source-of-truth/PROJECT_GOVERNANCE.md`
4. `docs/source-of-truth/PRODUCT_SCOPE.md`
5. `docs/source-of-truth/SYSTEM_ARCHITECTURE.md`
6. `docs/source-of-truth/HARDWARE_SPEC.md`
7. `docs/source-of-truth/SOFTWARE_ARCHITECTURE.md`
8. `docs/source-of-truth/METRICS_AND_PROTOCOLS.md`
9. `docs/source-of-truth/VALIDATION_PLAN.md`
10. `docs/source-of-truth/ROADMAP.md`
11. Then the relevant files in `docs/reference/`

## Conflict-Resolution Rule

- If documents conflict, `docs/source-of-truth/` wins.
- If canonical docs conflict with the implemented code or firmware, note the mismatch explicitly and treat it as something that must be reconciled.
- Do not silently invent missing project truth or assume a stale summary is current.

## Update Workflow

- When product truth changes, update the relevant file in `docs/source-of-truth/` first.
- Update `docs/reference/` and other derived material after the canonical change.
- Keep `README.md` and `docs/source-of-truth/INDEX.md` aligned with major documentation changes.
- Prefer consolidation over duplication. Extend an existing canonical doc when possible instead of creating overlapping summaries.

## AI Working Rules

- Always orient yourself in the repo before proposing or making changes.
- Prefer existing repo material and structure over inventing a new structure.
- Check whether a file already exists before creating a duplicate.
- Use concise, maintainable Markdown.
- Preserve useful project history, but keep history separate from current truth.
- If something is unclear, point to the relevant canonical doc or note the uncertainty explicitly.
