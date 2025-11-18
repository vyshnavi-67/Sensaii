"use server";
import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { groq } from "@/lib/groq";

// 🔎 Simple topic classifier (no DB change, no AI needed here)
function inferTopicFromText(text = "") {
  const t = text.toLowerCase();

  if (
    t.includes("array") ||
    t.includes("linked list") ||
    t.includes("stack") ||
    t.includes("queue") ||
    t.includes("tree") ||
    t.includes("graph")
  ) {
    return "Data Structures";
  }

  if (
    t.includes("time complexity") ||
    t.includes("space complexity") ||
    t.includes("big o") ||
    t.includes("algorithm") ||
    t.includes("sorting") ||
    t.includes("searching")
  ) {
    return "Algorithms";
  }

  if (
    t.includes("database") ||
    t.includes("sql") ||
    t.includes("normalization") ||
    t.includes("join") ||
    t.includes("transaction") ||
    t.includes("index")
  ) {
    return "Databases / SQL";
  }

  if (
    t.includes("http") ||
    t.includes("rest") ||
    t.includes("api") ||
    t.includes("controller") ||
    t.includes("endpoint") ||
    t.includes("express") ||
    t.includes("django") ||
    t.includes("spring")
  ) {
    return "Backend / APIs";
  }

  if (
    t.includes("react") ||
    t.includes("component") ||
    t.includes("css") ||
    t.includes("html") ||
    t.includes("dom") ||
    t.includes("tailwind")
  ) {
    return "Frontend";
  }

  if (
    t.includes("thread") ||
    t.includes("process") ||
    t.includes("deadlock") ||
    t.includes("scheduling") ||
    t.includes("mutex")
  ) {
    return "Operating Systems";
  }

  if (
    t.includes("tcp") ||
    t.includes("udp") ||
    t.includes("routing") ||
    t.includes("ip") ||
    t.includes("osi")
  ) {
    return "Computer Networks";
  }

  if (
    t.includes("class") ||
    t.includes("object") ||
    t.includes("inheritance") ||
    t.includes("polymorphism") ||
    t.includes("encapsulation") ||
    t.includes("abstraction")
  ) {
    return "OOP";
  }

  return "General CS / Mixed";
}

// ----------------- GENERATE QUIZ -----------------

export async function generateQuiz() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: {
      clerkUserId: userId,
    },
  });
  if (!user) throw new Error("User not found");

  try {
    const prompt = `
Generate 5 technical interview questions for a ${
      user.industry
    } professional${
      user.skills?.length ? ` with expertise in ${user.skills.join(", ")}` : ""
    }.

Each question MUST be multiple choice with exactly 4 options.

Return ONLY JSON (no markdown, no extra text) with this shape:

{
  "questions":[
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": "string",
      "explanation": "string",
      "topic": "Data Structures | Algorithms | Databases / SQL | Backend / APIs | Frontend | Operating Systems | Computer Networks | OOP | General CS / Mixed",
      "difficulty": "Easy" | "Medium" | "Hard"
    }
  ]
}
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    let text = completion.choices[0].message.content;
    text = text.replace(/```json|```/g, "").trim();

    const quiz = JSON.parse(text);

    // 🔧 Normalize / fallback topic & difficulty (in case model misses them)
    const questions = (quiz.questions || []).map((q) => ({
      ...q,
      topic: q.topic || inferTopicFromText(q.question || ""),
      difficulty: q.difficulty || "Medium",
    }));

    return questions;
  } catch (err) {
    console.error("Groq Error", err);
    throw new Error("AI Failed");
  }
}

// ----------------- SAVE QUIZ RESULT -----------------

export async function saveQuizResult(questions, answers, score) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: {
      clerkUserId: userId,
    },
  });
  if (!user) throw new Error("User not found");

  // 🧩 Build detailed per-question result (JSON field, no schema change)
  const questionResults = questions.map((q, index) => {
    const topic = q.topic || inferTopicFromText(q.question || "");
    const difficulty = q.difficulty || "Medium";

    return {
      question: q.question,
      answer: q.correctAnswer,
      userAnswer: answers[index],
      isCorrect: q.correctAnswer === answers[index],
      explanation: q.explanation,
      topic,
      difficulty,
    };
  });

  const wrongAnswers = questionResults.filter((q) => !q.isCorrect);
  let improvementTip = null;

  if (wrongAnswers.length > 0) {
    const wrongQuestionsText = wrongAnswers
      .map(
        (q) =>
          `Question: "${q.question}"\nCorrect Answer: "${q.answer}"\nUser Answer: "${q.userAnswer}"`
      )
      .join("\n\n");

    const improvementPrompt = `
The user got the following ${user.industry} technical interview questions wrong:

${wrongQuestionsText}

Based on these mistakes, provide a concise, specific improvement tip.
Focus on the knowledge gaps revealed by these wrong answers.
Keep the response under 2 sentences and make it encouraging.
Don't explicitly list the mistakes; instead focus on what to learn/practice.
`;

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: improvementPrompt }],
        temperature: 0.2,
      });

      let text = completion.choices[0].message.content;
      improvementTip = text.trim();
    } catch (err) {
      console.error("Error generating improvement tip", err);
    }
  }

  try {
    const assessment = await db.assessment.create({
      data: {
        userId: user.id,
        quizScore: score,
        questions: questionResults, // JSON – now includes topic & difficulty
        category: "Technical",
        improvementTip,
      },
    });
    return assessment;
  } catch (error) {
    console.error("Error saving quiz result:", error);
    throw new Error("Failed to save quiz result");
  }
}

// ----------------- GET ASSESSMENTS -----------------

export async function getAssessments() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: {
      clerkUserId: userId,
    },
  });
  if (!user) throw new Error("User not found");

  try {
    const assessments = await db.assessment.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    return assessments;
  } catch (error) {
    console.error("Error fetching assessments:", error);
    throw new Error("Failed to fetch assessments");
  }
}
