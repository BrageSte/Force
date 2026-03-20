# ADR-001: Documentation Structure

## Status

Accepted

## Date

2026-03-20

## Context

The repository had multiple project-overview documents that mixed governing truth, onboarding notes, research synthesis, and AI-friendly summaries.

That created a few problems:

- it was not always obvious which document defined the official current state
- onboarding docs and AI quickstart material could drift from the governing baseline
- future updates risked touching summaries before the actual source of truth
- humans and coding agents had to infer which docs were authoritative

## Decision

The repo now separates documentation into two main layers:

- `docs/source-of-truth/`
  - canonical project documentation
- `docs/reference/`
  - derived summaries, research notes, AI quickstarts, and supporting material

The root `README.md` and `AGENTS.md` point readers to `docs/source-of-truth/` first.

If documentation conflicts, `docs/source-of-truth/` wins.

## Consequences

### Positive

- there is one clear canonical layer for project truth
- reference material can stay useful without pretending to be authoritative
- humans, Codex, and Claude can orient faster
- future doc maintenance becomes simpler and safer

### Tradeoffs

- canonical docs must be actively maintained when the project changes
- supporting docs need periodic refresh after canonical changes
- older links to removed legacy docs must be updated

## Maintenance Rule

When project direction, architecture, hardware, scope, or protocol behavior changes:

1. update the relevant file in `docs/source-of-truth/`
2. make code and canonical docs agree
3. refresh `docs/reference/` and other supporting material

Working notes, plans, PDFs, and chat transcripts can inform decisions, but they do not establish project truth by themselves.
