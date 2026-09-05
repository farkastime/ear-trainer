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
