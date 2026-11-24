import { expect, test } from "bun:test";
import { makeRunner } from "../runner/runner.test-fixture";
import { uncoveredContextFunctions } from "./context-surface-coverage";

test("the process-mode ctx surface accounts for every ctx function", async () => {
  let captured: { projectId: string } | undefined;
  const runner = makeRunner({
    commands: [
      {
        id: "capture",
        ref: { kind: "command", id: "capture" },
        title: "Capture",
        run: (ctx) => {
          captured = ctx;
        },
      },
    ],
  });
  await runner.execute({ commandId: "pstdio.lab.command.capture", projectId: "p1", source: "cli" });
  expect(uncoveredContextFunctions(captured!)).toEqual([]);
});

test("surface coverage reports an unexpectedly failed factory and an undescribed member", () => {
  const ctx = {
    projectId: "p1",
    storage: {
      collection: () => {
        throw new Error("Unexpected factory failure");
      },
      extra: () => {},
    },
  };
  expect(uncoveredContextFunctions(ctx)).toEqual(["storage.collection", "storage.extra"]);
});
