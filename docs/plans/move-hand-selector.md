# Flytt håndvelger til LiveFingerScene-headeren

## Context
Håndvelgeren (Left/Right) er gjemt bort i bunnseksjonen av ConnectionPanel sammen med Tare/Record-knapper. Brukeren vil ha den mer synlig og tilgjengelig — plassert i headeren til LiveFingerScene der man faktisk ser live data.

## Plan

### 1. Legg til håndvelger i LiveFingerScene header
**Fil:** `web/src/components/live/LiveFingerScene.tsx`

- Importér `setHand` fra `useAppStore` og `setMeasurementHandOverride` fra `useLiveStore`
- Legg til `handleHandChange`-logikk (gjenbruk mønsteret fra ConnectionPanel)
- Plasser Left/Right toggle i headeren ved linje ~339, til høyre for tittelen i `flex items-start justify-between` wrapperen
- Bruk samme pill-style toggle som i ConnectionPanel (bg-primary for aktiv, text-muted for inaktiv)
- Vis også i `TotalForceFallbackCard`-seksjonen (linje ~310)

### 2. Fjern håndvelger fra ConnectionPanel
**Fil:** `web/src/components/live/ConnectionPanel.tsx`

- Fjern `<div className="rounded-2xl border border-border bg-surface px-3 py-2">` med "Measured Hand" (linje 168-188)
- Fjern ubrukte imports/state: `measurementHandOverride`, `setMeasurementHandOverride`, `hand`, `setHand` fra ConnectionPanel (men bare om de ikke brukes av `handleStartRecording`)
  - `handleStartRecording` bruker `hand` via `useLiveStore.getState()` direkte, og `handleHandChange` bruker `setHand`/`setMeasurementHandOverride` — disse kan fjernes fra ConnectionPanel
  - Behold `hand` i `handleStartRecording` — den henter den fra store direkte

### Filer som endres
- `web/src/components/live/LiveFingerScene.tsx` — legg til håndvelger
- `web/src/components/live/ConnectionPanel.tsx` — fjern håndvelger

## Verifikasjon
1. Start dev-server og åpne Live-siden
2. Sjekk at håndvelger vises i LiveFingerScene-headeren
3. Sjekk at Left/Right toggle fungerer og finger-rekkefølgen endres
4. Sjekk at ConnectionPanel ikke lenger viser "Measured Hand"
5. Sjekk at Record Session fortsatt bruker riktig hånd
