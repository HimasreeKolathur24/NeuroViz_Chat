// frontend/services/geminiService.ts
const API = import.meta.env.VITE_BACKEND_URL;

export async function fetchGeminiResponse(prompt: string) {
  const res = await fetch(`${API}/api/gemini`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error("Invalid backend JSON:", text);
    throw new Error("Backend returned non-JSON");
  }
}

