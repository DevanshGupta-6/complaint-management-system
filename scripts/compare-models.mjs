// Run from the project root:
//   node --env-file=.env.local scripts/compare-models.mjs
//
// Worst case ~1 minute: every call is capped at 20 seconds.
import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const secs = (t) => ((Date.now() - t) / 1000).toFixed(1) + "s";

// 1) Network only: no model involved. A 404 or similar is fine, we only care how fast it answers.
{
  const t = Date.now();
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/", {
      signal: AbortSignal.timeout(15_000),
    });
    console.log(`network   : HTTP ${res.status} in ${secs(t)}`);
  } catch (err) {
    console.log(`network   : FAILED after ${secs(t)} -> ${err?.message ?? err}`);
  }
}

// 2) Same trivial prompt against three models
for (const model of ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash"]) {
  const t = Date.now();
  try {
    const i = await client.interactions.create(
      { model, input: "Reply with the single word: ok", store: false },
      { timeout: 20_000 }
    );
    const thought = i.usage?.total_thought_tokens ?? "?";
    console.log(`${model.padEnd(22)}: OK in ${secs(t)} (thought tokens: ${thought}) -> ${i.output_text}`);
  } catch (err) {
    console.log(`${model.padEnd(22)}: FAILED after ${secs(t)} -> ${err?.message ?? err}`);
  }
}
