# Benchmark and Workout Engine

## Purpose

This document defines the shared benchmark and workout engine used in `v1.5`.

- `TEST` is the benchmark surface.
- `TRAIN` is the prescription and guided-execution surface.
- Prescriptions should use measured per-finger data, not only static hangboard templates.

This is a Krimblokk product design note. It is inspired by external training systems, but it is not a 1:1 copy of any third-party app or protocol library.

## Shared Data Model

Core workout objects are defined in `packages/core/src/workouts.ts`.

Key types:

- `WorkoutDefinition`
- `BenchmarkDefinition`
- `TrainingWorkoutDefinition`
- `CustomWorkoutDefinition`
- `WorkoutBlock`
- `WorkoutTargetLogic`
- `WorkoutStopCondition`
- `BenchmarkScore`
- `AthleteForceProfile`
- `WorkoutPrescription`
- `SafetyFlag`
- `SessionComparisonDelta`

Train-specific runtime types live in `web/src/components/train/types.ts`.

Key runtime types:

- `TrainProtocol`
- `CustomTrainWorkout`
- `TrainRepResult`
- `TrainSummary`
- `TrainSessionResult`
- `TrainRecommendation`

## Benchmark Categories

Built-in benchmark categories in `TEST`:

- `A. Max Strength Benchmark`
- `B. Repeated Max Strength Benchmark`
- `C. Recruitment / RFD Benchmark`
- `D. Strength-Endurance / Repeater Benchmark`
- `E. Health / Capacity Benchmark`
- `F. Individual Force Curve Benchmark`

Current protocol mapping:

- `standard_max` -> Max Strength Benchmark
- `repeated_max_7_53` -> Repeated Max Strength Benchmark
- `explosive_pull` -> Recruitment / RFD Benchmark
- `advanced_repeater` -> Strength-Endurance Benchmark
- `distribution_hold` and `health_capacity_benchmark` -> Health / Capacity Benchmark
- `force_curve_profile` -> Individual Force Curve Benchmark

## Minimum Scoring Model

Benchmarks should calculate at minimum:

- peak force
- average force
- impulse / force-time area
- RFD100 and RFD200 where relevant
- fatigue index
- force drift over time
- finger contribution percent
- finger asymmetry
- redistribution score
- stability score
- left vs right comparison when both hands exist

Advanced per-finger analytics:

- finger initiation order
- finger dropout order
- compensation mapping
- finger synergy score
- tactical grip profile
- session comparison deltas
- safety flags

Current benchmark score model:

- high peak, average force, RFD, and stability raise score
- high fatigue, redistribution, and asymmetry reduce score
- score is used as a training decision aid, not a medical or absolute performance grade

## Training Prescription Rules

Deterministic rules used in `TRAIN`:

- high peak force with low RFD -> recommend recruitment / RFD clusters
- high peak force with strong fatigue or rep decay -> recommend repeated-strength work
- unstable force pattern or compensation risk -> recommend health / capacity work
- recurring weak finger -> add finger-bias accessory work
- recent force-curve benchmark -> allow individualized force-curve session
- no clear limiter or no history -> default to `Strength 10s`

## Progression Rules

Default progression logic:

- max-strength sessions: increase target by 2-3% only after two clean sessions above 90% adherence
- repeated-strength sessions: add one set before adding intensity
- strength-endurance sessions: keep target stable until late-session completion stays above 90%
- health / capacity sessions: progress reps before target, never when instability or pain flags rise
- individualized sessions: require improved redistribution and stability before increasing load
- finger-bias accessory work: progress only if the weak finger contributes more evenly without new overload flags

## Example Benchmark Definitions

```json
[
  {
    "id": "standard_max",
    "kind": "benchmark",
    "category": "max_strength",
    "name": "Max Strength Benchmark",
    "gripType": "half_crimp",
    "modality": "edge",
    "contractionDurationSec": 7,
    "restDurationSec": 120,
    "reps": 1,
    "sets": 6,
    "targetIntensityLogic": "Progressive loading across 4-8 sets with 2 minute rest.",
    "reportRelativeToBodyweight": true
  },
  {
    "id": "explosive_pull",
    "kind": "benchmark",
    "category": "recruitment_rfd",
    "name": "Recruitment / RFD Benchmark",
    "gripType": "ergonomic_block",
    "modality": "no_hang_pull",
    "contractionDurationSec": 3,
    "restDurationSec": 120,
    "reps": 1,
    "sets": 5,
    "targetIntensityLogic": "Short explosive pulls with focus on RFD100, RFD200 and initiation order.",
    "reportRelativeToBodyweight": false
  }
]
```

## Example Training Definitions

```json
[
  {
    "id": "strength_10s",
    "kind": "prescribed",
    "category": "max_strength",
    "targetLogic": {
      "mode": "pct_latest_benchmark",
      "benchmarkId": "standard_max",
      "percent": 0.85,
      "handScoped": true
    },
    "blocks": [
      { "id": "warmup", "phase": "warmup", "setCount": 1, "repsPerSet": 3, "workSec": 7, "restBetweenRepsSec": 30, "restBetweenSetsSec": 0 },
      { "id": "main", "phase": "main", "setCount": 2, "repsPerSet": 3, "workSec": 10, "restBetweenRepsSec": 120, "restBetweenSetsSec": 180 }
    ]
  },
  {
    "id": "recruitment_rfd_clusters",
    "kind": "prescribed",
    "category": "recruitment_rfd",
    "targetLogic": {
      "mode": "pct_latest_benchmark",
      "benchmarkId": "standard_max",
      "percent": 0.55,
      "handScoped": true
    },
    "blocks": [
      { "id": "warmup", "phase": "warmup", "setCount": 1, "repsPerSet": 4, "workSec": 3, "restBetweenRepsSec": 20, "restBetweenSetsSec": 0 },
      { "id": "main", "phase": "main", "setCount": 4, "repsPerSet": 3, "workSec": 3, "restBetweenRepsSec": 20, "restBetweenSetsSec": 150 }
    ]
  }
]
```

## Example User-Facing Text

Max Strength Benchmark:

> This benchmark measures how much force you can produce in a standardized 7-second effort. It is the anchor for later auto-targeted training sessions.

Recruitment / RFD Benchmark:

> This benchmark looks at how quickly you can create force, not just how high the peak gets. It is useful when you are already strong but slow to recruit.

Health / Capacity Session:

> This workout keeps force lower and cleaner so you can build tissue tolerance, steadier loading and better finger sharing without chasing max output.

## Workout Selection Pseudocode

```text
input: benchmark_history, active_hand, active_profile

latest_max = latest benchmark where protocol == standard_max and hand == active_hand
latest_recruitment = latest benchmark where category == recruitment_rfd
latest_repeated = latest benchmark where category == repeated_max_strength or strength_endurance
latest_health = latest benchmark where category == health_capacity
latest_curve = latest benchmark where category == force_curve

profile = buildAthleteForceProfile(history, hand)

if latest_max exists and latest_recruitment.rfd100 is low:
  prescribe recruitment_rfd_clusters
else if latest_repeated shows large fatigue or decay:
  prescribe repeated_strength_7_53
else if profile.unstablePattern or profile.compensationRisk:
  prescribe health_capacity_density
else:
  prescribe strength_10s

if profile.weakFingers is not empty:
  add finger_bias_accessory as support session

if latest_curve exists:
  allow individualized_force_curve as secondary option
```

## Source Roles

- [Crimpd](https://crimpd.com/)
  - UI inspiration for timer-forward workout execution
- [Lattice 2 Arm Finger Strength Test](https://latticetraining.com/2-arm-fs-test/)
  - benchmarking and max-strength framing
- [Lattice Testing & Training Rung Instructions PDF](https://latticetraining.com/app/uploads/2018/06/1528799872597_180503_Lattice-Testing-Training-Rung-Instructions.pdf)
  - structured testing and training context
- [Eric Horst: 4 Fingerboard Strength Protocols That Work](https://trainingforclimbing.com/4-fingerboard-strength-protocols-that-work/)
  - max hangs, repeaters, and 7-53 style principles
- [Eric Horst: Research on Grip Strength and Hangboard Training Protocols](https://trainingforclimbing.com/research-on-grip-strength-and-hangboard-training-protocols/)
  - context around strength and hangboard protocol reasoning
- [Camp 4 Human Performance: Four Weeks of Finger Grip Training for Elite Performance](https://www.camp4humanperformance.com/research/finger-grip-training-performance)
  - active flexion, safer grip options, and performance framing
- [Camp 4 Human Performance: How Rate of Force Development and Strength Define Elite Sport Climbers](https://www.camp4humanperformance.com/research/climbing-rfd-study-insights)
  - RFD-focused framing
- [Hand of God / Grip Gains](https://handofgod.shop/)
  - product inspiration for individualized prescription from force data

Hand of God / Grip Gains is treated here as product inspiration, not as the main scientific authority.
