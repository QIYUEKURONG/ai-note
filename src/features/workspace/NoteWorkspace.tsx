"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SidebarIcon, TrashIcon } from "@/components/Icons";
import { TaskToast } from "@/components/TaskToast";
import { NotesSidebar } from "@/features/notes/NotesSidebar";
import { NoteAtlas } from "@/features/notes/NoteAtlas";
import { ReminderButton } from "@/features/notes/ReminderButton";
import { pushRecentNoteId } from "@/features/notes/browse";
import { BlockEditor } from "@/features/editor/BlockEditor";
import { ImageLightbox } from "@/features/canvas/ImageLightbox";
import { PaperStage, type HungItem } from "@/features/canvas/PaperStage";
import { OrganizeStudio } from "@/features/organize/OrganizeStudio";
import { ImageStudio } from "@/features/images/ImageStudio";
import { ReviewRail } from "@/features/check/ReviewRail";
import { InterviewPanel } from "@/features/interview/InterviewPanel";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { AiDock, type DockAction } from "@/features/dock/AiDock";
import { api } from "@/lib/client";
import { parseDocument } from "@/lib/document";
import { replaceQuote } from "@/lib/review-doc";
import { themeToCssVars, type NoteTheme } from "@/domain/themes";
import type { OrganizeKind } from "@/domain/organize-kinds";
import type { AspectRatioId, ImageStyleId } from "@/domain/image-styles";
import type { VisualTypeId } from "@/domain/visual-types";
import type { KnowledgeCardSpec } from "@/ai/services/prompt-image";
import type { ImagePinPosition } from "@/domain/pins";
import { parseStoredReview, type ReviewMark } from "@/domain/review";
import type { TipTapDoc } from "@/lib/document";
import type {
  AIResultRow,
  AITaskRow,
  InterviewSessionRow,
  InterviewTurnRow,
  NoteRow,
  NoteSettingsRow,
} from "@/db/schema";

type Mode = "read" | "organize" | "image" | "check" | "interview";

type WorkspacePayload = {
  note: NoteRow & { settings: NoteSettingsRow };
  images: HungItem[];
  results: AIResultRow[];
  checks: unknown[];
  interviews: InterviewSessionRow[];
  tasks: AITaskRow[];
};

const reviewOnce = new Set<string>();

export function NoteWorkspace(props: { noteId: string; initialMode?: "check" | "interview" }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(props.initialMode ?? "read");
  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [title, setTitle] = useState("");
  const [task, setTask] = useState<AITaskRow | null>(null);
  const [kind, setKind] = useState<OrganizeKind>("structured");
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [style, setStyle] = useState<ImageStyleId>("pencil");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>("4:3");
  const [density] = useState("medium");
  const [usage] = useState("explain");
  const [visualType, setVisualType] = useState<VisualTypeId | "auto">("illustration");
  const [card] = useState<KnowledgeCardSpec>({
    grid: 9,
    density: "medium",
    theme: "安静的知识卡片",
    font: "清晰无衬线中文",
    background: "暖白纸",
    color: "深墨",
    border: "细线",
  });
  const [theme, setTheme] = useState<NoteTheme | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; action: () => void } | null>(null);
  const [lightbox, setLightbox] = useState<HungItem | null>(null);
  const [editorRev, setEditorRev] = useState(0);
  const [interview, setInterview] = useState<{
    session: InterviewSessionRow;
    turns: InterviewTurnRow[];
  } | null>(null);
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [library, setLibrary] = useState<NoteRow[]>([]);
  const [mobileNav, setMobileNav] = useState(false);
  const [creating, setCreating] = useState(false);
  const [appearance, setAppearance] = useState(false);
  const [reviewActiveId, setReviewActiveId] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState("");
  const [selectionText, setSelectionText] = useState("");
  const [aiScope, setAiScope] = useState("");
  const [scopeNotice, setScopeNotice] = useState("");
  const saveTimer = useRef<number | null>(null);
  const appearanceRef = useRef<HTMLDivElement>(null);
  const checkEntry = useRef<string | null>(null);
  const interviewBooted = useRef(false);

  const load = useCallback(async () => {
    try {
      const payload = await api<WorkspacePayload>(`/api/notes/${props.noteId}`);
      setData(payload);
      setTitle(payload.note.title);
      setTheme({
        preset: payload.note.settings.preset as NoteTheme["preset"],
        background: payload.note.settings.background,
        fontFamily: payload.note.settings.fontFamily,
        fontSize: payload.note.settings.fontSize,
        textColor: payload.note.settings.textColor,
        accentColor: payload.note.settings.accentColor,
        codeTheme: payload.note.settings.codeTheme,
        lineHeight: payload.note.settings.lineHeight,
        pageWidth: payload.note.settings.pageWidth,
        customColorsJson: payload.note.settings.customColorsJson,
      });
    } catch (error) {
      console.error(error);
    }
  }, [props.noteId]);

  useEffect(() => {
    void load();
    pushRecentNoteId(props.noteId);
    void api<{ notes: NoteRow[] }>("/api/notes").then((res) => setLibrary(res.notes));
  }, [load, props.noteId]);

  useEffect(() => {
    setMobileNav(false);
    setMode("read");
    setInterview(null);
    setReviewActiveId(null);
    setAppearance(false);
    checkEntry.current = null;
    interviewBooted.current = false;
  }, [props.noteId]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!appearanceRef.current?.contains(event.target as Node)) setAppearance(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function createNote() {
    setCreating(true);
    try {
      const created = await api<{ note: NoteRow }>("/api/notes", {
        method: "POST",
        body: JSON.stringify({ title: "未命名笔记" }),
      });
      router.push(`/notes/${created.note.id}`);
    } finally {
      setCreating(false);
    }
  }

  function goAfterDelete() {
    const rest = library.filter((note) => note.id !== props.noteId);
    if (rest[0]) router.push(`/notes/${rest[0].id}`);
    else router.push("/");
  }

  useEffect(() => {
    if (!task || (task.status !== "pending" && task.status !== "running")) return;
    const timer = window.setInterval(async () => {
      const res = await api<{ task: AITaskRow }>(`/api/tasks/${task.id}`);
      setTask(res.task);
      if (res.task.status === "success" || res.task.status === "failed") {
        await load();
        if (res.task.status === "success" && res.task.type === "generate_summary" && res.task.resultRef) {
          setActiveResultId(res.task.resultRef);
        }
        if (res.task.status === "success" && res.task.type === "generate_interview" && res.task.resultRef) {
          const packed = await api<{ session: InterviewSessionRow; turns: InterviewTurnRow[] }>(
            `/api/notes/${props.noteId}/interview?sessionId=${res.task.resultRef}`,
          );
          setInterview(packed);
          setInterviewAnswer("");
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [task, load, props.noteId]);

  async function runTask(url: string, body: unknown) {
    const res = await api<{ task: AITaskRow }>(url, { method: "POST", body: JSON.stringify(body) });
    setTask(res.task);
  }

  function queueSave(patch: { title?: string; contentJson?: string }) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void api(`/api/notes/${props.noteId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }).then(async () => {
        await load();
        const res = await api<{ notes: NoteRow[] }>("/api/notes");
        setLibrary(res.notes);
      });
    }, 500);
  }

  function onDocChange(doc: TipTapDoc) {
    queueSave({ contentJson: JSON.stringify(doc) });
  }

  async function persistTheme(next: NoteTheme) {
    setTheme(next);
    await api(`/api/notes/${props.noteId}/settings`, {
      method: "PATCH",
      body: JSON.stringify(next),
    });
  }

  async function openInterview(sessionId: string) {
    const packed = await api<{ session: InterviewSessionRow; turns: InterviewTurnRow[] }>(
      `/api/notes/${props.noteId}/interview?sessionId=${sessionId}`,
    );
    setInterview(packed);
  }

  const reviewResult = data?.results.find((item) => item.kind === "annotation") ?? null;
  const reviewMarks = useMemo(
    () => (reviewResult ? parseStoredReview(reviewResult.body) : []),
    [reviewResult],
  );
  const organizeResults = data?.results.filter((item) => item.kind !== "annotation") ?? [];
  const vars = useMemo(() => (theme ? themeToCssVars(theme) : {}), [theme]);
  const taskRunning = task?.status === "pending" || task?.status === "running";

  useEffect(() => {
    if (mode !== "check") {
      checkEntry.current = null;
      return;
    }
    if (!data || checkEntry.current === props.noteId) return;
    checkEntry.current = props.noteId;
    const latest = data.results.find((item) => item.kind === "annotation");
    if (latest && latest.sourceContentHash === data.note.contentHash) return;
    const key = `${props.noteId}:${data.note.contentHash}`;
    if (reviewOnce.has(key)) return;
    reviewOnce.add(key);
    void runTask(`/api/notes/${props.noteId}/review`, {});
  }, [mode, data, props.noteId]);

  useEffect(() => {
    if (mode !== "interview") {
      interviewBooted.current = false;
      return;
    }
    if (!data || interview || interviewBooted.current) return;
    interviewBooted.current = true;
    const latest = data.interviews[0];
    if (latest) void openInterview(latest.id);
  }, [mode, data, interview]);

  function openMode(next: DockAction) {
    setAppearance(false);
    setReviewNotice("");
    setScopeNotice("");
    const scope = next === "organize" || next === "image" ? selectionText.trim() : "";
    setAiScope(scope);
    if (next === "organize") {
      if (scope) {
        setActiveResultId(null);
      } else {
        const found = organizeResults.find((item) => item.kind === kind);
        setActiveResultId(found?.id ?? organizeResults[0]?.id ?? null);
      }
    }
    setMode(next);
  }

  async function applyReview(mark: ReviewMark) {
    if (!data || !reviewResult) return;
    const next = replaceQuote(parseDocument(data.note.contentJson), mark.quote, mark.suggestion);
    if (!next) {
      setReviewNotice("正文里没找到这句原文，这次没有改动。");
      return;
    }
    setReviewNotice("");
    await api(`/api/notes/${props.noteId}`, {
      method: "PATCH",
      body: JSON.stringify({ contentJson: JSON.stringify(next) }),
    });
    await api(`/api/notes/${props.noteId}/review`, {
      method: "PATCH",
      body: JSON.stringify({ resultId: reviewResult.id, markId: mark.id, status: "applied" }),
    });
    setReviewActiveId(null);
    await load();
    setEditorRev((value) => value + 1);
  }

  async function ignoreReview(mark: ReviewMark) {
    if (!reviewResult) return;
    await api(`/api/notes/${props.noteId}/review`, {
      method: "PATCH",
      body: JSON.stringify({ resultId: reviewResult.id, markId: mark.id, status: "ignored" }),
    });
    setReviewActiveId(null);
    await load();
  }

  if (!data || !theme) {
    return <div className="home">打开纸张…</div>;
  }

  const paper = (
    <PaperStage
      themeVars={vars}
      images={data.images}
      onMovePin={async (pinId, position: ImagePinPosition) => {
        await api(`/api/notes/${props.noteId}/pins/${pinId}`, {
          method: "PATCH",
          body: JSON.stringify(position),
        });
        await load();
      }}
      onOpenImage={setLightbox}
    >
      <div className="editor-shell">
        <BlockEditor
          key={editorRev}
          contentJson={data.note.contentJson}
          onChange={onDocChange}
          onSelectionChange={setSelectionText}
          review={
            mode === "check"
              ? { marks: reviewMarks, activeId: reviewActiveId, onSelect: setReviewActiveId }
              : null
          }
        />
      </div>
    </PaperStage>
  );

  return (
    <div className={`browser-shell apple-notes has-sidebar is-workspace ${mobileNav ? "mobile-nav-open" : ""}`}>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="关闭目录"
        onClick={() => setMobileNav(false)}
      />
      <NotesSidebar
        compact
        notes={library}
        activeId={props.noteId}
        creating={creating}
        onOpen={(id) => {
          setMobileNav(false);
          if (id !== props.noteId) router.push(`/notes/${id}`);
        }}
        onCreate={() => void createNote()}
        onDelete={(id) =>
          setConfirm({
            title: "删除此笔记？",
            message: "此笔记将被删除，可在确认后从列表中移除。",
            action: async () => {
              await api(`/api/notes/${id}`, { method: "DELETE" });
              const res = await api<{ notes: NoteRow[] }>("/api/notes");
              setLibrary(res.notes);
              if (id === props.noteId) {
                const rest = res.notes;
                if (rest[0]) router.push(`/notes/${rest[0].id}`);
                else router.push("/");
              }
            },
          })
        }
      />
      <div className={`workspace notes-like ${mode === "read" ? "is-reading" : "is-mode"}`}>
        {mode === "read" || mode === "check" ? (
          <>
            <header className="topbar notes-topbar apple-topbar">
              <button
                className="icon-btn mobile-only"
                onClick={() => setMobileNav(true)}
                aria-label="目录"
                title="目录"
              >
                <SidebarIcon />
              </button>
              {mode === "check" ? (
                <button type="button" className="text-btn" onClick={() => setMode("read")}>
                  返回
                </button>
              ) : null}
              <input
                className="title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  queueSave({ title: event.target.value });
                }}
              />
              {mode === "read" ? (
                <>
                  <div className="appearance-anchor" ref={appearanceRef}>
                    <button
                      type="button"
                      className={`text-btn ${appearance ? "is-on" : ""}`}
                      onClick={() => setAppearance((open) => !open)}
                    >
                      外观
                    </button>
                    {appearance ? (
                      <div className="appearance-card">
                        <SettingsPanel theme={theme} onTheme={(next) => void persistTheme(next)} />
                      </div>
                    ) : null}
                  </div>
                  <NoteAtlas noteId={props.noteId} />
                  <ReminderButton noteId={props.noteId} title={title} />
                </>
              ) : (
                <span className="mode-chip">检测</span>
              )}
              <button
                className="icon-btn"
                onClick={() =>
                  void api(`/api/notes/${props.noteId}`, {
                    method: "PATCH",
                    body: JSON.stringify({ isFavorite: !data.note.isFavorite }),
                  }).then(async () => {
                    await load();
                    const res = await api<{ notes: NoteRow[] }>("/api/notes");
                    setLibrary(res.notes);
                  })
                }
                title={data.note.isFavorite ? "取消收藏" : "收藏"}
              >
                {data.note.isFavorite ? "★" : "☆"}
              </button>
              <button
                className="icon-btn danger"
                title="删除"
                aria-label="删除"
                onClick={() =>
                  setConfirm({
                    title: "删除这篇笔记？",
                    message: "笔记、图片、整理结果和面试记录都会删除。",
                    action: async () => {
                      await api(`/api/notes/${props.noteId}`, { method: "DELETE" });
                      goAfterDelete();
                    },
                  })
                }
              >
                <TrashIcon />
              </button>
            </header>
            {mode === "check" ? (
              <div className="check-layout">
                <div className="stage-wrap notes-stage">{paper}</div>
                <ReviewRail
                  marks={reviewMarks}
                  activeId={reviewActiveId}
                  busy={Boolean(taskRunning && task?.type === "review_note")}
                  notice={reviewNotice}
                  onSelect={setReviewActiveId}
                  onApply={(mark) => void applyReview(mark)}
                  onIgnore={(mark) => void ignoreReview(mark)}
                  onRerun={() => {
                    setReviewNotice("");
                    void runTask(`/api/notes/${props.noteId}/review`, {});
                  }}
                />
              </div>
            ) : (
              <>
                <div className="stage-wrap notes-stage">{paper}</div>
                <AiDock selection={selectionText} onOpen={openMode} />
              </>
            )}
          </>
        ) : null}

        {mode === "organize" ? (
          <OrganizeStudio
            title={title}
            source={aiScope || data.note.contentText}
            scoped={Boolean(aiScope)}
            notice={scopeNotice}
            kind={kind}
            running={Boolean(taskRunning && task?.type === "generate_summary")}
            results={organizeResults}
            activeId={activeResultId}
            onKind={(next) => {
              setKind(next);
              const found = organizeResults.find((item) => item.kind === next);
              setActiveResultId(found?.id ?? null);
            }}
            onSelect={setActiveResultId}
            onRun={() =>
              void runTask(`/api/notes/${props.noteId}/organize`, {
                kind,
                selection: aiScope,
              })
            }
            onApply={async (result) => {
              if (aiScope) {
                const next = replaceQuote(parseDocument(data.note.contentJson), aiScope, result.body);
                if (!next) {
                  setScopeNotice("没能在正文里定位这段选中文字，原文没有改动。");
                  return;
                }
                await api(`/api/notes/${props.noteId}`, {
                  method: "PATCH",
                  body: JSON.stringify({ contentJson: JSON.stringify(next) }),
                });
              } else {
                await api(`/api/notes/${props.noteId}`, {
                  method: "PATCH",
                  body: JSON.stringify({ applyMarkdown: result.body, title }),
                });
              }
              await load();
              setEditorRev((value) => value + 1);
              setAiScope("");
              setMode("read");
            }}
            onBack={() => setMode("read")}
          />
        ) : null}

        {mode === "image" ? (
          <section className="mode-page">
            <header className="mode-bar">
              <button type="button" className="text-btn" onClick={() => setMode("read")}>
                返回笔记
              </button>
              <div className="mode-bar-title">
                <strong>AI 生图</strong>
                <span>{aiScope ? "只画选中的这段" : "挂在这篇笔记的纸边上"}</span>
              </div>
            </header>
            <ImageStudio
              style={style}
              aspectRatio={aspectRatio}
              visualType={visualType}
              generating={Boolean(taskRunning && task?.type === "create_image")}
              images={data.images}
              scoped={Boolean(aiScope)}
              onStyle={setStyle}
              onAspect={setAspectRatio}
              onVisualType={setVisualType}
              onOpenImage={setLightbox}
              onGenerate={() =>
                void runTask(`/api/notes/${props.noteId}/images`, {
                  style,
                  aspectRatio,
                  density,
                  usage,
                  selection: aiScope,
                  visualType: visualType === "auto" ? undefined : visualType,
                  card: visualType === "knowledge-card" ? card : undefined,
                })
              }
            />
          </section>
        ) : null}

        {mode === "interview" ? (
          <section className="mode-page interview-wrap">
            <header className="mode-bar">
              <button type="button" className="text-btn" onClick={() => setMode("read")}>
                返回笔记
              </button>
              <div className="mode-bar-title">
                <strong>AI Interview</strong>
                <span>{title || "未命名笔记"}</span>
              </div>
            </header>
            <InterviewPanel
              sessions={data.interviews}
              active={interview}
              answer={interviewAnswer}
              busy={Boolean(taskRunning && task?.type === "generate_interview")}
              onAnswer={setInterviewAnswer}
              onStart={() => {
                setInterview(null);
                void runTask(`/api/notes/${props.noteId}/interview`, {});
              }}
              onSend={() =>
                void runTask(`/api/notes/${props.noteId}/interview`, {
                  sessionId: interview?.session.id,
                  answer: interviewAnswer,
                })
              }
              onFinish={() =>
                void runTask(`/api/notes/${props.noteId}/interview`, {
                  sessionId: interview?.session.id,
                  finish: true,
                })
              }
              onOpen={(sessionId) => void openInterview(sessionId)}
              onDelete={(sessionId) =>
                setConfirm({
                  title: "删除面试记录？",
                  message: "对话和结论都会删除。",
                  action: async () => {
                    await api(`/api/notes/${props.noteId}/interview?sessionId=${sessionId}`, {
                      method: "DELETE",
                    });
                    setInterview(null);
                    await load();
                  },
                })
              }
            />
          </section>
        ) : null}

        <TaskToast
          task={task}
          onRetry={() => {
            if (!task) return;
            void api<{ task: AITaskRow }>(`/api/tasks/${task.id}`, { method: "POST" }).then((res) =>
              setTask(res.task),
            );
          }}
        />
        {confirm ? (
          <ConfirmDialog
            title={confirm.title}
            message={confirm.message}
            onClose={() => setConfirm(null)}
            onConfirm={async () => {
              const action = confirm.action;
              setConfirm(null);
              await action();
            }}
          />
        ) : null}
        {lightbox ? (
          <ImageLightbox
            image={lightbox}
            onClose={() => setLightbox(null)}
            onDelete={() =>
              setConfirm({
                title: "取下这张图？",
                message: "图片会从纸边摘下并删除。",
                action: async () => {
                  await api(`/api/notes/${props.noteId}/images?imageId=${lightbox.id}`, {
                    method: "DELETE",
                  });
                  setLightbox(null);
                  await load();
                },
              })
            }
            onRegenerate={() => {
              void runTask(`/api/notes/${props.noteId}/images`, {
                style: lightbox.style,
                aspectRatio: lightbox.aspectRatio,
                visualType: lightbox.visualType,
                replaceImageId: lightbox.id,
              });
              setLightbox(null);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
