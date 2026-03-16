# Training Protocol Design

## Purpose

`TEST` and `TRAIN` stay separate in `v1.5`.

- `LIVE` handles quick checks and short local measurements.
- `TEST` benchmarks the athlete.
- `TRAIN` applies those results through guided workouts, recommendations, and custom sessions.

The goal is to move from static hangboard presets toward a force-aware climbing training tool that can use:

- total force
- force per finger
- rate of force development
- redistribution and compensation patterns
- bodyweight-relative context when available

The runner must also degrade cleanly by device capability:

- native BS hardware: full total-force + per-finger analytics
- Tindeq Progressor: total-force-only execution, graphs, targets, and storage

## Hardware and Runtime Constraint

Current active runtime still targets `CURRENT_UNO_HX711`:

- Arduino UNO
- 4 x HX711
- 4 x load cell channels
- Web Serial transport

The `v1.5` workout engine is metadata-first for grip and modality.

That means:

- the UI can label sessions as `half_crimp`, `open_hand`, `edge`, `ergonomic_block`, or `no_hang_pull`
- scoring, filtering and prescriptions can use that context
- the current hardware does not yet enforce a physical mode switch

## Train Runner Design

The `TRAIN` runner is intentionally timer-forward and session-oriented.

Design goals:

- large central countdown
- clear block, set and rep status
- visible work/rest/set-rest phase
- large live total-force number
- target-band feedback
- live per-finger bars
- session-wide progress bar
- warm-up and main block distinction

When Tindeq is active:

- the large total-force number and force-time graph remain active
- per-finger bars, heatmaps, and redistribution-only views are hidden or disabled
- workouts that require `requiresPerFingerForce: true` are unavailable until native BS hardware is selected

UI direction is inspired by timer-heavy climbing training apps such as Crimpd, but adapted to Krimblokk's force-measurement surface.

## Auto-Target Logic

Supported target modes:

- `auto_from_latest_test`
- `bodyweight_relative`
- `manual`

Resolution order:

1. If the workout uses `% latest benchmark`, resolve from the latest matching benchmark for the same profile and hand.
2. If the workout uses `bodyweight_relative`, resolve from saved bodyweight if present.
3. If neither reference is available, fall back to `manual`.

This keeps the system practical on real user data and prevents silent assumptions when the required benchmark is missing.

## Built-In Workouts

All built-in workouts are Krimblokk product adaptations inspired by the source list below. They are not exact copies of third-party programs.

### Strength 10s

- category: `max_strength`
- goal: stable high-force recruitment
- default target: `85%` of latest `standard_max`
- structure:
  - warm-up primer
  - `2 sets x 3 reps`
  - `10s work / 120s rest`
  - `180s set rest`

### Repeated Strength 7:53

- category: `repeated_max_strength`
- goal: repeatable near-max output
- default target: `80%` of latest `standard_max`
- structure:
  - warm-up recruitment block
  - `3 sets x 3 reps`
  - `7s work / 53s rest`
  - `180s set rest`

### Recruitment Clusters

- category: `recruitment_rfd`
- goal: improve rapid force development
- default target: `55%` of latest `standard_max`
- structure:
  - warm-up cluster block
  - `4 sets x 3 reps`
  - `3s work / 20s rest`
  - `150s set rest`
- modality bias:
  - `ergonomic_block`
  - `no_hang_pull`

### Strength-Endurance Repeaters

- category: `strength_endurance`
- goal: repeated submax force under fatigue
- default target: `70%` of latest `standard_max`
- structure:
  - warm-up repeaters
  - `4 sets x 6 reps`
  - `7s work / 3s rest`
  - `180s set rest`

### Health Capacity Density

- category: `health_capacity`
- goal: tissue tolerance and cleaner load sharing
- default target: `45%` of latest `standard_max`
- structure:
  - tissue-prep block
  - `3 sets x 4 reps`
  - `20s work / 20s rest`
  - `120s set rest`

### Force Curve Builder

- category: `force_curve`
- goal: train the part of the force curve that broke down in the latest benchmark
- default target: `65%` of latest `standard_max`
- structure:
  - profile-prep block
  - `3 sets x 4 reps`
  - `8s work / 25s rest`
  - `150s set rest`

### Finger Bias Accessory

- category: `health_capacity`
- goal: support a weak or dropout-prone finger without turning the session into a max-strength day
- default target: `50%` of latest `standard_max`
- structure:
  - finger-bias warm-up
  - `3 sets x 5 reps`
  - `6s work / 12s rest`
  - `90s set rest`

## Prescription Logic

Current deterministic rules:

- high peak force with poor RFD -> recruitment clusters
- high peak force with large rep-to-rep decay -> repeated strength 7:53
- unstable loading or compensation risk -> health capacity density
- weak finger across recent benchmarks -> finger bias accessory
- recent force-curve benchmark -> offer force curve builder
- no clear limiter -> strength 10s as default anchor workout

Recommendation guardrails:

- Tindeq-only history can still drive total-force prescriptions
- weak-finger and redistribution-driven recommendations should only be emitted when recent per-finger benchmark history exists

## Result Focus in TRAIN

Train results are not stored as tests.

Primary outputs:

- completion percentage
- total time under tension
- peak total kg
- average hold kg
- average impulse
- adherence to target band
- session deltas vs previous matching workout
- safety flags
- prescription rationale snapshot

## Sources

- [Crimpd](https://crimpd.com/)
- [Lattice 2 Arm Finger Strength Test](https://latticetraining.com/2-arm-fs-test/)
- [Lattice Testing & Training Rung Instructions PDF](https://latticetraining.com/app/uploads/2018/06/1528799872597_180503_Lattice-Testing-Training-Rung-Instructions.pdf)
- [Eric Horst: 4 Fingerboard Strength Protocols That Work](https://trainingforclimbing.com/4-fingerboard-strength-protocols-that-work/)
- [Eric Horst: Research on Grip Strength and Hangboard Training Protocols](https://trainingforclimbing.com/research-on-grip-strength-and-hangboard-training-protocols/)
- [Camp 4 Human Performance: Four Weeks of Finger Grip Training for Elite Performance](https://www.camp4humanperformance.com/research/finger-grip-training-performance)
- [Camp 4 Human Performance: How Rate of Force Development and Strength Define Elite Sport Climbers](https://www.camp4humanperformance.com/research/climbing-rfd-study-insights)
- [Hand of God / Grip Gains](https://handofgod.shop/)

Krimblokk presets and prescriptions are product adaptations inspired by these sources. They are not direct reproductions of third-party branded workout libraries.
