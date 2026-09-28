export function parseJsonFromModel<T>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced?.[1] ?? trimmed;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  const arrayStart = source.indexOf("[");
  const arrayEnd = source.lastIndexOf("]");
  let payload = source;
  if (start >= 0 && end > start && (arrayStart < 0 || start < arrayStart)) {
    payload = source.slice(start, end + 1);
  } else if (arrayStart >= 0 && arrayEnd > arrayStart) {
    payload = source.slice(arrayStart, arrayEnd + 1);
  }
  return JSON.parse(payload) as T;
}

export type SpeculationSpan = { text: string };

export function splitSpeculation(body: string): {
  body: string;
  spans: SpeculationSpan[];
} {
  const spans: SpeculationSpan[] = [];
  const cleaned = body.replace(/\[AI推测\]([^\n[]*)/g, (_, text: string) => {
    const value = text.trim();
    if (value) spans.push({ text: value });
    return `[AI推测] ${value}`.trim();
  });
  return { body: cleaned, spans };
}
