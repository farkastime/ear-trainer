# Ear Trainer

A mobile-first PWA that teaches young children to identify chords by ear
(Eguchi Chord Identification Method), with characters, celebrations, and
configurable progression.

Design: `docs/superpowers/specs/2026-09-04-core-chord-trainer-design.md`

## Develop

    npm install
    npm run samples     # downloads instrument samples into public/samples/
    npm run dev

## Check

    npm run typecheck && npm run lint && npm test && npm run build
    npm run e2e         # needs: npx playwright install chromium

## Deploy

Static `dist/`. `amplify.yml` builds it on AWS Amplify Hosting; any static
host works.

## Layout

- `src/core` — framework-free content and session engine (pure functions, typed events)
- `src/state` — Zustand store, persistence, migrations, export/import
- `src/audio` — Tone.js sampler player, sample loading with fallback, unpitched SFX
- `src/celebrations` — canvas particle layer, heat colours, haptics
- `src/ui` — React screens and components
- `scripts/fetch-samples.ts` — downloads CC-BY samples listed in `src/core/content/instruments.ts`

## Amplify

Connect the repo; `amplify.yml` is picked up automatically. Add a rewrite
rule `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webmanifest|mp3)$)([^.]+$)/>` → `/index.html` (200)
if you later add client-side routes; the app currently has none.

## Licences

Code: MIT (see `LICENSE`). Audio samples: see `THIRD_PARTY_NOTICES.md`.
