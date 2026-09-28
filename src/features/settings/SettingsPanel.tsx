"use client";

import { THEME_PRESETS, type NoteTheme, type ThemePresetId } from "@/domain/themes";

const FONTS = [
  { label: "衬线", value: '"Iowan Old Style", Palatino, Georgia, serif' },
  { label: "无衬线", value: '"Avenir Next", "PingFang SC", sans-serif' },
  { label: "等宽", value: '"IBM Plex Mono", ui-monospace, monospace' },
];

export function SettingsPanel(props: {
  theme: NoteTheme;
  onTheme: (theme: NoteTheme) => void;
}) {
  return (
    <div className="side-panel">
      <h3>这张纸</h3>
      <p className="panel-hint">只改变这一篇的纸面，不影响别的笔记。</p>
      <div className="chip-grid">
        {Object.entries(THEME_PRESETS).map(([id, preset]) => (
          <button
            key={id}
            className={props.theme.preset === id ? "chip selected" : "chip"}
            onClick={() => props.onTheme({ ...preset, preset: id as ThemePresetId, customColorsJson: "{}" })}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="form-grid" style={{ marginTop: 16 }}>
        <label>
          背景
          <input
            type="color"
            value={toColor(props.theme.background)}
            onChange={(event) =>
              props.onTheme({ ...props.theme, preset: "custom", background: event.target.value })
            }
          />
        </label>
        <label>
          文字颜色
          <input
            type="color"
            value={toColor(props.theme.textColor)}
            onChange={(event) =>
              props.onTheme({ ...props.theme, preset: "custom", textColor: event.target.value })
            }
          />
        </label>
        <label>
          强调色
          <input
            type="color"
            value={toColor(props.theme.accentColor)}
            onChange={(event) =>
              props.onTheme({ ...props.theme, preset: "custom", accentColor: event.target.value })
            }
          />
        </label>
        <label>
          字体
          <span className="font-picks">
            {FONTS.map((font) => (
              <button
                key={font.label}
                type="button"
                className={props.theme.fontFamily === font.value ? "is-on" : ""}
                style={{ fontFamily: font.value }}
                onClick={() => props.onTheme({ ...props.theme, fontFamily: font.value, preset: "custom" })}
              >
                {font.label}
              </button>
            ))}
          </span>
        </label>
        <label>
          字号 {props.theme.fontSize}
          <input
            type="range"
            min={14}
            max={24}
            value={props.theme.fontSize}
            onChange={(event) =>
              props.onTheme({ ...props.theme, fontSize: Number(event.target.value) })
            }
          />
        </label>
        <label>
          行间距 {props.theme.lineHeight.toFixed(2)}
          <input
            type="range"
            min={1.4}
            max={2.1}
            step={0.05}
            value={props.theme.lineHeight}
            onChange={(event) =>
              props.onTheme({ ...props.theme, lineHeight: Number(event.target.value) })
            }
          />
        </label>
        <label>
          页面宽度 {Math.min(820, Math.max(720, props.theme.pageWidth))}
          <input
            type="range"
            min={720}
            max={820}
            value={Math.min(820, Math.max(720, props.theme.pageWidth))}
            onChange={(event) =>
              props.onTheme({ ...props.theme, pageWidth: Number(event.target.value) })
            }
          />
        </label>
      </div>
    </div>
  );
}

function toColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#c45c26";
}
