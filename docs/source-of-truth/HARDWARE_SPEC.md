# Hardware Spec

## Active Hardware Profile

The current active hardware profile is `CURRENT_UNO_HX711`.

Confirmed active setup:

- 1 x Arduino UNO
- 4 x HX711
- 4 x load cell / strain channels
- USB serial connection to the host

Per current firmware comments and pin mapping:

- Index: DOUT 2, SCK 6
- Middle: DOUT 3, SCK 7
- Ring: DOUT 4, SCK 8
- Pinky: DOUT 5, SCK 9

## Active Firmware Baseline

Firmware lives in `firmware/firmware.ino`.

Confirmed behavior:

- serial baud: `115200`
- loop pacing: `20 ms` target, about `50 Hz`
- boot messages:
  - `# boot ok`
  - `# mode raw`
- stream line format:
  - `t_ms,v0,v1,v2,v3`
- modes:
  - `raw`
  - `kg`

## Confirmed Commands

- `t`
  - tare all channels
- `c <channel> <known_kg>`
  - calibrate one channel
- `p`
  - print current calibration/mode/debug details
- `m raw`
  - switch stream to raw mode
- `m kg`
  - switch stream to kg mode

Firmware stores calibration factors in EEPROM and uses the current tare offsets at runtime.

## Current Hardware Implications

- Native GripSense hardware is the only active full-fidelity FingerMap™ path.
- The current device is wired and host-tethered.
- The firmware currently streams one sample line for all four channels together.
- Runtime verification in the client is required before user-facing force values can be trusted.

## Target Hardware Profile

The planned target profile is `TARGET_XIAO_BLE_HX711`.

Planned direction:

- 1 x Seeed XIAO BLE nRF52840
- 4 x HX711
- 4 x load cells
- 1 x 500 mAh LiPo
- 1 x small slide switch
- shared GND/3V3 distribution, ideally on a compact board or perfboard

## Target Hardware Intent

The target device should:

- preserve the four-channel GripSense model
- support a BLE-capable transport path
- remain compatible with the shared logical sample contract
- serve a later native mobile client without redefining metrics or product behavior

## Known Unknowns

These items remain open and should not be treated as settled facts:

- the best XIAO GPIO/timing strategy for 4 x HX711
- whether future BLE payloads stay text-first or use a binary payload plus adapter
- final battery, sleep, reconnect, and firmware-update behavior
- final compact mechanical and electrical packaging
