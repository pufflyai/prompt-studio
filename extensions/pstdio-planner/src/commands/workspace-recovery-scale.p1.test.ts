import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { AttemptRecord } from "../data/attempt-types";
import { makeCommandContext } from "./command-context.fixture";
import { readRecoverySeed } from "./workspace-recovery";

test("recovery tries surviving code first and pages only the selected workspace's saved commits", async () => {
  const storage = createMemoryStorage({
    collections: {
      "planner-attempt-events": Object.fromEntries(
        Array.from({ length: 5205 }, (_, i) => [
          `event-${i}`,
          {
            id: `event-${i}`,
            workspaceId: i < 5000 ? `unrelated-${i}` : "selected",
            createdAt: new Date(Math.floor(i / 3) * 1000).toISOString(),
            commitSha: `commit-${i}`,
          },
        ]),
      ),
    },
  });
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    list: async () => {
      throw Error(`Unbounded collection: ${name}`);
    },
  });
  const readMany = storage.records.readMany.bind(storage.records);
  let bodies = 0;
  storage.records.readMany = async (ids) => {
    expect(ids.length).toBeLessThanOrEqual(100);
    bodies += ids.length;
    return readMany(ids);
  };
  const tried: string[] = [];
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      workspaces: {
        get: async () => ({ id: "selected", branch: "surviving", execution_kind: "local" }),
      },
      process: {
        run: async ({ command }) => {
          const ref = command.at(-1)!;
          tried.push(ref);
          if (ref === "commit-5204^{commit}")
            await storage.collection("tickets").put("concurrent", { title: "Unrelated ticket edit" });
          return { exitCode: ref === "commit-5104^{commit}" ? 0 : 1, stdout: "saved-head\n", stderr: "" };
        },
      },
    },
  });
  const attempt = {
    workspaceId: "selected",
    revisions: [{ headSha: "submitted" }],
  } as AttemptRecord;
  expect(await readRecoverySeed(ctx, attempt, "base")).toBe("saved-head");
  expect(tried.slice(0, 4)).toEqual([
    "surviving^{commit}",
    "submitted^{commit}",
    "commit-5204^{commit}",
    "commit-5203^{commit}",
  ]);
  expect(tried.at(-1)).toBe("commit-5104^{commit}");
  expect(bodies).toBeLessThanOrEqual(200);
});
