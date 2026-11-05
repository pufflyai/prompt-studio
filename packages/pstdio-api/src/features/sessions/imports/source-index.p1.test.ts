import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSessionImportSource } from "./source";

test("indexes a large file export on disk while reading only the requested conversation", async () => {
  const root = await mkdtemp(join(tmpdir(), "session-import-large-"));
  let source: Awaited<ReturnType<typeof openSessionImportSource>> | undefined;
  try {
    const tables = join(root, "tables");
    await mkdir(tables);
    const session = {
      id: "old",
      project_id: "project",
      title: "Earlier work",
      session_file_id: "history",
      agent: null,
      status: "completed",
      archived: false,
      last_selected_model: null,
      params_json: null,
      usage_json: null,
      last_request_started: null,
      last_request_ended: null,
      created_at: "2025-01-01",
      updated_at: "2025-01-01",
    };
    await writeFile(join(tables, "public.sessions.jsonl"), `${JSON.stringify(session)}\n`);
    const file = { id: "history", project_id: "project", file_name: "history.json", storage_path: "history.json" };
    const writer = Bun.file(join(tables, "public.files.jsonl")).writer();
    try {
      for (let i = 0; i < 100_000; i++) writer.write(`${JSON.stringify({ ...file, id: `unrelated-${i}` })}\n`);
      writer.write(`${JSON.stringify(file)}\n`);
    } finally {
      await writer.end();
    }
    await writeFile(
      join(root, "history.json"),
      JSON.stringify([{ id: "reply", role: "assistant", parts: [{ type: "text", text: "Preserved" }] }]),
    );
    const progress: number[] = [];
    const start = performance.now();
    const before = process.memoryUsage().rss;
    let peak = before;
    source = await openSessionImportSource(
      { sourcePath: root },
      {
        onProgress: async (count) => {
          progress.push(count);
          peak = Math.max(peak, process.memoryUsage().rss);
        },
      },
    );
    expect(progress[0]).toBe(1000);
    expect(progress.at(-1)).toBe(100_001);
    expect((await source.history(session)).messages).toMatchObject([{ id: "reply" }]);
    console.info(
      JSON.stringify({
        diagnostic: "session-import-index",
        fileRows: 100_001,
        elapsedMs: Math.round(performance.now() - start),
        rssGrowthMB: Math.round((peak - before) / 1_000_000),
      }),
    );
  } finally {
    await source?.close();
    await rm(root, { recursive: true, force: true });
  }
});
