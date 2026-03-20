# Next Steps Checklist

## Documentation And Governance

- [ ] keep `docs/source-of-truth/` current when product direction changes
- [ ] refresh reference docs after canonical updates
- [ ] retire any future ad hoc summaries that drift from the canonical layer

## Hardware

- [ ] document exact sensor setup and load capacity per channel
- [ ] document the mechanical load path per finger
- [ ] test cross-talk between fingers
- [ ] test drift and hysteresis over time
- [ ] define the compact BLE layout target for `TARGET_XIAO_BLE_HX711`

## Signal And Software

- [ ] document real sample-rate behavior under the active runtime
- [ ] document the filtering and smoothing strategy
- [ ] define the canonical calibration flow in practice, not just in code
- [ ] continue consolidating shared logic into `packages/core/`
- [ ] keep capability gating explicit in UI, metrics, and storage

## Protocols

- [ ] keep the standard max test stable
- [ ] keep the repeated max and RFD tests stable
- [ ] refine distribution / steadiness interpretation
- [ ] refine health / asymmetry baseline interpretation
- [ ] document which protocol decisions are stable versus still experimental

## Validation

- [ ] calibrate against known weights
- [ ] run same-day test-retest
- [ ] run between-day test-retest
- [ ] compare summed per-finger output versus reference expectations
- [ ] document practical error margins

## Product Strategy

- [ ] define the primary MVP user more explicitly
- [ ] decide which first-use case leads the story: testing, training, or rehab-adjacent use
- [ ] define the top signature metrics worth highlighting
- [ ] keep the "why unique" story tied to FingerMap™ rather than generic force metrics
