/**
 * Pre-generates watercolor SVG illustrations for all toys in toys.json
 * using the QuiverAI API and saves them to public/illustrations/{toy.id}.svg
 *
 * Usage: node scripts/generate-illustrations.js
 * Run from the wunder/ directory.
 *
 * Resumable: skips toys that already have a saved illustration.
 * Rate limit: QuiverAI allows 20 req/60s — we wait 3.5s between requests.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const TOYS_FILE    = path.join(__dirname, '../data/toys.json');
const OUTPUT_DIR   = path.join(__dirname, '../public/illustrations');
const API_URL      = 'https://api.quiver.ai/v1/svgs/generations';
const MODEL        = 'arrow-preview';
const DELAY_MS     = 3500; // stay well under 20 req/60s

const toys = JSON.parse(fs.readFileSync(TOYS_FILE, 'utf-8'));
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPrompt(toy) {
  return (
    `Flat paper-cut children's book illustration of ${toy.name}. ` +
    `${toy.description.replace(/\.$/, '')}. ` +
    `Layered flat shapes with subtle paper grain texture, bright teal and coral and warm yellow color palette, ` +
    `white background, cute rounded forms, soft drop shadow on each layer, ` +
    `children's picture book style, no text, no labels.`
  );
}

async function generateOne(toy) {
  const outPath = path.join(OUTPUT_DIR, `${toy.id}.svg`);

  if (fs.existsSync(outPath)) {
    console.log(`  ↩  [skip]  ${toy.id} — already exists`);
    return;
  }

  const prompt = buildPrompt(toy);

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.QUIVERAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, prompt, n: 1 }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} — ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const svg  = json.data?.[0]?.svg;

  if (!svg) throw new Error('No SVG in response');

  fs.writeFileSync(outPath, svg, 'utf-8');
  console.log(`  ✓  [saved] ${toy.id} — ${toy.name}`);
}

async function main() {
  if (!process.env.QUIVERAI_API_KEY) {
    console.error('Error: QUIVERAI_API_KEY not set in .env');
    process.exit(1);
  }

  console.log(`\nGenerating watercolor illustrations for ${toys.length} toys`);
  console.log(`Output → ${OUTPUT_DIR}\n`);

  let generated = 0;
  let skipped   = 0;
  let failed    = 0;

  for (let i = 0; i < toys.length; i++) {
    const toy = toys[i];
    process.stdout.write(`[${String(i + 1).padStart(2)}/${toys.length}] ${toy.name.padEnd(45)}`);

    try {
      const outPath = path.join(OUTPUT_DIR, `${toy.id}.svg`);
      const existed = fs.existsSync(outPath);
      await generateOne(toy);
      existed ? skipped++ : generated++;
    } catch (err) {
      console.log(`  ✗ FAILED: ${err.message}`);
      failed++;
    }

    if (i < toys.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n── Done ──────────────────────────────────`);
  console.log(`  Generated : ${generated}`);
  console.log(`  Skipped   : ${skipped} (already existed)`);
  console.log(`  Failed    : ${failed}`);
  console.log(`──────────────────────────────────────────\n`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
