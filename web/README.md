# FingerForce Web App

React + TypeScript + Vite rebuild of the desktop `app/` for browser-based live acquisition and analysis.

## Stack

- React 19 + TypeScript
- Zustand (device/live/app stores)
- uPlot (high-frequency charts)
- Tailwind CSS v4
- IndexedDB (`idb`) for session persistence
- Web Serial API + simulator source

## Run

```bash
cd web
npm ci
npm run dev
```

Build and lint:

```bash
npm run lint
npm run build
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
- The original Python app remains unchanged in `app/`.
