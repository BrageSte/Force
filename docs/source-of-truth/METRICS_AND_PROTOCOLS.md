# Metrics and Protocols

## Canonical Metrics

The baseline GripSense metrics are:

- peak force
- average force
- impulse / force-time area
- RFD100
- RFD200
- fatigue index
- force drift
- stability / steadiness

Per-finger metrics, when the device supports them:

- finger contribution percent
- finger asymmetry
- redistribution score
- initiation order
- dropout order
- compensation mapping
- synergy / coordination signals

## Capability Rule

- Native GripSense hardware can expose total force plus per-finger outputs.
- Tindeq Progressor is total-force-only.
- Protocols, scoring, storage, and UI must declare or respect whether per-finger force is required.
- Unsupported per-finger outputs must be hidden or returned as `null`, not fabricated.

## Benchmark Protocol Set

Current benchmark categories:

- Max Strength Benchmark
- Repeated Max Strength Benchmark
- Recruitment / RFD Benchmark
- Strength-Endurance Benchmark
- Health / Capacity Benchmark
- Individual Force Curve Benchmark

Current built-in benchmark IDs:

- `standard_max`
- `repeated_max_7_53`
- `explosive_pull`
- `advanced_repeater`
- `distribution_hold`
- `health_capacity_benchmark`
- `force_curve_profile`

Current capability gating:

- `distribution_hold` requires per-finger force
- `standard_max`, `repeated_max_7_53`, `explosive_pull`, `advanced_repeater`, `health_capacity_benchmark`, and `force_curve_profile` can run on total-force-only devices

## Training Protocol Set

Current built-in training IDs:

- `strength_10s`
- `repeated_strength_7_53`
- `recruitment_rfd_clusters`
- `strength_endurance_repeaters`
- `health_capacity_density`
- `individualized_force_curve`
- `finger_bias_accessory`

`finger_bias_accessory` is the current built-in training protocol that explicitly requires per-finger capability.

## Deterministic Prescription Rules

Current prescription baseline:

- high peak force with low RFD -> recommend recruitment-focused work
- high peak force with strong fatigue or rep decay -> recommend repeated-strength work
- unstable loading or compensation risk -> recommend health/capacity work
- recurring weak finger -> add finger-bias accessory work
- recent force-curve profile -> allow individualized force-curve work
- no clear limiter -> default to `strength_10s`

## Coaching and Result Interpretation

Current test results include deterministic coaching/reporting rather than a freeform model-generated coach.

The active AI coaching report shape is built around:

- `primaryInsight`
- `focusAreas`
- `recommendedAction`

This should be treated as structured product logic, not an open-ended assistant behavior layer.

## Implemented vs Planned

Implemented in the repo today:

- benchmark/test libraries
- train libraries
- deterministic prescription logic
- capability gating
- structured AI coaching report outputs

Still directional or incomplete:

- fully validated measurement-quality thresholds
- final force-curve and per-finger metric interpretation standards
- final mobile/BLE execution path
