# Legacy Desktop Reference

`app/` is the older Python desktop implementation and is no longer the active product surface.

Status in this repository:

- kept only as a legacy code/reference layer during migration
- still useful for validating analytics behavior and parity expectations
- not intended for normal operation, packaging, or user distribution

Primary direction:

- `web/` is the active UI baseline
- `packages/core/` is the shared TypeScript domain layer
- future device control is expected to move toward `TARGET_XIAO_BLE_HX711` and a native mobile client

Use `app/` only for reference and regression checks. Do not add new product-facing features here unless the work is strictly needed for migration validation.
