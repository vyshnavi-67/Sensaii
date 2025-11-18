import { db } from "../prisma";
import { inngest } from "./client";
import { groq } from "@/lib/groq";

export const generateIndustryInsights = inngest.createFunction(
  { name: "Generate Industry Insights" },
  // every Sunday at 00:00
  { cron: "0 0 * * 0" },
  async ({ step }) => {
    // 1️⃣ Get list of industries we track
    const industries = await step.run("Fetch industries", async () => {
      return db.industryInsight.findMany({
        select: { industry: true },
      });
    });

    // 2️⃣ For each industry, call Groq + update DB
    for (const { industry } of industries) {
      const prompt = `
Analyze the ${industry} industry and return ONLY JSON in this format:

{
  "salaryRanges": [
    { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
  ],
  "growthRate": number,
  "demandLevel": "HIGH" | "MEDIUM" | "LOW",
  "topSkills": ["skill"],
  "marketOutlook": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
  "keyTrends": ["trend"],
  "recommendedSkills": ["skill"]
}

- At least 5 items in each list where applicable.
- NO explanation, NO markdown, ONLY JSON.
`;

      // 2a️⃣ Call Groq via Inngest AI step
      const completion = await step.ai.wrap(
        "groq",
        async (p) => {
          return groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: p }],
            temperature: 0.2,
          });
        },
        prompt
      );

      // 2b️⃣ Safely parse JSON
      let raw = completion?.choices?.[0]?.message?.content || "{}";
      raw = raw.replace(/```json|```/g, "").trim();

      let insights;
      try {
        insights = JSON.parse(raw);
      } catch (e) {
        console.error(`Failed to parse JSON for ${industry}:`, e, raw);
        // fallback so DB update still works
        insights = {
          salaryRanges: [],
          growthRate: 0,
          demandLevel: "MEDIUM",
          topSkills: [],
          marketOutlook: "NEUTRAL",
          keyTrends: [],
          recommendedSkills: [],
        };
      }

      // 2c️⃣ Update that industry's row in DB
      await step.run(`Update ${industry} insights`, async () => {
        await db.industryInsight.update({
          where: { industry },
          data: {
            salaryRanges: insights.salaryRanges ?? [],
            growthRate: insights.growthRate ?? 0,
            demandLevel: insights.demandLevel ?? "MEDIUM",
            topSkills: insights.topSkills ?? [],
            marketOutlook: insights.marketOutlook ?? "NEUTRAL",
            keyTrends: insights.keyTrends ?? [],
            recommendedSkills: insights.recommendedSkills ?? [],
            lastUpdated: new Date(),
            nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
          },
        });
      });
    }
  }
);
