export const THEME_PRESETS = {
  warm: {
    label: "Warm",
    background: "#f6ead7",
    fontFamily: '"Iowan Old Style", Palatino, "Palatino Linotype", serif',
    fontSize: 18,
    textColor: "#3b2a1a",
    accentColor: "#c45c26",
    codeTheme: "warm",
    lineHeight: 1.75,
    pageWidth: 760,
  },
  minimal: {
    label: "Minimal",
    background: "#f7f7f4",
    fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
    fontSize: 17,
    textColor: "#1f1f1c",
    accentColor: "#2f6fed",
    codeTheme: "minimal",
    lineHeight: 1.65,
    pageWidth: 760,
  },
  paper: {
    label: "Paper",
    background: "#fbf6ee",
    fontFamily: '"Iowan Old Style", Palatino, Georgia, serif',
    fontSize: 18,
    textColor: "#2c241b",
    accentColor: "#8a5a32",
    codeTheme: "paper",
    lineHeight: 1.7,
    pageWidth: 760,
  },
  dark: {
    label: "Dark",
    background: "#1c1a17",
    fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
    fontSize: 17,
    textColor: "#efe7dc",
    accentColor: "#e0a45a",
    codeTheme: "dark",
    lineHeight: 1.7,
    pageWidth: 720,
  },
  cyber: {
    label: "Cyber",
    background: "#0e171b",
    fontFamily: '"IBM Plex Sans", "Avenir Next", sans-serif',
    fontSize: 16,
    textColor: "#d7f6ff",
    accentColor: "#3ce0c0",
    codeTheme: "cyber",
    lineHeight: 1.65,
    pageWidth: 700,
  },
  forest: {
    label: "Forest",
    background: "#e8efe4",
    fontFamily: 'Georgia, "Iowan Old Style", serif',
    fontSize: 18,
    textColor: "#1f3324",
    accentColor: "#3d6b45",
    codeTheme: "forest",
    lineHeight: 1.75,
    pageWidth: 720,
  },
  ocean: {
    label: "Ocean",
    background: "#e7f1f6",
    fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
    fontSize: 17,
    textColor: "#163044",
    accentColor: "#2a6f97",
    codeTheme: "ocean",
    lineHeight: 1.7,
    pageWidth: 720,
  },
  retro: {
    label: "Retro",
    background: "#f3e2c7",
    fontFamily: '"American Typewriter", "Courier New", serif',
    fontSize: 17,
    textColor: "#3a2412",
    accentColor: "#c0392b",
    codeTheme: "retro",
    lineHeight: 1.7,
    pageWidth: 680,
  },
} as const;

export type ThemePresetId = keyof typeof THEME_PRESETS;

export type NoteTheme = {
  preset: ThemePresetId | "custom";
  background: string;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  accentColor: string;
  codeTheme: string;
  lineHeight: number;
  pageWidth: number;
  customColorsJson: string;
};

export function themeFromPreset(preset: ThemePresetId): NoteTheme {
  const base = THEME_PRESETS[preset];
  return {
    preset,
    background: base.background,
    fontFamily: base.fontFamily,
    fontSize: base.fontSize,
    textColor: base.textColor,
    accentColor: base.accentColor,
    codeTheme: base.codeTheme,
    lineHeight: base.lineHeight,
    pageWidth: base.pageWidth,
    customColorsJson: "{}",
  };
}

export function isThemePreset(value: string): value is ThemePresetId {
  return value in THEME_PRESETS;
}

export function themeToCssVars(theme: NoteTheme): Record<string, string> {
  return {
    "--paper-bg": theme.background,
    "--paper-ink": theme.textColor,
    "--paper-accent": theme.accentColor,
    "--paper-font": theme.fontFamily,
    "--paper-size": `${theme.fontSize}px`,
    "--paper-leading": String(theme.lineHeight),
    "--paper-width": `${Math.min(820, Math.max(720, theme.pageWidth || 760))}px`,
  };
}
