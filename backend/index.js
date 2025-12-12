// backend/index.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Helper: default explain_trace (safe fallback)
function defaultExplainTrace() {
  return {
    stages: [],
    nodes: [],
    edges: [],
    steps: [],
    key_factors: [],
    confidence: "low",
    timestamp: new Date().toISOString()
  };
}

// Heuristic model chooser
function chooseModelFromList(listJson) {
  if (!Array.isArray(listJson.models)) return null;
  for (const m of listJson.models) {
    const name = m.name || m.id || m.model || (typeof m === "string" ? m : null);
    const supported = m.supportedMethods || m.methods || m.features || m.abilities || m.capabilities || null;
    if (supported && Array.isArray(supported)) {
      if (supported.includes("generateContent") || supported.includes("generate")) return name;
    }
    if (typeof name === "string") {
      const lowers = name.toLowerCase();
      if (lowers.includes("gemini-") && (lowers.includes("flash") || lowers.includes("pro") || lowers.includes("2.5") || lowers.includes("1.5"))) {
        return name;
      }
    }
  }
  // fallback: first model name
  const first = listJson.models[0];
  if (!first) return null;
  return first.name || first.id || first.model || first;
}

// System instruction forcing JSON structure for explain_trace
const SYSTEM_INSTRUCTION = `
You are NeuroViz reasoning engine. For every user prompt, respond with ONLY a single VALID JSON object (no text outside JSON).
The JSON must have this exact structure:

{
  "answer": "string (2-6 sentences)",
  "explain_trace": {
    "stages": [ { "id":"", "label":"", "description":"", "weight":0.0 } ],
    "nodes": [ { "id":"", "label":"", "type":"intent|fact|intermediate|conclusion|constraint|context", "importance":0.0, "stage_id":"" } ],
    "edges": [ { "source":"", "target":"", "relation_label":"", "strength":0.0 } ],
    "steps": ["short textual step 1", "short textual step 2"],
    "key_factors": ["key fact or assumption"],
    "confidence": "high|medium|low",
    "timestamp": "ISO 8601 string"
  }
}

Requirements:
- Return only the JSON object (no markdown fences, no explanation).
- "answer" should be concise and helpful.
- Ensure numeric fields are numbers and arrays exist even if empty.
`;

app.get("/", (req, res) => res.send("NeuroViz backend live"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString(), pid: process.pid });
});

app.post("/api/gemini", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });

    // 1) List available models for this key
    const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listText = await listResp.text();
    let listJson;
    try {
      listJson = JSON.parse(listText);
    } catch (e) {
      // fallback: return the raw text error
      console.error("[ListModels] parse error:", listText.slice(0, 1000));
      return res.status(502).json({ error: "Failed to parse ListModels response", details: listText.slice(0, 1000) });
    }

    const chosen = chooseModelFromList(listJson);
    let chosenModelName = chosen;
    if (!chosenModelName) {
      console.error("[API] No suitable model from ListModels:", JSON.stringify(listJson, null, 2));
      return res.status(500).json({ error: "No suitable model found. Check ListModels in logs." });
    }
    // remove "models/" prefix if present
    if (typeof chosenModelName === "string" && chosenModelName.startsWith("models/")) {
      chosenModelName = chosenModelName.replace("models/", "");
    }

    // 2) Build prompt with system instruction + user prompt
    const body = {
      contents: [
        { parts: [{ text: SYSTEM_INSTRUCTION }] },
        { parts: [{ text: prompt }] }
      ]
    };

    const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${chosenModelName}:generateContent?key=${apiKey}`;
    const gRes = await fetch(generateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const gText = await gRes.text();
    let gJson;
    try {
      gJson = JSON.parse(gText);
    } catch (e) {
      // Sometimes API returns JSON-like object; try to parse via reading candidates content if present
      try {
        // try parse from candidates -> content -> text
        const tmp = JSON.parse(gText);
        gJson = tmp;
      } catch (err) {
        // In case of non-JSON reply, log and fallback
        console.error("[generateContent] non-JSON response:", gText.slice(0, 2000));
        return res.status(502).json({ error: "Non-JSON response from generateContent", details: gText.slice(0, 2000) });
      }
    }

    if (gJson.error) {
      console.error("[generateContent] API error:", JSON.stringify(gJson.error));
      return res.status(502).json({ error: gJson.error });
    }

    // 3) Extract model text output (common shapes)
    let rawText = "";
    // candidate style
    if (gJson.candidates && gJson.candidates[0]) {
      const c = gJson.candidates[0];
      // many shapes: c.content may be array of parts or object
      if (c.content) {
        if (Array.isArray(c.content)) {
          // each part might be { text: "..." } or string
          rawText = c.content.map(p => (p && p.text) ? p.text : (typeof p === "string" ? p : JSON.stringify(p))).join("");
        } else if (typeof c.content === "object") {
          // sometimes content.parts
          if (Array.isArray(c.content.parts)) {
            rawText = c.content.parts.map(p => p.text || "").join("");
          } else if (c.content.text) {
            rawText = c.content.text;
          } else {
            rawText = JSON.stringify(c.content);
          }
        } else if (typeof c.content === "string") {
          rawText = c.content;
        }
      } else if (c.text) {
        rawText = c.text;
      } else if (typeof c === "string") {
        rawText = c;
      }
    }
    // fallback: gJson.output style
    if (!rawText && gJson.output && Array.isArray(gJson.output) && gJson.output[0] && gJson.output[0].content) {
      rawText = gJson.output[0].content.map(p => p.text || "").join("");
    }
    // fallback: direct text
    if (!rawText && typeof gJson.text === "string") rawText = gJson.text;
    if (!rawText) rawText = JSON.stringify(gJson).slice(0, 2000);

    // Remove common markdown fences
    rawText = rawText.replace(/^```json\s*/, "").replace(/```$/, "").trim();

    // 4) Try parse JSON from model output
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      // If parsing fails, return an answer + safe explain_trace fallback
      const answer = rawText || "Model returned empty response";
      return res.json({
        answer,
        explain_trace: defaultExplainTrace()
      });
    }

    // Ensure explain_trace exists and has required arrays
    if (!parsed.explain_trace) parsed.explain_trace = defaultExplainTrace();
    parsed.explain_trace.stages = parsed.explain_trace.stages || [];
    parsed.explain_trace.nodes = parsed.explain_trace.nodes || [];
    parsed.explain_trace.edges = parsed.explain_trace.edges || [];
    parsed.explain_trace.steps = parsed.explain_trace.steps || [];
    parsed.explain_trace.key_factors = parsed.explain_trace.key_factors || [];
    parsed.explain_trace.confidence = parsed.explain_trace.confidence || "low";
    parsed.explain_trace.timestamp = parsed.explain_trace.timestamp || new Date().toISOString();

    // 5) Return parsed JSON which contains answer + explain_trace
    return res.json(parsed);

  } catch (err) {
    console.error("[/api/gemini] error:", err && (err.stack || err));
    return res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT} (pid ${process.pid})`));
