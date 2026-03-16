# Project Context

This file is the mandatory first read for any agent or LLM working in this repository.

## What This App Is

Krimblokk is a four-channel finger force measurement product. It reads force from four sensors, maps them to Index, Middle, Ring, and Pinky, and presents live force, test workflows, session analysis, and history.

The current usable operator surface is the `web/` application. The older `app/` desktop program still exists in the repository as a legacy code reference while the shared TypeScript domain layer replaces duplicated logic, but it should not be treated as the active operator surface.

## Why It Exists

The product exists to measure finger force in a structured way, not just to show live numbers. It is intended to:

- capture force from four fingers at the same time
- support repeatable test protocols
- analyze peak force, rate of force development, load distribution, drift, steadiness, and fatigue
- retain session data for comparison over time
- eventually move from tethered Arduino USB usage to a compact battery powered BLE device

## Who It Is For

Primary users are people who need structured finger-force testing and follow-up over time. That includes training, performance, rehab, and technical evaluation scenarios where per-finger force and force distribution matter.

## Current Hardware

Hardware profile name: `CURRENT_UNO_HX711`

Current physical setup in active use:

- 1 x Arduino UNO
- 4 x HX711
- 4 x strain/load cell channels
- USB serial connection from device to host

Current firmware assumptions:

- firmware lives in `firmware/firmware.ino`
- transport is newline-delimited serial text
- tare, debug, and stream-mode commands are sent over serial

## Current Software Surfaces

- `firmware/`
  - Arduino firmware for the current UNO-based wired setup
- `web/`
  - active UI baseline and primary direction
  - runs in browser with Web Serial today
- `app/`
  - older Python desktop application
  - retained only as legacy reference while TypeScript parity is built
  - not for active use, packaging, or distribution
- `packages/core/`
  - shared TypeScript domain logic for parsing, calibration, smoothing, segmentation, metrics, and session analysis

## Future Hardware

Hardware profile name: `TARGET_XIAO_BLE_HX711`

Planned target setup:

- 1 x Seeed XIAO BLE nRF52840
- 4 x HX711
- 4 x load cell
- 1 x 500 mAh LiPo
- 1 x small slide switch
- 1 x shared GND/3V3 distribution, preferably on small perfboard

## Target Direction

The long-term product direction is:

- compact BLE-capable device based on XIAO BLE
- mobile control from an App Store / Google Play app
- optional web service later for storage, review, or admin workflows

Web browser support is useful, but browser-only mobile is not the primary long-term control surface.

## Active Now vs Planned Later

Active now:

- Arduino UNO + HX711 wired serial path
- `web/` UI baseline
- Web Serial transport
- simulator path for development
- `app/` as legacy reference only

Planned later:

- XIAO BLE firmware
- BLE transport shared with mobile app
- native mobile client
- optional hosted/web service workflows

## Canonical Terminology

- Acquisition sample:
  - raw transport payload received from serial or BLE
- Force sample:
  - normalized application sample with `raw` and `kg` values
- Input mode:
  - `MODE_KG_DIRECT` means the device streams kilograms
  - `MODE_RAW` means the device streams counts and the client converts with offsets/scales
- Source kind:
  - `Serial`, `Simulator`, or future `BLE_UART`
- Effort:
  - one segmented pull/hold event within a recording or test
- Session:
  - a saved recording that may contain multiple efforts

## Canonical Data Contract

Serial and future BLE should use the same logical sample contract.

Transport framing:

- newline-delimited text

Accepted sample payloads:

- CSV with timestamp: `t_ms,f0,f1,f2,f3`
- CSV without timestamp: `f0,f1,f2,f3`
- JSON: `{"t_ms":123,"f":[f0,f1,f2,f3]}`

Transport mode per connection:

- exactly one active stream mode at a time: `raw` or `kg`

Status/debug lines:

- start with `#`
- non-sample firmware acknowledgements such as `ok`, `err`, and `usage` are treated as status messages

## Current Non-Negotiable Direction

- Keep the current `web/` UI structure stable while cleaning up internals.
- Do not remove `app/` yet, but do not use it as the active product surface.
- Do not invent new transport contracts outside the shared core package.
- Future hardware/software migration must map back to `CURRENT_UNO_HX711` and forward to `TARGET_XIAO_BLE_HX711`.
- New product-facing work belongs in `web/` and `packages/core`.
