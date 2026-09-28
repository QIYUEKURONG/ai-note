"use client";

import type { CheckQuestionRow, CheckSessionRow } from "@/db/schema";

export function CheckPanel(props: {
  sessions: CheckSessionRow[];
  active: { session: CheckSessionRow; questions: CheckQuestionRow[] } | null;
  answers: Record<string, string>;
  onAnswers: (id: string, value: string) => void;
  onStart: () => void;
  onSubmit: (question: CheckQuestionRow) => void;
  onOpen: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}) {
  return (
    <div className="side-panel">
      <h3>总结检测</h3>
      <p style={{ color: "var(--desk-muted)", marginTop: 0 }}>
        不是考试，是确认你是否真的理解了这篇笔记。
      </p>
      <div className="actions">
        <button className="btn" onClick={props.onStart}>
          开始检测
        </button>
      </div>
      {props.sessions.length > 0 ? (
        <div className="qa">
          {props.sessions.map((session) => (
            <button
              key={session.id}
              className="choice"
              onClick={() => props.onOpen(session.id)}
            >
              {new Date(session.createdAt).toLocaleString()} · 理解程度{" "}
              {session.overallScore == null ? "进行中" : `${Math.round(session.overallScore)}%`}
            </button>
          ))}
        </div>
      ) : null}
      {props.active ? (
        <div>
          {props.active.session.overallScore != null ? (
            <div className="score">{Math.round(props.active.session.overallScore)}%</div>
          ) : null}
          {props.active.questions.map((question) => {
            const evaluation = question.evaluationJson
              ? (JSON.parse(question.evaluationJson) as {
                  correct?: string[];
                  incorrect?: string[];
                  missing?: string[];
                  comment?: string;
                })
              : null;
            const options = question.optionsJson ? (JSON.parse(question.optionsJson) as string[]) : [];
            return (
              <div key={question.id} className="qa">
                <h4>
                  {question.prompt}
                  <small style={{ marginLeft: 8, color: "var(--desk-muted)" }}>
                    {question.type} · {question.difficulty}
                  </small>
                </h4>
                {options.length > 0 ? (
                  options.map((option) => (
                    <label key={option} className="choice">
                      <input
                        type="radio"
                        name={question.id}
                        checked={props.answers[question.id] === option}
                        onChange={() => props.onAnswers(question.id, option)}
                      />
                      {option}
                    </label>
                  ))
                ) : question.type === "true-false" ? (
                  ["正确", "错误"].map((option) => (
                    <label key={option} className="choice">
                      <input
                        type="radio"
                        name={question.id}
                        checked={props.answers[question.id] === option}
                        onChange={() => props.onAnswers(question.id, option)}
                      />
                      {option}
                    </label>
                  ))
                ) : (
                  <textarea
                    rows={4}
                    value={props.answers[question.id] ?? question.userAnswer ?? ""}
                    onChange={(event) => props.onAnswers(question.id, event.target.value)}
                  />
                )}
                {question.score == null ? (
                  <div className="actions">
                    <button className="btn ghost" onClick={() => props.onSubmit(question)}>
                      提交这题
                    </button>
                  </div>
                ) : (
                  <div className="result">
                    得分 {Math.round(question.score)}
                    {evaluation?.correct?.length ? <div>正确：{evaluation.correct.join("；")}</div> : null}
                    {evaluation?.incorrect?.length ? <div>错误：{evaluation.incorrect.join("；")}</div> : null}
                    {evaluation?.missing?.length ? <div>遗漏：{evaluation.missing.join("；")}</div> : null}
                    {evaluation?.comment ? <div>{evaluation.comment}</div> : null}
                  </div>
                )}
              </div>
            );
          })}
          <div className="actions">
            <button className="btn danger" onClick={() => props.onDelete(props.active!.session.id)}>
              删除这次检测
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
