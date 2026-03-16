# Krimblokk Web

Primary product surface for Krimblokk. This browser application runs against the current `CURRENT_UNO_HX711` hardware profile over Web Serial and also supports Tindeq Progressor as a total-force-only BLE source.

## Stack

- React 19 + TypeScript
- Zustand (device/live/app stores)
- uPlot (high-frequency charts)
- Tailwind CSS v4
- IndexedDB (`idb`) for session persistence
- Web Serial API + simulator source

## Run

From the repository root:

```bash
npm ci
npm run dev:web
```

Or from inside `web/`:

```bash
cd web
npm run dev
```

Build and lint:

```bash
npm run lint
npm run build
```

Run tests:

```bash
npm run test
```

## Implemented MVP Scope

- Live force ingestion from `Simulator` and `Serial`
- Ring buffer charting (total + 4 fingers)
- Auto effort detection
- Live effort metrics (peak, RFD, hold, TUT, imbalance)
- Recording and session analysis
- Session history with CSV export
- Firmware command controls (`t`, `m kg`, `c <ch> <kg>`)
- Settings persistence (`localStorage`) and sessions in IndexedDB
- Test module add-on:
  - Test library with Core / Advanced / Experimental protocols
  - Guided state machine (`ready -> countdown -> live -> hold complete -> rest -> next attempt -> finished`)
  - Single-test result summary with confidence labels
  - Attempt comparison view
  - Finger detail view with opposite-hand comparison
  - Session-context view for same-day trends

## Notes

- Web Serial requires a Chromium browser and secure context (`https` or `localhost`).
- Web Bluetooth device flows also require a secure context.
- All new user-facing product work should happen here or in `packages/core/`.
- For hosted deployment, publish the generated `dist/` output and ensure SPA fallback to `index.html`.
