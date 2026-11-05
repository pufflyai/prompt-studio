import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionImportJob } from "pstdio-api-contracts";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

test(
  "agents preview and import a JSONL backup through the compiled CLI and host",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-session-import-"));
    let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    try {
      host = await startPackagedServe(root);
      const headers = { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" };
      const response = await fetch(`${host.baseUrl}/v1/projects`, {
        method: "POST",
        headers,
        body: JSON.stringify(folderProjectInput({ name: "Imported history" }, root)),
      });
      expect(response.status).toBe(201);
      const project = (await response.json()) as { id: string };
      const backup = join(root, "backup");
      const tables = join(backup, "export", "tables");
      const storage = join(backup, "storage");
      mkdirSync(tables, { recursive: true });
      mkdirSync(storage);
      const session = {
        id: "old-session",
        project_id: "old-project",
        title: "Recovered approach",
        agent: "unavailable-original-agent",
        session_file_id: "history",
        status: "completed",
        created_at: "2025-01-02T03:04:05.000Z",
        updated_at: "2025-01-02T03:04:05.000Z",
      };
      writeFileSync(join(tables, "public.sessions.jsonl"), `${JSON.stringify(session)}\n`);
      writeFileSync(
        join(tables, "public.files.jsonl"),
        `${JSON.stringify({ id: "history", project_id: "old-project", file_name: "history.json", storage_path: "history.json" })}\n`,
      );
      const messages = [
        { id: "reply", role: "assistant", parts: [{ type: "text", text: "Preserved earlier answer" }] },
      ];
      writeFileSync(join(storage, "history.json"), JSON.stringify(messages));
      const mapping = join(root, "mapping.json");
      writeFileSync(mapping, JSON.stringify({ "old-project": project.id }));
      const run = (...args: string[]) => {
        const result = spawnSync(PACKAGED_BINARY_PATH, args, {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, PSTDIO_API_URL: host!.baseUrl, PSTDIO_API_TOKEN: host!.descriptor.token },
        });
        if (result.status !== 0) throw new Error(`CLI failed: ${result.stdout}\n${result.stderr}`);
        return JSON.parse(result.stdout);
      };
      const args = ["sessions", "import", "--source", backup, "--storage", storage, "--project-map", mapping];
      expect(run(...args, "--dry-run")).toMatchObject({ total: 1, ready: 1, failed: 0 });
      const wait = async (id: string) => {
        while (true) {
          const state = (await (
            await fetch(`${host!.baseUrl}/v1/session-imports/${id}`, { headers })
          ).json()) as SessionImportJob;
          if (state.status !== "running") return state;
          await Bun.sleep(10);
        }
      };
      const job = run(...args) as SessionImportJob;
      expect(await wait(job.id)).toMatchObject({ status: "completed", imported: 1, failed: 0 });
      expect(run("sessions", "imports", "status", "--id", job.id)).toMatchObject({ imported: 1 });
      expect(run("sessions", "imports", "errors", "--id", job.id)).toEqual({ errors: [], nextOffset: null });
      const again = run(...args) as SessionImportJob;
      expect(await wait(again.id)).toMatchObject({ imported: 0, skipped: 1 });
      const sessions = (await (
        await fetch(`${host.baseUrl}/v1/sessions?projectId=${project.id}`, { headers })
      ).json()) as { id: string; created_at: string }[];
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.created_at).toBe(session.created_at);
      const conversation = (await (
        await fetch(`${host.baseUrl}/v1/sessions/${sessions[0]!.id}/conversation`, { headers })
      ).json()) as { messages: unknown };
      expect(conversation.messages).toEqual(messages);
    } finally {
      if (host) await stopProcess(host.child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
