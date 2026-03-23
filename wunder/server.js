require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// Load toy catalog at startup
const toysRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/toys.json'), 'utf-8'));

// Attach illustrationUrl for any pre-generated SVG that exists on disk
const ILLUSTRATIONS_DIR = path.join(__dirname, 'public/illustrations');
const toys = toysRaw.map(toy => {
  const svgPath = path.join(ILLUSTRATIONS_DIR, `${toy.id}.svg`);
  return fs.existsSync(svgPath)
    ? { ...toy, illustrationUrl: `/illustrations/${toy.id}.svg` }
    : toy;
});

const illustrationCount = toys.filter(t => t.illustrationUrl).length;
console.log(`Loaded ${toys.length} toys (${illustrationCount} with illustrations)`);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── In-memory rate limiting (10 req/IP/min) ──────────────────────────────────
const rateLimitMap = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 10;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  const timestamps = rateLimitMap.get(ip).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  next();
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── GET /api/toys ─────────────────────────────────────────────────────────────
app.get('/api/toys', (req, res) => {
  res.json(toys);
});

// ── POST /api/recommend ───────────────────────────────────────────────────────
app.post('/api/recommend', rateLimit, async (req, res) => {
  const { age, gender, interests = [], budget = {}, description = '' } = req.body;

  // Validate inputs
  if (age === undefined || age === null || age < 0 || age > 5) {
    return res.status(400).json({ error: 'Age must be between 0 and 5.' });
  }
  const validGenders = ['all', 'girl', 'boy'];
  if (gender && !validGenders.includes(gender)) {
    return res.status(400).json({ error: 'Invalid gender value.' });
  }
  const validCategories = ['Educational', 'Creative', 'Outdoor', 'Building', 'Pretend Play', 'Tech', 'Games'];
  for (const interest of interests) {
    if (!validCategories.includes(interest)) {
      return res.status(400).json({ error: `Invalid interest: ${interest}` });
    }
  }
  const truncatedDescription = description.slice(0, 500);

  // Pre-filter catalog server-side to reduce token usage
  const budgetMin = budget.min ?? 0;
  const budgetMax = budget.max ?? 9999;
  const ageBuffer = 1;

  let filtered = toys.filter(toy => {
    const ageMatch = toy.ageMin <= age + ageBuffer && toy.ageMax >= age - ageBuffer;
    const budgetMatch = toy.price >= budgetMin && toy.price <= budgetMax;
    const genderMatch = !gender || gender === 'all' || toy.gender === 'all' || toy.gender === gender;
    return ageMatch && budgetMatch && genderMatch;
  });

  // Prioritize selected interest categories if provided
  if (interests.length > 0) {
    const prioritized = filtered.filter(t => interests.includes(t.category));
    const rest = filtered.filter(t => !interests.includes(t.category));
    filtered = [...prioritized, ...rest].slice(0, 20);
  } else {
    filtered = filtered.slice(0, 20);
  }

  // Fallback if filter is too aggressive
  if (filtered.length < 5) {
    filtered = toys
      .filter(t => t.ageMin <= age + 1 && t.ageMax >= age - 1)
      .slice(0, 15);
  }

  // Try Claude API
  try {
    const systemPrompt = `You are Wunder, a warm and knowledgeable toy recommendation expert grounded in child development research. Your recommendations are informed by developmental frameworks from Lovevery and NAEYC research.

DEVELOPMENTAL FRAMEWORK:
| Skill Area | Description | Peak Ages |
|---|---|---|
| sensory | Sight, sound, touch, texture exploration | 0–2 |
| fine_motor | Pincer grip, stacking, threading, drawing | 0–5 |
| gross_motor | Balance, coordination, strength | 1–5 |
| cognitive | Problem-solving, sorting, matching, patterns | 1–5 |
| language | Communication, vocabulary, storytelling | 1–5 |
| pretend | Role-play, imaginative make-believe | 2–5 |
| social | Turn-taking, sharing, cooperation | 3–5 |
| independence | Sustained attention, self-directed play | 3–5 |

YOUR TASK:
1. Select 8–12 toys from the provided catalog that best match this child's profile
2. Rank them by developmental fit and alignment with the child's interests and age
3. Write a short, warm, personalized blurb (2–3 sentences) for each toy that references SPECIFIC developmental benefits — not generic praise
   - Good: "Builds the pincer grip your 2-year-old is actively developing right now, and the satisfying click of each piece teaches cause-and-effect."
   - Bad: "This is a great toy that your child will love!"
4. Write a brief intro (1–2 sentences) that feels personal to this child's profile
5. Score each toy 1–10 based on fit

IMPORTANT: Respond with ONLY valid JSON. No markdown, no explanation, no code fences — just raw JSON.

Response format:
{
  "intro": "...",
  "recommendations": [
    { "id": "toy-id", "score": 9, "blurb": "..." },
    ...
  ]
}`;

    const childProfile = {
      age,
      gender: gender || 'all',
      interests,
      budget: { min: budgetMin, max: budgetMax === 9999 ? 'no limit' : budgetMax },
      description: truncatedDescription || '(not provided)'
    };

    const userMessage = `CHILD PROFILE:
${JSON.stringify(childProfile, null, 2)}

AVAILABLE TOYS (pre-filtered for this child):
${JSON.stringify(filtered.map(t => ({
  id: t.id,
  name: t.name,
  category: t.category,
  ageMin: t.ageMin,
  ageMax: t.ageMax,
  price: t.price,
  skills: t.skills,
  description: t.description,
  tags: t.tags
})), null, 2)}

Please select the best 8–12 toys for this child and respond with JSON only.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });

    const rawText = message.content[0].text;
    let aiResult;

    // Safe JSON parse with regex fallback
    try {
      aiResult = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse Claude response as JSON');
      }
    }

    // Enrich with full toy data
    const enriched = aiResult.recommendations
      .map(rec => {
        const toy = toys.find(t => t.id === rec.id);
        if (!toy) return null;
        return { ...toy, blurb: rec.blurb, score: rec.score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return res.json({ intro: aiResult.intro, recommendations: enriched });

  } catch (err) {
    console.error('Claude API error, falling back to algorithmic ranking:', err.message);

    // Algorithmic fallback
    const ranked = filtered
      .map(toy => {
        let score = 0;
        // Age proximity score
        const ageDiff = Math.max(0, toy.ageMin - age, age - toy.ageMax);
        score += Math.max(0, 5 - ageDiff * 2);
        // Interest match
        if (interests.includes(toy.category)) score += 4;
        // Budget fit
        if (toy.price <= budgetMax && toy.price >= budgetMin) score += 1;
        return { ...toy, score: Math.min(10, score), blurb: toy.description };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return res.json({
      intro: `Here are some great toy picks for your ${age}-year-old!`,
      recommendations: ranked
    });
  }
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Wunder server running at http://localhost:${PORT}`);
});
