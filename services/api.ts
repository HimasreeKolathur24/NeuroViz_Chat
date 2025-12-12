// frontend/services/api.ts
import { fetchGeminiResponse } from "./geminiService";

export async function sendMessage(prompt: string) {
  return await fetchGeminiResponse(prompt);
}
