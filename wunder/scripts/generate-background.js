/**
 * Generates a single background SVG for the main content area
 * (below the hero, from "About your child" to the bottom).
 * Saves to public/illustrations/background.svg
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../public/illustrations/background.svg');

const prompt =
  'Flat paper-cut children\'s book background scene. ' +
  'A wide, airy landscape scattered with small whimsical toy illustrations: ' +
  'colorful stacking blocks, a tiny crayon, a little star, a rainbow arc, ' +
  'a small wooden duck, a round ball, a pinwheel, a few soft cloud shapes, ' +
  'and delicate hand-drawn dot confetti. ' +
  'Bright teal, warm coral, sunny yellow, and sage green on a clean white background. ' +
  'Plenty of empty white space so content placed on top remains readable. ' +
  'Wide horizontal composition, paper grain texture overlay, no text, no labels.';

async function main() {
  if (!process.env.QUIVERAI_API_KEY) {
    console.error('QUIVERAI_API_KEY not set'); process.exit(1);
  }

  console.log('Generating background SVG via QuiverAI…');

  const res = await fetch('https://api.quiver.ai/v1/svgs/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.QUIVERAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'arrow-preview', prompt, n: 1 }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`QuiverAI error ${res.status}:`, body.slice(0, 300));
    process.exit(1);
  }

  const json = await res.json();
  const svg  = json.data?.[0]?.svg;
  if (!svg) { console.error('No SVG in response'); process.exit(1); }

  fs.writeFileSync(OUT, svg, 'utf-8');
  console.log(`✓ Saved → ${OUT}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
