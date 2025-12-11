import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GeminiResponse } from "../types";

const SYSTEM_INSTRUCTION = `
You are the backend reasoning engine for "NeuroViz Chat" (a chatbot with an explainable 3D reasoning visualization).
For every user question, respond with only a single JSON object (no extra text) with this exact structure:

{
  "answer": "string",
  "explain_trace": {
    "stages": [
      {
        "id": "string",
        "label": "string",
        "description": "string",
        "weight": 0.0
      }
    ],
    "nodes": [
      {
        "id": "string",
        "label": "string",
        "type": "intent | fact | intermediate | conclusion | constraint | context",
        "importance": 0.0,
        "stage_id": "string"
      }
    ],
    "edges": [
      {
        "source": "string",
        "target": "string",
        "relation_label": "string",
        "strength": 0.0
      }
    ],
    "steps": [
      "Short textual step 1",
      "Short textual step 2"
    ],
    "key_factors": [
      "Short phrase about key fact or assumption"
    ],
    "confidence": "high | medium | low",
    "timestamp": "ISO 8601 timestamp string"
  }
}

Requirements:
- "answer" must be a clear, helpful answer in 2–6 sentences.
- stages must describe high-level reasoning phases, e.g., "Comprehension", "Retrieval", "Synthesis", "Formulation".
- nodes represent concepts, facts, assumptions, or intermediate conclusions.
- importance is a number between 0 and 1.
- stage_id must reference one of the stages.
- edges represent relationships or influence between nodes.
- strength is a number between 0 and 1.
- steps is a human-readable ordered list describing the reasoning steps.
- key_factors list the main facts/assumptions/basis used to form the answer.
- confidence should reflect how certain you are.
- Always return valid JSON. Do not include any explanations outside the JSON.
`;

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    explain_trace: {
      type: Type.OBJECT,
      properties: {
        stages: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              description: { type: Type.STRING },
              weight: { type: Type.NUMBER },
            },
            required: ["id", "label", "description"],
          },
        },
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              type: {
                type: Type.STRING,
                enum: [
                  "intent",
                  "fact",
                  "intermediate",
                  "conclusion",
                  "constraint",
                  "context",
                ],
              },
              importance: { type: Type.NUMBER },
              stage_id: { type: Type.STRING },
            },
            required: ["id", "label", "type", "stage_id"],
          },
        },
        edges: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              source: { type: Type.STRING },
              target: { type: Type.STRING },
              relation_label: { type: Type.STRING },
              strength: { type: Type.NUMBER },
            },
            required: ["source", "target"],
          },
        },
        steps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        key_factors: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        confidence: {
          type: Type.STRING,
          enum: ["high", "medium", "low"],
        },
        timestamp: { type: Type.STRING },
      },
      required: ["stages", "nodes", "edges", "steps", "confidence"],
    },
  },
  required: ["answer", "explain_trace"],
};

export const fetchGeminiResponse = async (
  prompt: string
): Promise<GeminiResponse> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    // Parse JSON. The model usually returns raw JSON, but sometimes wraps in markdown block.
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json/, "").replace(/```$/, "");
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```/, "").replace(/```$/, "");
    }

    const parsed = JSON.parse(cleanText) as GeminiResponse;

    // Defensive check to ensure arrays exist
    if (parsed && parsed.explain_trace) {
        parsed.explain_trace.nodes = parsed.explain_trace.nodes || [];
        parsed.explain_trace.edges = parsed.explain_trace.edges || [];
        parsed.explain_trace.stages = parsed.explain_trace.stages || [];
        parsed.explain_trace.steps = parsed.explain_trace.steps || [];
        parsed.explain_trace.key_factors = parsed.explain_trace.key_factors || [];
    } else {
        // Fallback for completely malformed response structure
        return {
             answer: parsed.answer || "Error processing reasoning data.",
             explain_trace: {
                 stages: [], nodes: [], edges: [], steps: [], key_factors: [], confidence: 'low', timestamp: new Date().toISOString()
             }
        };
    }
    
    return parsed;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};