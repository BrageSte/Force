# ChatGPT Source Pointer — GripSense / Force

This file tells ChatGPT where the current project truth lives and how to orient itself before answering questions about the project.

## Primary Source Of Truth

The primary source of truth for this project is the GitHub repository:

- Repo: `BrageSte/Force`
- URL: `https://github.com/BrageSte/Force`

When discussing current architecture, documentation, roadmap, product scope, implementation direction, hardware/software structure, or project status, prefer the GitHub repository over old chats, ad hoc notes, or stale summaries.

## Authoritative Documentation In The Repo

Inside the repo, the authoritative documentation lives in:

- `docs/source-of-truth/`

If documents conflict, the files in `docs/source-of-truth/` win.

## Recommended Reading Order

Before giving project-specific advice, orient in this order:

1. `README.md`
2. `docs/source-of-truth/INDEX.md`
3. `docs/source-of-truth/WORKING_WITH_AI.md`
4. `docs/source-of-truth/PROJECT_GOVERNANCE.md`
5. `docs/source-of-truth/PRODUCT_SCOPE.md`
6. `docs/source-of-truth/SYSTEM_ARCHITECTURE.md`
7. `docs/source-of-truth/HARDWARE_SPEC.md`
8. `docs/source-of-truth/SOFTWARE_ARCHITECTURE.md`
9. `docs/source-of-truth/METRICS_AND_PROTOCOLS.md`
10. `docs/source-of-truth/VALIDATION_PLAN.md`
11. `docs/source-of-truth/ROADMAP.md`

Then consult relevant files in:

- `docs/reference/`

## Secondary / Supporting Material

The following may be useful for context, but are not authoritative if they conflict with canonical docs:

- old chat summaries
- ad hoc notes
- loose PDFs
- exploratory analyses
- research packages
- temporary planning docs

## Working Rule For ChatGPT

When answering questions about this project:

- first orient in the GitHub repo if repo access is available
- treat the GitHub repo as the master source of truth
- treat `docs/source-of-truth/` as authoritative
- use `docs/reference/` as supporting context
- if docs and implementation appear to conflict, explicitly mention the mismatch
- do not silently assume old chat context is current
- prefer current repo state over memory

## Practical Instruction

If the user asks about:
- architecture
- roadmap
- hardware direction
- software stack
- official metrics
- protocols
- documentation structure
- current implementation

then use the GitHub repo and canonical docs as the baseline.

If repo access is unavailable in the current environment, clearly state that limitation and ask the user to upload or paste the relevant files.