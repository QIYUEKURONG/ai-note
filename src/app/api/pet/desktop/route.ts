import { execFile, spawn } from "node:child_process";
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
  const pid = runningPid();
  if (!pid) return;
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
}

export async function GET() {
  return json({ running: Boolean(runningPid()) });
}

export async function POST() {
  stopExisting();
  try {
    await ensureBinary();
  } catch (error) {
    const message = error instanceof Error ? error.message : "桌面窗口没有准备好";
    return json({ error: message }, 500);
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  const child = spawn(binary, [], { detached: true, stdio: "ignore" });
  child.unref();
  if (!child.pid) return json({ error: "桌面窗口没有打开" }, 500);
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  fs.writeFileSync(pidFile, String(child.pid));
  return json({ ok: true });
}
