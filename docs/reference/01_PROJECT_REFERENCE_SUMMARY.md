# Project Reference Summary

## What GripSense Is

GripSense is a climbing-oriented finger-force product built around four simultaneous sensor channels and FingerMap™ per-finger analytics.

It is not just a sensor prototype. The repo already supports a product model with three layers:

1. measurement
2. interpretation
3. training use

## Current Product Baseline

The current official repo baseline is:

- web-first
- `web/` as the active operator surface
- `packages/core/` as the shared domain layer
- `firmware/` as the current wired-device firmware baseline
- `CURRENT_UNO_HX711` as the active native hardware profile
- Tindeq Progressor as a supported total-force-only external device

## Why The Product Matters

Most devices in this category focus on total force.

GripSense is meant to answer different questions:

- which finger is contributing
- which finger is dropping out
- how load redistributes under fatigue
- whether asymmetry or compensation is emerging
- how force quality changes over time

That is the practical value of FingerMap™.

## Product Surfaces

### `LIVE`

Fast use, connection flow, live monitoring, and short local captures.

### `TEST`

Formal benchmarks, scoring, comparison, and historical tracking.

### `TRAIN`

Guided workouts, prescriptions, and training-result review.

## System Summary

### Native GripSense path

- total force + per-finger force
- full FingerMap™ analytics
- wired Serial today
- BLE-capable target later

### External compatibility path

- total force only
- used today for Tindeq Progressor
- must degrade cleanly without fake per-finger outputs

## Software Summary

`packages/core/` already exports the core logic for:

- parsing
- calibration
- smoothing
- segmentation
- metrics
- curve analysis
- session analysis
- workouts and prescriptions
- verification

The web app layers UI, storage, device providers, and guided workflows on top of that shared domain layer.

## Key Metrics and Protocol Families

Core metrics include:

- peak force
- average force
- impulse
- RFD100 / RFD200
- fatigue
- drift
- stability

Per-finger metrics include:

- contribution
- asymmetry
- redistribution
- initiation/dropout patterns
- compensation signals

Current built-in benchmark families:

- max strength
- repeated max strength
- recruitment / RFD
- strength-endurance
- health / capacity
- force curve profiling

Current built-in training families:

- max strength
- repeated strength
- recruitment / RFD
- strength-endurance
- health / capacity
- individualized force-curve work
- finger-bias accessory work

## What Still Needs Validation

The repo is ahead of the measurement-validation docs in several areas.

Open validation work still includes:

- sample-rate documentation
- calibration repeatability
- drift and hysteresis
- same-day and between-day reliability
- cross-talk testing
- summed-channel versus total-force validation
