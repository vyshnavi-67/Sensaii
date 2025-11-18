"use client";

import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  startSimulation,
  sendSimulationMessage,
  finishSimulation,
} from "@/actions/simulation";
import useFetch from "@/hooks/use-fetch";
import { BarLoader } from "react-spinners";

function SimulationView() {
  const [role, setRole] = useState("Software Engineer");
  const [scenario, setScenario] = useState(
    "Implement an API endpoint and explain your approach."
  );
  const [simulation, setSimulation] = useState(null);
  const [input, setInput] = useState("");

  const chatRef = useRef(null);

  // ⏯ start
  const {
    loading: starting,
    fn: startFn,
    data: startData,
    setData: setStartData,
  } = useFetch(startSimulation);

  // 💬 send
  const {
    loading: sending,
    fn: sendFn,
    data: sendData,
    setData: setSendData,
  } = useFetch(sendSimulationMessage);

  // ✅ finish
  const {
    loading: finishing,
    fn: finishFn,
    data: finishData,
    setData: setFinishData,
  } = useFetch(finishSimulation);

  // when start returns
  useEffect(() => {
    if (startData?.simulation) {
      setSimulation(startData.simulation);
    }
  }, [startData]);

  // when send returns
  useEffect(() => {
    if (sendData?.simulation) {
      setSimulation(sendData.simulation);
      // optional: clear after applying
      setSendData(null);
    }
  }, [sendData, setSendData]);

  // when finish returns (score, dimensions, etc.)
  useEffect(() => {
    if (finishData?.simulation) {
      setSimulation(finishData.simulation);
      setFinishData(null);
    }
  }, [finishData, setFinishData]);

  // auto-scroll chat to bottom
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [simulation]);

  async function onStart() {
    setSimulation(null);
    setStartData(null);
    setSendData(null);
    setFinishData(null);
    setInput("");
    await startFn({ role, scenario });
  }

  async function onSend() {
    if (!input || !simulation) return;

    const userMessage = input.trim();
    if (!userMessage) return;

    try {
      setInput("");

      // optimistic UI update for user message
      setSimulation((prev) => {
        const previousMessages = Array.isArray(prev?.messages)
          ? prev.messages
          : [];
        return {
          ...prev,
          messages: [
            ...previousMessages,
            { role: "user", content: userMessage },
          ],
        };
      });

      await sendFn({
        simulationId: simulation.id,
        message: userMessage,
      });
    } catch (err) {
      console.error("💥 Send failed:", err);
    }
  }

  async function onFinish() {
    if (!simulation) return;
    try {
      await finishFn({ simulationId: simulation.id });
    } catch (err) {
      console.error("Error finishing simulation:", err);
    }
  }

  // ✅ Safe handling of messages to avoid .map errors
  let messages = [];
  try {
    if (Array.isArray(simulation?.messages)) {
      messages = simulation.messages;
    } else if (typeof simulation?.messages === "string") {
      messages = JSON.parse(simulation.messages);
    } else if (
      simulation?.messages &&
      typeof simulation.messages === "object"
    ) {
      messages = Object.values(simulation.messages);
    }
  } catch (err) {
    console.warn("⚠️ Could not parse messages:", err);
    messages = [];
  }

  return (
    <div className="space-y-6">
      <h1 className="text-6xl font-bold gradient-title">Job Simulation</h1>

      {/* Setup Card */}
      <Card>
        <CardHeader>
          <CardTitle>Setup</CardTitle>
          <CardDescription>
            Pick a role and scenario, then start
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Role</label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g., Backend Engineer"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Scenario</label>
            <Input
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="e.g., Design a login API with auth and validation"
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={onStart} disabled={starting || sending || finishing}>
              {starting ? "Starting..." : "Start Simulation"}
            </Button>
          </div>
          {starting && <BarLoader className="mt-2" width={"100%"} />}
        </CardContent>
      </Card>

      {/* Main Simulation Card */}
      {simulation && (
        <Card>
          <CardHeader>
            <CardTitle>{simulation.role}</CardTitle>
            <CardDescription>{simulation.scenario}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Chat area */}
            <div
              ref={chatRef}
              className="h-[380px] overflow-y-auto border rounded-md p-3 space-y-3 bg-background"
            >
              {Array.isArray(messages) && messages.length > 0 ? (
                messages.map((m, i) => (
                  <div
                    key={`${m.role}-${i}-${m.content?.slice(0, 10) || i}`}
                    className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      m.role === "assistant"
                        ? "bg-muted self-start"
                        : m.role === "user"
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-background border"
                    }`}
                  >
                    <div className="text-xs uppercase opacity-60 mb-1">
                      {m.role}
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground italic">
                  No messages yet
                </div>
              )}
            </div>

            {/* Input row */}
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Type your answer… (or /finish)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !sending) {
                    const val = input.trim().toLowerCase();
                    if (val === "/finish") {
                      setInput("");
                      onFinish();
                    } else if (val) {
                      onSend();
                    }
                  }
                }}
              />
              <Button
                onClick={() => {
                  const val = input.trim().toLowerCase();
                  if (val === "/finish") {
                    setInput("");
                    onFinish();
                  } else {
                    onSend();
                  }
                }}
                disabled={sending || finishing}
              >
                {sending || finishing ? "…" : "Send"}
              </Button>
            </div>

            {(sending || finishing) && (
              <BarLoader className="mt-2" width={"100%"} />
            )}

            {/* ================== ENHANCED FEEDBACK SECTION ================== */}
            {simulation?.performanceScore != null && (
              <div className="mt-6 border rounded-lg p-4 space-y-4 bg-gray-900 text-gray-100">
                <h2 className="text-2xl font-bold text-primary">
                  Simulation Summary
                </h2>

                {/* Quick meta */}
                <div className="text-sm text-muted-foreground">
                  <b>Role:</b> {simulation.role} <br />
                  <b>Scenario:</b> {simulation.scenario}
                </div>

                {/* Overall score & level */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                  <div className="text-lg">
                    <span className="font-semibold">Performance Score:</span>{" "}
                    {simulation.performanceScore}/100
                  </div>
                  {simulation.candidateLevel && (
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide">
                      {simulation.candidateLevel}
                    </span>
                  )}
                </div>

                {/* Short natural-language summary */}
                {simulation.summary && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {simulation.summary}
                  </p>
                )}

                {/* Dimension-wise scores */}
                {Array.isArray(simulation.dimensions) &&
                  simulation.dimensions.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h3 className="font-semibold text-sm">
                        Dimension-wise performance
                      </h3>
                      <div className="space-y-3">
                        {simulation.dimensions.map((dim, i) => {
                          const safeScore =
                            typeof dim.score === "number"
                              ? Math.min(Math.max(dim.score, 0), 100)
                              : 0;
                          return (
                            <div key={`dim-${i}`} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span>{dim.name}</span>
                                <span className="font-mono">
                                  {dim.score ?? "--"}/100
                                </span>
                              </div>
                              <div className="h-1.5 rounded bg-gray-800 overflow-hidden">
                                <div
                                  className="h-full rounded bg-primary"
                                  style={{ width: `${safeScore}%` }}
                                />
                              </div>
                              {dim.comment && (
                                <p className="text-xs text-gray-400">
                                  {dim.comment}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Strengths / Weaknesses / Tips (existing behaviour) */}
                {Array.isArray(simulation.strengths) &&
                  simulation.strengths.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-green-400">
                        💪 Strengths
                      </h3>
                      <ul className="list-disc ml-6 text-sm">
                        {simulation.strengths.map((s, i) => (
                          <li key={`strength-${i}`}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {Array.isArray(simulation.weaknesses) &&
                  simulation.weaknesses.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-red-400">
                        ⚠️ Weaknesses
                      </h3>
                      <ul className="list-disc ml-6 text-sm">
                        {simulation.weaknesses.map((w, i) => (
                          <li key={`weakness-${i}`}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {Array.isArray(simulation.improvementTips) &&
                  simulation.improvementTips.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-yellow-400">
                        ✨ Improvement Tips
                      </h3>
                      <ul className="list-disc ml-6 text-sm">
                        {simulation.improvementTips.map((t, i) => (
                          <li key={`tip-${i}`}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Key moments timeline */}
                {Array.isArray(simulation.keyMoments) &&
                  simulation.keyMoments.length > 0 && (
                    <div className="mt-4">
                      <h3 className="font-semibold text-sm mb-2">
                        Key moments in this attempt
                      </h3>
                      <div className="space-y-2">
                        {simulation.keyMoments.map((km, i) => {
                          const msg =
                            typeof km.turnIndex === "number"
                              ? messages[km.turnIndex]
                              : null;
                          const effectColor =
                            km.effect === "positive"
                              ? "text-green-400"
                              : km.effect === "negative"
                              ? "text-red-400"
                              : "text-gray-300";
                          return (
                            <div
                              key={`km-${i}`}
                              className="border-l-2 border-primary/40 pl-3 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className={effectColor}>
                                  {km.label || "Key moment"}
                                </span>
                                {typeof km.turnIndex === "number" && (
                                  <span className="text-[10px] text-gray-400">
                                    Turn {km.turnIndex}
                                  </span>
                                )}
                              </div>
                              {msg?.content && (
                                <p className="text-gray-300 line-clamp-2">
                                  “{msg.content}”
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Next practice recommendations */}
                {(Array.isArray(simulation.nextPracticeScenarios) &&
                  simulation.nextPracticeScenarios.length > 0) ||
                (Array.isArray(simulation.nextConceptsToStudy) &&
                  simulation.nextConceptsToStudy.length > 0) ? (
                  <div className="mt-4 grid md:grid-cols-2 gap-4">
                    {Array.isArray(simulation.nextPracticeScenarios) &&
                      simulation.nextPracticeScenarios.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-sm">
                            Next practice scenarios
                          </h3>
                          <ul className="list-disc ml-5 text-xs text-gray-300 space-y-1">
                            {simulation.nextPracticeScenarios.map((s, i) => (
                              <li key={`nextScenario-${i}`}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {Array.isArray(simulation.nextConceptsToStudy) &&
                      simulation.nextConceptsToStudy.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-sm">
                            Concepts to revise
                          </h3>
                          <ul className="list-disc ml-5 text-xs text-gray-300 space-y-1">
                            {simulation.nextConceptsToStudy.map((c, i) => (
                              <li key={`nextConcept-${i}`}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SimulationView;
