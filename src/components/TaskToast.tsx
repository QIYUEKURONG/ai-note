"use client";

import type { AITaskRow } from "@/db/schema";

export function TaskToast(props: { task: AITaskRow | null; onRetry?: () => void }) {
  if (!props.task) return null;
  if (props.task.status === "success") {
    return <div className="task-toast">生成成功</div>;
  }
  if (props.task.status === "failed") {
    return (
      <div className="task-toast failed">
        {props.task.error || "生成失败"}
        {props.onRetry ? (
          <div className="actions">
            <button className="btn ghost" onClick={props.onRetry}>
              重试
            </button>
          </div>
        ) : null}
      </div>
    );
  }
  return <div className="task-toast">生成中…</div>;
}
