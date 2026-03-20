# Project Governance

## Authority

- This GitHub repository is the primary source of truth for the GripSense project.
- `docs/source-of-truth/` is the authoritative documentation layer inside the repository.
- `docs/reference/` is derived and supporting material. It is useful for onboarding, research, and context, but it is not authoritative if it conflicts with `docs/source-of-truth/`.
- Chats, loose notes, PDFs, exported summaries, ad hoc analyses, and working plans are supporting material, not governing truth.

## What Canonical Docs Control

Canonical docs define:

- current product purpose and scope
- current hardware baseline and target hardware direction
- current software architecture and active repo surfaces
- shared data and capability assumptions
- canonical metrics, benchmark protocols, and training rules
- active validation expectations and roadmap direction

## Update Rule

When the project changes:

1. Update the relevant file in `docs/source-of-truth/` first.
2. Align code and canonical docs if they diverge.
3. Refresh `docs/reference/` and other supporting material after the canonical update.

Do not treat a summary, quickstart, PDF, or chat transcript as the official project baseline unless the same change has been written into `docs/source-of-truth/`.

## Documentation Roles

### Canonical docs

Use these to decide what the project officially is right now.

### Reference docs

Use these to onboard quickly, review research, gather context for AI tools, or see supporting implications and checklists.

### Working material

Use these for exploration, drafts, presentation assets, and future-thinking. They can inform decisions, but they do not override the canonical layer.

## Conflict Resolution

If two documents disagree:

1. `docs/source-of-truth/` wins.
2. Code and firmware should be checked against the canonical docs.
3. Supporting docs should be corrected to match the canonical version.

## Maintenance Expectations

- Keep canonical docs concise and easy to scan.
- Prefer behavior-level truth over speculative detail.
- Mark uncertainty explicitly instead of inventing detail.
- Use the hardware profile names `CURRENT_UNO_HX711` and `TARGET_XIAO_BLE_HX711`.
- Preserve the repo baseline that `web/` and `packages/core/` are the active product surfaces in this repository.
