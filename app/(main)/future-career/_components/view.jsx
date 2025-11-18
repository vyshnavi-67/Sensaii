"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BarLoader } from "react-spinners";
import {
  generateFutureCareer,
  getFutureCareers,
} from "@/actions/futureCareer";

export default function FutureCareerView() {
  const [form, setForm] = useState({
    experience: "",
    interests: "",
    skills: "",
    preferredRoles: "",
  });

  const [loading, setLoading] = useState(false);
  const [careers, setCareers] = useState([]);
  const [latest, setLatest] = useState(null);

  // 🧠 Load existing saved careers on mount
  useEffect(() => {
    (async () => {
      try {
        const fetched = await getFutureCareers();
        if (fetched?.length) {
          setCareers(fetched);
          setLatest(fetched[0]); // most recent first
        }
      } catch (err) {
        console.error("Error fetching careers:", err);
      }
    })();
  }, []);

  // ⚡ Generate new career using Groq + save to DB
  async function onGenerate() {
    try {
      setLoading(true);
      const clean = {
        experience: Number(form.experience || 0),
        interests: form.interests,
        skills: form.skills,
        preferredRoles: form.preferredRoles,
      };

      const result = await generateFutureCareer(clean);

      if (result?.career) {
        setLatest(result.career);
        setCareers((prev) => [result.career, ...(prev || [])]);
      }
    } catch (err) {
      console.error("Error generating career:", err);
    } finally {
      setLoading(false);
    }
  }

  // Small helper for time labels in timeline
  const timeLabels = ["0–3 months", "3–6 months", "6–12 months", "12+ months"];

  return (
    <div className="space-y-6">
      <h1 className="text-6xl font-bold gradient-title">Future Career</h1>

      <Card>
        <CardHeader>
          <CardTitle>Quick Intake</CardTitle>
          <CardDescription>
            We’ll tailor a role & roadmap for you
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">
              Years of Experience
            </label>
            <Input
              type="number"
              value={form.experience}
              onChange={(e) =>
                setForm({ ...form, experience: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">
              Preferred Roles
            </label>
            <Input
              placeholder="e.g., Data Scientist, Backend Engineer"
              value={form.preferredRoles}
              onChange={(e) =>
                setForm({ ...form, preferredRoles: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-muted-foreground">Interests</label>
            <Input
              placeholder="e.g., AI, fintech, edtech, research"
              value={form.interests}
              onChange={(e) =>
                setForm({ ...form, interests: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-muted-foreground">
              Current Skills (comma separated)
            </label>
            <Textarea
              placeholder="Python, SQL, React, Docker"
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Button className="w-full" onClick={onGenerate} disabled={loading}>
              {loading ? "Generating..." : "Generate Future Career"}
            </Button>
          </div>
          {loading && <BarLoader className="mt-2" width={"100%"} />}
        </CardContent>
      </Card>

      {/* 🧩 Display latest generated career */}
      {latest ? (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="gradient-title text-3xl md:text-4xl">
                  {latest.title}
                </CardTitle>
                <CardDescription>
                  {latest.createdAt
                    ? new Date(latest.createdAt).toLocaleString()
                    : "Just now"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{latest.description}</p>

                <div>
                  <h3 className="font-semibold mb-2">Required Skills</h3>
                  <ul className="list-disc ml-5 space-y-1">
                    {latest.neededSkills?.length ? (
                      latest.neededSkills.map((s, i) => <li key={i}>{s}</li>)
                    ) : (
                      <li className="text-muted-foreground italic">
                        No skills found
                      </li>
                    )}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Learning Path</h3>
                  <ol className="list-decimal ml-5 space-y-1">
                    {latest.learningPath?.length ? (
                      latest.learningPath.map((s, i) => <li key={i}>{s}</li>)
                    ) : (
                      <li className="text-muted-foreground italic">
                        No learning steps found
                      </li>
                    )}
                  </ol>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Snapshot</CardTitle>
                <CardDescription>Fit & Market Insights</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Market Fit</span>
                  <span className="font-bold">
                    {latest.marketFit ?? "--"} / 10
                  </span>
                </div>

                {latest.careerLevel && (
                  <div className="flex items-center justify-between">
                    <span>Career Level</span>
                    <span className="font-bold">{latest.careerLevel}</span>
                  </div>
                )}

                {latest.salaryRange && (
                  <div className="flex items-center justify-between">
                    <span>Salary Range</span>
                    <span className="font-bold">{latest.salaryRange}</span>
                  </div>
                )}

                {latest.demandLabel && (
                  <div className="flex items-center justify-between">
                    <span>Market Demand</span>
                    <span className="font-bold">{latest.demandLabel}</span>
                  </div>
                )}

                {latest.approxJobCount && (
                  <div className="flex items-center justify-between">
                    <span>Approx. Open Roles</span>
                    <span className="font-bold">
                      {latest.approxJobCount.toLocaleString()}
                    </span>
                  </div>
                )}

                {latest.fitSummary && (
                  <div className="text-sm text-muted-foreground pt-2 border-t mt-2">
                    {latest.fitSummary}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 🌈 Visual Roadmap Timeline (NEW) */}
          {latest.learningPath?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Roadmap Timeline</CardTitle>
                <CardDescription>
                  A suggested sequence with rough time windows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="relative border-l border-muted pl-4 space-y-6">
                  {latest.learningPath.map((step, index) => {
                    const label =
                      timeLabels[
                        Math.min(index, timeLabels.length - 1)
                      ];
                    return (
                      <li key={index} className="ml-2">
                        <div className="absolute -left-2 mt-1 w-3 h-3 bg-primary rounded-full border border-background" />
                        <div className="flex items-center justify-between">
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            Step {index + 1}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full border border-muted-foreground/40 text-muted-foreground">
                            {label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed">
                          {step}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No results yet</CardTitle>
            <CardDescription>
              Generate your first future career above
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* 🕓 Display career history */}
      {careers.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Previous Suggestions</CardTitle>
            <CardDescription>History</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {careers.slice(1).map((c) => (
              <div key={c.id} className="border rounded-lg p-3">
                <div className="font-semibold">{c.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(c.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
