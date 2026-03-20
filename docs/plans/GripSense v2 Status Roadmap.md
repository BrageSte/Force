GripSense v2 Status Roadmap
Summary
Dette dokumentet blir den nye gjeldende status-roadmapen for v2 og skal leve ved siden av /Users/brage/.claude/plans/bright-painting-fog.md, som beholdes som historisk idé-/strategiplan.
Roadmapen skal reflektere faktisk repo-status, ikke bare tidligere ønsker.
Baseline forblir web-first med stabil informasjonarkitektur rundt LIVE, TEST, TRAIN, SESSION, HISTORY, PROFILE og SETTINGS til en senere fase eksplisitt endrer det.
Gjort Nå
Rebranding-baseline er allerede på plass i styringsdokumentene: produktet er GripSense, hardware er GripSense Device, og per-finger-teknologien er FingerMap™.
TEST er forenklet uten å bryte baseline:
core vs advanced benchmarks er aktivt i bibliotek og picker
custom tools ligger bak advanced-flaten
TRAIN er forenklet uten å bryte prescriptions:
TrainTier er innført
core vs advanced workouts er aktivt i bibliotek og UI
biblioteket er tydeligere strukturert rundt standardøkter først
AI Coach er forenklet:
rapporten er bygd rundt primaryInsight + recommendedAction
deterministisk mapping til treningsanbefalinger er beholdt
Første halvdel av Steg 2 er levert:
delt web-only readiness-modell for setup finnes
LIVE viser en kompakt setup-checklist/banner når brukeren ikke er ready
PROFILE viser essentials først og benchmark references som sekundær seksjon
SETTINGS viser Device Setup øverst og flytter signal/debug til en kollapset advanced-seksjon
Verifisering akkurat nå:
npm run test:web passerer
npm run build:web passerer
npm run lint:web feiler fortsatt på eksisterende problemer i QuickMeasurePanel.tsx og warnings i ForceChart.tsx
Viktige Interfaces Og Status
Navigasjonen er fortsatt uendret:
PageId er fortsatt live | train | test | session | history | profile | settings
ingen HOME, ingen ME, ingen router ennå
Disse nye eller aktive strukturene skal nevnes eksplisitt i roadmapen:
TestTier brukes aktivt i testbiblioteket
TrainTier brukes aktivt i trainbiblioteket
AiCoachingReport er nå bygd rundt primaryInsight og recommendedAction
SetupReadinessState er en web-only helper for setup/status på tvers av LIVE, PROFILE og SETTINGS
Disse tingene finnes fortsatt ikke og skal markeres som ikke startet:
setupComplete
HOME
ME
klient-ruter
PWA/service worker
mobil bottom tabs
app store wrapper
Mangler Og Neste Faser
Fase A: Fullfør Steg 2 innen dagens baseline
polish setup-checklist og state-copy
gjennomgå first-run, returning-user, disconnected, checking, critical, MODE_RAW, MODE_KG_DIRECT, tare-required og total-force-only UX med manuell QA
rydde eventuelle gjenstående friksjoner mellom PROFILE og SETTINGS, men uten å slå dem sammen ennå
fikse eksisterende lint-problemer i live-komponentene så baseline er ren
Fase B: Lås v2 IA-beslutningen før ny frontpage
avgjør om HOME skal være supplement til LIVE eller ny default
avgjør om SESSION skal foldes inn i HISTORY
avgjør om PROFILE + SETTINGS senere skal bli ME, eller om separate sider beholdes
denne fasen skal være UX/IA-beslutning først, ikke implementasjon
Fase C: Ny frontpage og app shell, bare etter IA-beslutning
eventuelt HOME
eventuelt ME
eventuelt router
eventuelt PWA/mobile nav
dette behandles som egen leveranse, ikke som del av dagens baseline-opprydding
Fase D: Onboarding og appstore-klargjøring
vurder setupComplete eller wizard først når state-modellen er stabil og migrering er spesifisert
ta native/app store-sporet først etter at web-shell og IA er låst
Ikke Start Nå
Ikke gjør HOME til default ennå.
Ikke fjern SESSION fra nav ennå.
Ikke slå sammen PROFILE og SETTINGS til ME ennå.
Ikke legg til setupComplete ennå.
Ikke start router/PWA/mobile wrapper før Fase B er ferdig.
Ikke bland ny app-store-arkitektur inn i den samme leveransen som baseline UX-opprydding.
Testplan I Roadmapen
Dokumenter at disse er ferdige eller aktive:
automatiske tester for AI coaching, train tiering, live page og setup readiness
grønn test:web
grønn build:web
Dokumenter at disse fortsatt mangler eller må gjentas manuelt:
first-run-task test: connect -> quick check -> benchmark -> training
raw/kg mismatch recovery
tare/calibration recovery i MODE_RAW
verification checking og critical
Tindeq total-force-only sanity-check
lint-clean live-baseline
Assumptions
Målfil for denne roadmapen er docs/plans/gripsense-v2-status-roadmap.md.
Dokumentet skrives på norsk, men beholder kode-id-er og sidestruktur i eksisterende engelske navn.
bright-painting-fog.md beholdes som historikk og erstattes ikke.
Roadmapen skal beskrive faktisk status per nå, ikke love at HOME, ME eller appstore-sporet allerede er besluttet.