import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Trophy } from "lucide-react";
import React from "react";

const StatsCards = ({ assessments }) => {
  const getAverageScore = () => {
    if (!assessments?.length) return 0;
    const total = assessments.reduce(
      (sum, assessment) => sum + assessment.quizScore,
      0
    );
    return (total / assessments.length).toFixed(1);
  };

  const getLatestAssessment = () => {
    if (!assessments?.length) return null;
    // assuming assessments[0] is latest (you order asc/desc in getAssessments)
    return assessments[assessments.length - 1];
  };

  const getTotalQuestions = () => {
    if (!assessments?.length) return 0;
    return assessments.reduce(
      (sum, assessment) => sum + (assessment.questions?.length || 0),
      0
    );
  };

  const buildTopicStats = () => {
    const topicStats = {};
    if (!assessments?.length) return topicStats;

    assessments.forEach((a) => {
      (a.questions || []).forEach((q) => {
        const topic = q.topic || "General CS / Mixed";
        if (!topicStats[topic]) {
          topicStats[topic] = { total: 0, correct: 0 };
        }
        topicStats[topic].total += 1;
        if (q.isCorrect) topicStats[topic].correct += 1;
      });
    });

    return topicStats;
  };

  const getStrongestAndWeakestTopics = () => {
    const stats = buildTopicStats();
    const entries = Object.entries(stats).map(([topic, s]) => ({
      topic,
      total: s.total,
      correct: s.correct,
      percent: s.total > 0 ? s.correct / s.total : 0,
    }));

    if (!entries.length) return { strongest: null, weakest: null };

    // require at least 2 questions to consider a topic
    const filtered = entries.filter((e) => e.total >= 2);
    const list = filtered.length ? filtered : entries;

    list.sort((a, b) => b.percent - a.percent);

    const strongest = list[0];
    const weakest = list[list.length - 1];

    return {
      strongest: strongest?.topic || null,
      weakest: weakest?.topic || null,
    };
  };

  const { strongest, weakest } = getStrongestAndWeakestTopics();
  const latest = getLatestAssessment();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Average score */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{getAverageScore()}%</div>
          <p className="text-xs text-muted-foreground">
            Across all mock interviews
          </p>
        </CardContent>
      </Card>

      {/* Questions practiced */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Questions Practiced
          </CardTitle>
          <Brain className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{getTotalQuestions()}</div>
          <p className="text-xs text-muted-foreground">Total questions</p>
        </CardContent>
      </Card>

      {/* Latest score + strongest/weakest topic */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Latest Performance
          </CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {latest ? latest.quizScore.toFixed(1) : 0}%
          </div>
          <p className="text-xs text-muted-foreground">
            Most recent quiz
            {strongest && (
              <>
                <br />
                Strongest: <span className="font-semibold">{strongest}</span>
              </>
            )}
            {weakest && (
              <>
                <br />
                Weakest: <span className="font-semibold">{weakest}</span>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsCards;
