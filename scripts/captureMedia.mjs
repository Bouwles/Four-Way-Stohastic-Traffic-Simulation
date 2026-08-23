import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';

const { GIFEncoder, applyPalette, quantize } = gifenc;

const BASE_URL = process.env.CAPTURE_URL
  ?? 'http://127.0.0.1:5173/Four-Way-Stohastic-Traffic-Simulation/';
const OUT_DIR = 'docs/media';

async function screenshot(page, name, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT_DIR}/${name}`, fullPage: true });
}

async function replayGif(page) {
  await page.setViewportSize({ width: 1000, height: 620 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Run Simulation/i }).click();
  await page.waitForTimeout(800);

  const box = await page.locator('.canvas-wrapper').boundingBox();
  const clip = {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(Math.min(box.height, 430)),
  };

  const gif = GIFEncoder();
  for (let i = 0; i < 12; i += 1) {
    const buffer = await page.screenshot({ clip });
    const png = PNG.sync.read(buffer);
    const rgba = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength);
    const palette = quantize(rgba, 256);
    const indexed = applyPalette(rgba, palette);
    gif.writeFrame(indexed, png.width, png.height, { palette, delay: 140 });
    await page.waitForTimeout(240);
  }

  gif.finish();
  await writeFile(`${OUT_DIR}/simulation-replay.gif`, Buffer.from(gif.bytes()));
}

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await screenshot(page, 'simulation-live-desktop.png', { width: 1440, height: 1000 });
  await screenshot(page, 'simulation-live-mobile.png', { width: 390, height: 1200 });
  await replayGif(page);
} finally {
  await browser.close();
}
