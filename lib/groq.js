// lib/groq.js
import Groq from "groq-sdk";

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// You can change the model here if needed
export const GROQ_MODEL = "llama-3.1-8b-instant";

