"use client";

export function ConfirmDialog(props: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-back" onClick={props.onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h4>{props.title}</h4>
        <p>{props.message}</p>
        <div className="actions">
          <button className="btn danger" onClick={props.onConfirm}>
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
