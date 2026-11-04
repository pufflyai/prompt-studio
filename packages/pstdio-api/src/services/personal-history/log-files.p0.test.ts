import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { messageEntries } from "./log-entries";
import { createSessionLogFiles } from "./log-files";

test("an unreadable saved message does not hide compatible messages on either side", async () => {
  const root = await mkdtemp(join(tmpdir(), "session-log-read-"));
  try {
    const files = createSessionLogFiles(root);
    const message = (id: string) => ({ id, role: "assistant" as const, parts: [{ type: "text" as const, text: id }] });
    const future = JSON.stringify({
      i: 1,
      m: JSON.stringify({ id: "future", role: "assistant", parts: [{ type: "future-part" }] }),
    });
    await files.savePage("namespace", "session", 1, [
      ...messageEntries(0, message("before")),
      future,
      ...messageEntries(2, message("after")),
    ]);
    expect(await files.read("namespace", "session")).toEqual([message("before"), message("after")]);
    expect(await files.readPosition("namespace", "session")).toEqual({ after: 1 });
    const raw = await Bun.file(
      join(root, "personal-history", "namespace", "session.pages", "0000000000000001.json"),
    ).text();
    expect(raw).toContain("future-part");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
