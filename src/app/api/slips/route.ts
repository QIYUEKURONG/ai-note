import { isDayKey } from "@/domain/calendar";
import { createSlip, listSlipsBetween } from "@/db/slips";
import { badRequest, json } from "../helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!isDayKey(from) || !isDayKey(to) || from > to) return badRequest("日期不对");
  return json({ slips: listSlipsBetween(from, to) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    day?: string;
    body?: string;
    color?: string;
  };
  const slip = createSlip({
    day: body.day ?? "",
    body: body.body ?? "",
    color: body.color,
  });
  if (!slip) return badRequest("写下一句再记下");
  return json({ slip }, 201);
}
