import { expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { writeCommandStreamExtension } from "../helpers/command-stream-extension";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerCommandStreamSmokeTests = () => {
  test("packaged commands stream chunks and their final outcome", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-command-stream-"));
    let child: ChildProcess | null = null;
    try {
      writeCommandStreamExtension(root);
      const started = await startPackagedServe(root);
      child = started.child;
      const headers = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
      const created = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers,
        body: JSON.stringify(folderProjectInput({ name: "Streams" }, root)),
      });
      expect(created.status).toBe(201);
      const project = (await created.json()) as { id: string };
      const client = createClient({ baseUrl: started.baseUrl, token: started.descriptor.token });
      const events = await Array.fromAsync(
        client.extensions.stream("test.stream-fixture.command.progress", { projectId: project.id }),
      );
      expect(events.slice(0, 3)).toEqual([1, 2, 3].map((done) => ({ type: "data", data: { done, total: 3 } })));
      expect(events.at(-1)).toMatchObject({ type: "end", response: { outcome: { ok: true, value: { total: 3 } } } });
      const cli = spawnSync(
        PACKAGED_BINARY_PATH,
        ["stream-fixture", "progress", "--project-id", project.id, "--stream"],
        {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            PSTDIO_API_URL: started.baseUrl,
            PSTDIO_API_TOKEN: started.descriptor.token,
            PSTDIO_HOME: root,
          },
        },
      );
      expect(cli.status, cli.stderr).toBe(0);
      const lines = cli.stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(lines).toHaveLength(4);
      expect(lines[0]).toEqual({ type: "data", data: { done: 1, total: 3 } });
      expect(lines.at(-1)).toMatchObject({ type: "end", outcome: { ok: true, value: { total: 3 } } });
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  });
};
