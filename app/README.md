# Legacy Desktop Reference

`app/` is the older Python desktop implementation.

Status in this repository:

- kept as a fallback/reference during the migration
- still useful for validating analytics behavior and test expectations
- not the primary product direction going forward

Primary direction:

- `web/` is the active UI baseline
- `packages/core/` is the shared TypeScript domain layer
- future device control is expected to move toward XIAO BLE hardware and a native mobile client

Use `app/` for reference, regression checks, and temporary fallback. Do not treat it as the long-term architecture target.
