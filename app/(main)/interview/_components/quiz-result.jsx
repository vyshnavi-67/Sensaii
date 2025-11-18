import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Trophy, XCircle } from "lucide-react";
import React from "react";

// Small helper (same idea as server, but redefined here)
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
    t.includes("algorithm")
  ) {
    return "Algorithms";
  }

  if (
    t.includes("database") ||
    t.includes("sql") ||
    t.includes("join") ||
    t.includes("transaction")
  ) {
    return "Databases / SQL";
  }

  return "General CS / Mixed";
}

const QuizResult = ({ result, hideStartNew = false, onStartNew }) => {
  //  Prevent crash: if result not ready yet
  if (!result) {
    return (
      <div className="mx-auto text-center py-10">
        <p className="text-muted-foreground text-lg">Loading results...</p>
      </div>
    );
  }

  const questions = result.questions || [];

  // 🔍 Build topic-wise stats
  const topicStats = {};
  questions.forEach((q) => {
    const topic = q.topic || inferTopicFromText(q.question || "");
    if (!topic) return;
    if (!topicStats[topic]) {
      topicStats[topic] = { total: 0, correct: 0 };
    }
    topicStats[topic].total += 1;
    if (q.isCorrect) topicStats[topic].correct += 1;
  });

  const topicEntries = Object.entries(topicStats).map(([topic, stat]) => ({
    topic,
    total: stat.total,
    correct: stat.correct,
    percent: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
  }));

  return (
    <div className="mx-auto">
      <h1 className="flex items-center gap-2 text-3xl gradient-title">
        <Trophy className="h-6 w-6 text-yellow-500" />
        Quiz Results
      </h1>

      <CardContent className="space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold">
            {result.quizScore.toFixed(1)}%
          </h3>
          <Progress value={result.quizScore} className="w-full" />
        </div>

        {result.improvementTip && (
          <div className="bg-muted p-4 rounded-lg">
            <p className="font-medium">Improvement Tip:</p>
            <p className="text-muted-foreground">{result.improvementTip}</p>
          </div>
        )}

        {/* 🧮 Topic-wise breakdown */}
        {topicEntries.length > 0 && (
          <div className="bg-background border rounded-lg p-4 space-y-2">
            <h3 className="font-medium">Topic-wise Performance</h3>
            <div className="space-y-1 text-sm">
              {topicEntries.map((t) => (
                <div
                  key={t.topic}
                  className="flex items-center justify-between gap-2"
                >
                  <span>{t.topic}</span>
                  <span className="text-muted-foreground text-xs">
                    {t.correct}/{t.total} correct ({t.percent}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="font-medium">Question Review</h3>
          {questions.map((q, index) => {
            const topic = q.topic || inferTopicFromText(q.question || "");
            const difficulty = q.difficulty || "Medium";

            return (
              <div className="border rounded-lg p-4 space-y-2" key={index}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{q.question}</p>
                  {q.isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  )}
                </div>

                <div className="text-xs text-muted-foreground flex gap-4">
                  <span>
                    <b>Difficulty:</b> {difficulty}
                  </span>
                  <span>
                    <b>Topic:</b> {topic}
                  </span>
                </div>

                <div className="text-sm text-muted-foreground mt-1">
                  <p>Your Answer: {q.userAnswer}</p>
                  {!q.isCorrect && <p>Correct Answer: {q.answer}</p>}
                </div>

                <div className="text-sm bg-muted p-2 rounded">
                  <p className="font-medium">Explanation:</p>
                  <p>{q.explanation}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {!hideStartNew && (
        <CardFooter>
          <Button onClick={onStartNew} className="w-full">
            Start New Quiz
          </Button>
        </CardFooter>
      )}
    </div>
  );
};

export default QuizResult;
