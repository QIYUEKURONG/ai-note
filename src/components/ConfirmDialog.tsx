"use client";

export function ConfirmDialog(props: {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-back" onClick={props.onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h4>{props.title}</h4>
        <p>{props.message}</p>
        {props.detail ? <pre className="modal-detail">{props.detail}</pre> : null}
        <div className="actions">
          <button className={props.tone === "primary" ? "btn" : "btn danger"} onClick={props.onConfirm}>
            {props.confirmLabel ?? "删除"}
          </button>
          <button className="btn ghost" onClick={props.onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
