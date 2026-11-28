import { expect, spyOn, test } from "bun:test";
import { executeExtensionCommand } from "./api";

test("sent Planner card moves survive page unload within the browser's keepalive budget", async () => {
  const writes = Promise.withResolvers<void>();
  const fetch = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async () => {
        await writes.promise;
        return Response.json({ outcome: { ok: true, status: "success", value: { changed: 1 } } });
      },
      { preconnect: globalThis.fetch.preconnect },
    ),
  );
  const commandId = "pstdio.planner.view.tickets.kanban.onMove";
  try {
    const send = (value: string) =>
      executeExtensionCommand("project", commandId, { params: { rowId: "ticket", attributes: { value } } });
    const first = send("x".repeat(50_000));
    const second = send("x".repeat(20_000));
    expect(fetch.mock.calls.map(([, init]) => init?.keepalive)).toEqual([true, undefined]);
    writes.resolve();
    await Promise.all([first, second]);
    await send("blocked");
    expect(fetch.mock.calls.at(-1)?.[1]?.keepalive).toBe(true);
    await executeExtensionCommand("project", "pstdio.planner.command.get-ticket", { params: { id: "ticket" } });
    expect(fetch.mock.calls.at(-1)?.[1]?.keepalive).toBeUndefined();
  } finally {
    writes.resolve();
    fetch.mockRestore();
  }
});
