"use server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

import { groq } from "@/lib/groq";

export const generateAIInsights = async (industry) => {
  const prompt = `
Analyze the ${industry} industry and return ONLY JSON:
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
At least 5 items per list. No explanation.
`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    let text = completion.choices[0].message.content;
    text = text.replace(/```json|```/g, "").trim();
    return JSON.parse(text);

  } catch (err) {
    console.error("Groq Error", err);
    throw new Error("AI Failed");
  }
};




export async function getIndustryInsights() {
        const {userId} = await auth();
        if(!userId) throw new Error("Unauthorized");
    
        const user= await db.user.findUnique({
            where:{
                clerkUserId: userId,
            },
            include: {
              industryInsight: true,
            },
        });
        if(!userId) throw new Error("User not found");

        if(!user.industryInsight){
            const insights = await generateAIInsights(user.industry);

            const industryInsight = await db.industryInsight.create({
                data: {
                    industry: user.industry,
                    ...insights,
                    nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            });
            return industryInsight;
        }
        return user.industryInsight;
}