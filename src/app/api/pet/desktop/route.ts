import { execFile, execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { json } from "../../helpers";

const execFileAsync = promisify(execFile);
const pidFile = path.join(process.cwd(), "data", "desktop-pet.pid");
const binary = path.join(process.cwd(), ".tools", "desktop-pet");
const source = path.join(process.cwd(), "desktop", "PetWindow.swift");

function runningPid(): number | null {
  if (!fs.existsSync(pidFile)) return null;
  const pid = Number(fs.readFileSync(pidFile, "utf8"));
  if (!Number.isFinite(pid) || pid <= 0) return null;
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

async function ensureBinary() {
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  if (fs.existsSync(binary) && fs.statSync(binary).mtimeMs >= fs.statSync(source).mtimeMs) return;
  await execFileAsync("swiftc", ["-O", "-o", binary, source, "-framework", "Cocoa", "-framework", "WebKit"]);
}

function stopExisting() {
  const pids = new Set<number>();
  const recorded = runningPid();
  if (recorded) pids.add(recorded);
  try {
    const listed = execFileSync("pgrep", ["-f", "desktop-pet"], { encoding: "utf8" });
    for (const line of listed.split("\n")) {
      const pid = Number(line);
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }
  } catch {
    // pgrep exits with status 1 when nothing matches.
  }
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  }
}

export async function GET() {
  return json({ running: Boolean(runningPid()) });
}

function serverPort(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const port = host.slice(host.lastIndexOf(":") + 1);
  return /^\d+$/.test(port) ? port : "3001";
}

export async function POST(request: Request) {
  stopExisting();
  try {
    await ensureBinary();
  } catch (error) {
    const message = error instanceof Error ? error.message : "桌面窗口没有准备好";
    return json({ error: message }, 500);
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  const child = spawn(binary, [serverPort(request)], { detached: true, stdio: "ignore" });
  child.unref();
  if (!child.pid) return json({ error: "桌面窗口没有打开" }, 500);
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  fs.writeFileSync(pidFile, String(child.pid));
  return json({ ok: true });
}
