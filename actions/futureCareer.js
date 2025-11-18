"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { groq, GROQ_MODEL } from "@/lib/groq";

/* ------------------------------------------------------------------
   Small helper functions (no DB impact)
-------------------------------------------------------------------*/

function inferCareerLevel(experienceYears = 0) {
  const xp = Math.max(0, Number(experienceYears) || 0);

  if (xp <= 0) return "Student / Fresher";
  if (xp <= 2) return "Entry Level";
  if (xp <= 5) return "Intermediate";
  if (xp <= 10) return "Senior";
  return "Expert";
}

function estimateSalaryRangeIndia(experienceYears = 0) {
  const xp = Math.max(0, Number(experienceYears) || 0);

  if (xp <= 0) return "₹3,00,000 – ₹5,00,000 per annum";
  if (xp <= 2) return "₹4,00,000 – ₹8,00,000 per annum";
  if (xp <= 5) return "₹6,00,000 – ₹14,00,000 per annum";
  if (xp <= 10) return "₹10,00,000 – ₹22,00,000 per annum";
  return "₹20,00,000+ per annum";
}

function inferDemandLabel(text = "") {
  const t = (text || "").toLowerCase();

  const highKeywords = [
    "ai",
    "ml",
    "machine learning",
    "data",
    "cloud",
    "full stack",
    "devops",
    "cyber",
  ];
  const mediumKeywords = [
    "frontend",
    "backend",
    "android",
    "web",
    "testing",
    "qa",
  ];

  if (highKeywords.some((k) => t.includes(k))) return "High";
  if (mediumKeywords.some((k) => t.includes(k))) return "Medium";
  return "Low";
}

function inferApproxJobCount(demandLabel) {
  switch (demandLabel) {
    case "High":
      return 4000; // rough pseudo “real-time” job count
    case "Medium":
      return 1500;
    case "Low":
      return 300;
    default:
      return 1000;
  }
}

function buildFitSummary({ title, experience, interests, skills }) {
  const xp = Math.max(0, Number(experience) || 0);

  const xpText =
    xp <= 0
      ? "as a beginner"
      : xp <= 2
      ? `with about ${xp} year(s) of experience`
      : `with ${xp}+ years of experience`;

  return (
    `“${title || "This role"}” looks like a good match for you ` +
    `${xpText}, especially considering your interests (${interests || "not specified"}) ` +
    `and skills (${skills || "not specified"}).`
  );
}

/* ------------------------------------------------------------------
   MAIN ACTION: generateFutureCareer
-------------------------------------------------------------------*/

export async function generateFutureCareer(data) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });
  if (!user) throw new Error("User not found");

  const { experience, interests, skills, preferredRoles } = data;
  const expYears = Math.max(0, Number(experience || 0));

  try {
    const prompt = `
You are a professional AI career guidance assistant. 
Your goal is to recommend a realistic, personalized future career path.

Use the details below:
- Experience: ${expYears} years
- Interests: ${interests || "Not specified"}
- Skills: ${skills || "Not specified"}
- Preferred Roles: ${preferredRoles || "Not specified"}

Return ONLY valid JSON (no explanation, no markdown, no extra text).
Strict format:

{
  "title": "string",
  "description": "string",
  "neededSkills": ["skill1", "skill2"],
  "learningPath": ["step1", "step2"],
  "marketFit": 1-10,

  // optional, but fill if you can:
  "fitSummary": "1–2 sentence explanation of why this role fits the user",
  "careerLevel": "Student / Fresher | Entry Level | Intermediate | Senior | Expert",
  "salaryRange": "string like '₹ X – ₹ Y per annum'",
  "demandLabel": "High | Medium | Low",
  "approxJobCount": 1234
}
`;

    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    let career;

    try {
      // Take the first JSON-like block (lazy so it doesn't swallow extra text)
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : "{}";
      career = JSON.parse(jsonString);
    } catch (err) {
      console.error("❌ Groq JSON parsing failed:", err, "\nRaw output:", raw);
      career = {
        title: "AI Career Advisor",
        description: "Default suggestion due to invalid AI output format.",
        neededSkills: ["Problem Solving", "Communication"],
        learningPath: ["Review prompt formatting", "Improve AI parsing"],
        marketFit: 5,
      };
    }

    // ---------- Enrich with smart defaults (not all stored in DB) ----------
    const demandTextSource = `${career.title || ""} ${career.description || ""} ${
      skills || ""
    } ${preferredRoles || ""}`;

    const demandLabel =
      career.demandLabel || inferDemandLabel(demandTextSource);
    const jobCount =
      typeof career.approxJobCount === "number"
        ? career.approxJobCount
        : inferApproxJobCount(demandLabel);

    const enriched = {
      title: career.title || "Future Career Suggestion",
      description: career.description || "No description provided.",
      neededSkills: Array.isArray(career.neededSkills)
        ? career.neededSkills
        : [],
      learningPath: Array.isArray(career.learningPath)
        ? career.learningPath
        : [],
      marketFit:
        typeof career.marketFit === "number" && !Number.isNaN(career.marketFit)
          ? career.marketFit
          : 5,

      // extra, not persisted:
      fitSummary:
        career.fitSummary ||
        buildFitSummary({
          title: career.title,
          experience: expYears,
          interests,
          skills,
        }),
      careerLevel: career.careerLevel || inferCareerLevel(expYears),
      salaryRange: career.salaryRange || estimateSalaryRangeIndia(expYears),
      demandLabel,
      approxJobCount: jobCount,
    };

    console.log("🔍 Parsed & enriched AI Career:", enriched);

    // ✅ Save ONLY the fields that exist in Prisma model
    const saved = await db.futureCareer.create({
      data: {
        userId: user.id, // internal User.id
        title: enriched.title,
        description: enriched.description,
        neededSkills: enriched.neededSkills,
        learningPath: enriched.learningPath,
        marketFit: enriched.marketFit,
      },
    });

    console.log("✅ Saved to DB:", saved);

    // ✅ Return DB row + extra computed fields (not stored)
    return {
      career: {
        ...saved,
        fitSummary: enriched.fitSummary,
        careerLevel: enriched.careerLevel,
        salaryRange: enriched.salaryRange,
        demandLabel: enriched.demandLabel,
        approxJobCount: enriched.approxJobCount,
      },
    };
  } catch (err) {
    console.error("❌ Error in generateFutureCareer:", err);
    return { error: err.message };
  }
}

/* ------------------------------------------------------------------
   MAIN ACTION: getFutureCareers
-------------------------------------------------------------------*/

export async function getFutureCareers() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });
  if (!user) throw new Error("User not found");

  try {
    // Filter by internal User.id (matches what we write on create)
    const careers = await db.futureCareer.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return careers;
  } catch (err) {
    console.error("❌ Error in getFutureCareers:", err);
    return [];
  }
}
