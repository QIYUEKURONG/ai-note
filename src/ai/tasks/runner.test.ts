import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/db/client";
import { getTask } from "@/db/repos";
import {
  enqueueTask,
  registerTaskHandler,
  resetRunnerForTests,
} from "./runner";

describe("task runner", () => {
  beforeEach(() => {
    process.env.MINDBOOK_DB = ":memory:";
    resetDbForTests();
    resetRunnerForTests();
  });

  afterEach(() => {
    resetRunnerForTests();
    resetDbForTests();
    delete process.env.MINDBOOK_DB;
  });

  it("runs a handler to success", async () => {
    registerTaskHandler("generate_summary", async () => "result-1");
    const task = enqueueTask({
      type: "generate_summary",
      payload: { kind: "tldr" },
    });
    await waitUntil(() => getTask(task.id)?.status === "success");
    expect(getTask(task.id)?.resultRef).toBe("result-1");
  });

  it("records handler failure", async () => {
    registerTaskHandler("create_image", async () => {
      throw new Error("boom");
    });
    const task = enqueueTask({ type: "create_image", payload: {} });
    await waitUntil(() => getTask(task.id)?.status === "failed");
    expect(getTask(task.id)?.error).toBe("boom");
  });
});

async function waitUntil(predicate: () => boolean, timeout = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error("timed out waiting for task");
}
