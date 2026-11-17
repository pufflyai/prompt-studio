import { expect, test } from "bun:test";
import { settleWorkspaceDiffReads } from "./workspace-diff-reads";

test("a completed diff slot admits the next workspace while another sibling remains held", async () => {
  const gates = Array.from({ length: 5 }, () => Promise.withResolvers<void>());
  const entered = Promise.withResolvers<void>();
  const returned = Promise.withResolvers<void>();
  const started: string[] = [];
  let active = 0;
  let peak = 0;
  const pending = settleWorkspaceDiffReads(
    gates.map((_, index) => async () => {
      const workspaceId = `ws-${index}`;
      started.push(workspaceId);
      peak = Math.max(peak, ++active);
      if (started.length === 4) entered.resolve();
      await gates[index]!.promise;
      active--;
      if (index === 1) returned.resolve();
      return { workspaceId, additions: index, deletions: 0, fileCount: 1 };
    }),
  );
  try {
    await entered.promise;
    gates[1]!.resolve();
    await returned.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    const beforeHeldSiblingReturns = [...started];
    for (const gate of gates) gate.resolve();
    await pending;
    expect(beforeHeldSiblingReturns).toEqual(["ws-0", "ws-1", "ws-2", "ws-3", "ws-4"]);
    expect(peak).toBe(4);
    expect(active).toBe(0);
  } finally {
    for (const gate of gates) gate.resolve();
    await pending;
  }
});
