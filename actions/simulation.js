"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { groq, GROQ_MODEL } from "@/lib/groq";

//  START SIMULATION
export async function startSimulation({ role, scenario }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");

  const initialSystem = `
You are an AI hiring manager running a practical job simulation for the role: ${role}.
Scenario: ${scenario}

Rules:
- Ask the candidate *one task at a time*.
- Tasks should be realistic and short.
- After each answer, give brief feedback and a follow-up task.
- After ~5 exchanges, say "Type /finish to end and get feedback."
- Do not output JSON.
`;

  const sim = await db.simulation.create({
    data: {
      userId: user.id,
      role,
      scenario,
      messages: [{ role: "system", content: initialSystem }],
    },
  });

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: initialSystem },
      { role: "user", content: "Start the simulation." },
    ],
    temperature: 0.3,
  });

  const assistantMsg =
    completion.choices?.[0]?.message?.content ?? "Let's begin.";
  const updated = await db.simulation.update({
    where: { id: sim.id },
    data: {
      messages: {
        set: [
          { role: "system", content: initialSystem },
          { role: "user", content: "Start the simulation." },
          { role: "assistant", content: assistantMsg },
        ],
      },
    },
  });

  return { success: true, simulation: updated };
}

//  SEND SIMULATION MESSAGE
export async function sendSimulationMessage({ simulationId, message }) {
  try {
    const sim = await db.simulation.findUnique({
      where: { id: simulationId },
    });
    if (!sim) throw new Error("Simulation not found");

    let history = [];
    if (Array.isArray(sim.messages)) {
      history = sim.messages;
    } else if (typeof sim.messages === "string") {
      try {
        history = JSON.parse(sim.messages);
      } catch {
        history = [];
      }
    } else if (typeof sim.messages === "object" && sim.messages !== null) {
      history = Object.values(sim.messages);
    }

    // Ensure valid message format
    history = history.filter(
      (m) => m && typeof m === "object" && "role" in m && "content" in m
    );

    const messages = [
      ...history,
      { role: "user", content: message || "No message provided" },
    ];

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: messages.map((m) => ({
        role: m.role || "user",
        content: String(m.content || ""),
      })),
      temperature: 0.7,
    });

    const reply =
      completion.choices?.[0]?.message?.content || "No AI reply generated.";

    const updatedMessages = [...messages, { role: "assistant", content: reply }];

    const updated = await db.simulation.update({
      where: { id: simulationId },
      data: { messages: updatedMessages },
    });

    console.log(" AI replied successfully:", reply);

    //  Plain object back to client
    return {
      simulation: updated,
      reply: reply || null,
    };
  } catch (err) {
    console.error(" Error in sendSimulationMessage:", err);
    return { error: err.message };
  }
}

//  FINISH SIMULATION — adds 4 new research-based features (no DB schema changes)
export async function finishSimulation({ simulationId }) {
  try {
    const simulation = await db.simulation.findUnique({
      where: { id: simulationId },
    });
    if (!simulation) throw new Error("Simulation not found");

    const history = Array.isArray(simulation.messages)
      ? simulation.messages
      : [];

    const prompt = `
You are a job interview evaluator for a practical job simulation.

The conversation between interviewer (assistant) and candidate (user) is:

${JSON.stringify(history, null, 2)}

Analyse the candidate's performance.

Return feedback in STRICT JSON (no markdown, no explanation, no extra text).
Shape:

{
  "performanceScore": number,           // 0-100 overall
  "candidateLevel": "Beginner" | "Intermediate" | "Advanced" | "Job-ready",

  "summary": "2-3 sentence plain-language summary",

  "dimensions": [
    { "name": "Technical Depth", "score": number, "comment": "short explanation" },
    { "name": "Communication", "score": number, "comment": "..." },
    { "name": "Problem Solving", "score": number, "comment": "..." },
    { "name": "Practicality / Code Quality", "score": number, "comment": "..." }
  ],

  "strengths": ["bullet point strength"],
  "weaknesses": ["bullet point weakness"],
  "improvementTips": ["actionable tip"],

  "keyMoments": [
    {
      "turnIndex": number,   // index in the conversation array above
      "label": "short label of what happened",
      "effect": "positive" | "negative" | "neutral"
    }
  ],

  "nextPracticeScenarios": ["short scenario prompt the user can try next"],
  "nextConceptsToStudy": ["topic or concept to revise next"]
}
`;

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    let text = completion.choices?.[0]?.message?.content ?? "{}";
    text = text.replace(/```json|```/g, "").trim();

    //  safer JSON extraction: grab the first {...} block
    let data;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      const jsonString = match ? match[0] : "{}";
      data = JSON.parse(jsonString);
    } catch (e) {
      console.error("⚠️ JSON parse failed, using fallback:", e, "\nRaw:", text);
      data = {
        performanceScore: 60,
        candidateLevel: "Beginner",
        summary: "You showed some understanding but need more depth and structure.",
        dimensions: [
          { name: "Technical Depth", score: 55, comment: "Basic ideas but missing details." },
          { name: "Communication", score: 70, comment: "Clear but can be more concise." },
          { name: "Problem Solving", score: 60, comment: "Reasonable approach but not very systematic." },
          { name: "Practicality / Code Quality", score: 50, comment: "Implementation details were light." },
        ],
        strengths: ["Good overall communication", "You attempted a structured approach"],
        weaknesses: ["Lack of concrete implementation details", "Edge cases not fully considered"],
        improvementTips: [
          "Practise explaining solutions with concrete steps and examples",
          "Explicitly mention edge cases and testing strategy"
        ],
        keyMoments: [],
        nextPracticeScenarios: [],
        nextConceptsToStudy: [],
      };
    }

    // ✅ Update only DB fields we actually have
    const updated = await db.simulation.update({
      where: { id: simulationId },
      data: {
        performanceScore: data.performanceScore ?? 60,
        strengths: Array.isArray(data.strengths) ? data.strengths : [],
        weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
        improvementTips: Array.isArray(data.improvementTips)
          ? data.improvementTips
          : [],
      },
    });

    console.log("✅ Simulation finished and DB updated:", updated);

    // 🧠 Enrich with extra fields (NOT stored in DB, only returned)
    const enrichedSimulation = {
      ...updated,
      summary: data.summary || null,
      candidateLevel: data.candidateLevel || null,
      dimensions: Array.isArray(data.dimensions) ? data.dimensions : [],
      keyMoments: Array.isArray(data.keyMoments) ? data.keyMoments : [],
      nextPracticeScenarios: Array.isArray(data.nextPracticeScenarios)
        ? data.nextPracticeScenarios
        : [],
      nextConceptsToStudy: Array.isArray(data.nextConceptsToStudy)
        ? data.nextConceptsToStudy
        : [],
    };

    return { simulation: enrichedSimulation };
  } catch (err) {
    console.error(" Error in finishSimulation:", err);
    return { error: err.message };
  }
}
