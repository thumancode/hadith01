# Hadith Video (Playwright + FFmpeg)

`input/timestamps.txt` + `input/audio.mp3` -> animated Bengali caption video.

- Theme A = 1080x1920 (9:16), Theme B = 1920x1080 (16:9)
- Video ends 2 seconds after the audio ends (change with `--tail`)
- App icon: put your real icon at `assets/logo.png` to override the built-in `assets/icon.svg`
- App name / outro text: edit the `CONTENT` block at the top of `render.js`

## Run from phone (GitHub Actions)
Actions tab -> "Render Hadith Video" -> Run workflow -> choose A, B or both.
Download the mp4 from the run's Artifacts.

## Run locally
```
npm install
npx playwright install chromium
node render.js --theme A
```
Needs ffmpeg and Bengali fonts (fonts-noto-core).
