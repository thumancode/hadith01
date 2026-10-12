// Usage: node render.js --theme A|B [--fps 30] [--tail 2] [--out output/video_A.mp4]
// A = 1080x1920 (9:16), B = 1920x1080 (16:9)
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};

const THEME = (arg('theme', 'A') || 'A').toUpperCase() === 'B' ? 'B' : 'A';
const FPS = parseInt(arg('fps', '30'), 10);
const TAIL = parseFloat(arg('tail', '2')); // seconds after audio ends
const SIZE = THEME === 'A' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
const ROOT = __dirname;
const AUDIO = path.join(ROOT, 'input', 'audio.mp3');
const TS = path.join(ROOT, 'input', 'timestamps.txt');
const OUT = path.resolve(ROOT, arg('out', `output/video_${THEME}.mp4`));

// ---------- text content (edit here) ----------
const CONTENT = {
  appName: 'ইসলামী বিশ্বকোষ ও আল হাদিস S2',
  tag: 'আজকের হাদিস',
  outroSub: 'কুরআন · তাফসির · ৪৫টি হাদিস গ্রন্থ · ইসলামী বই',
  outroBtn: 'এখনই ডাউনলোড করুন',
};

function parseTimestamps(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const p = l.split('|').map((x) => x.trim());
      return { start: parseFloat(p[0]), end: parseFloat(p[1]), text: p[2] || '', mood: (p[3] || '').toLowerCase() };
    })
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.text);
}

function audioDuration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim();
  return parseFloat(out);
}

(async () => {
  if (!fs.existsSync(AUDIO)) throw new Error('input/audio.mp3 not found');
  if (!fs.existsSync(TS)) throw new Error('input/timestamps.txt not found');

  const segments = parseTimestamps(TS);
  const audioDur = audioDuration(AUDIO);
  const total = audioDur + TAIL;
  const frames = Math.ceil(total * FPS);

  // logo: assets/logo.png (your real app icon) wins, else the built-in icon.svg
  const logoRel = fs.existsSync(path.join(ROOT, 'assets', 'logo.png')) ? 'assets/logo.png' : 'assets/icon.svg';

  console.log(`Theme ${THEME} ${SIZE.width}x${SIZE.height} | audio ${audioDur.toFixed(2)}s + tail ${TAIL}s = ${total.toFixed(2)}s | ${frames} frames @ ${FPS}fps | logo ${logoRel}`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.evaluate((cfg) => window.init(cfg), {
    ...CONTENT,
    theme: THEME,
    logo: logoRel,
    segments,
    audioDuration: audioDur,
  });

  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-vcodec', 'mjpeg', '-i', '-',
    '-i', AUDIO,
    '-map', '0:v', '-map', '1:a',
    '-af', 'apad',
    '-t', total.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const done = new Promise((resolve, reject) => {
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exited with ' + code))));
    ff.on('error', reject);
  });

  for (let i = 0; i < frames; i++) {
    const t = i / FPS;
    await page.evaluate((tt) => window.seek(tt), t);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % FPS === 0) process.stdout.write(`\r  ${(100 * i / frames).toFixed(0)}%`);
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log(`\nDone -> ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
