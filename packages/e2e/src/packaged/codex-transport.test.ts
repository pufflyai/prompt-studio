import { beforeAll, expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

beforeAll(buildBinary, 180_000);

test("the packaged Codex harness preserves protocol loss and independent provider failure", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-codex-transport-"));
  const bin = join(root, "bin");
  const pidPath = join(root, "peer.pid");
  const releasePath = join(root, "release");
  let child: ChildProcess | undefined;
  const peers: number[] = [];
  try {
    mkdirSync(bin);
    const compiled = Bun.spawn(
      [
        process.execPath,
        "build",
        "--compile",
        join(import.meta.dirname, "codex-transport.fixture.ts"),
        "--outfile",
        join(bin, process.platform === "win32" ? "codex.exe" : "codex"),
      ],
      { stdout: "inherit", stderr: "inherit" },
    );
    expect(await compiled.exited).toBe(0);
    const started = await startPackagedServe(root, {
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      CODEX_TRANSPORT_PID: pidPath,
      CODEX_TRANSPORT_RELEASE: releasePath,
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
        defaultExtensions: [
          {
            installName: "harness-codex",
            source: resolve(import.meta.dirname, "../../../../extensions/harness-codex"),
          },
        ],
      }),
    });
    child = started.child;
    const request = async (path: string, method = "GET", body?: unknown) => {
      const response = await fetch(`${started.baseUrl}/v1${path}`, {
        method,
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text}`);
      return JSON.parse(text);
    };
    const folder = join(root, "project");
    mkdirSync(folder);
    const project = await request("/projects", "POST", folderProjectInput({ name: "Transport" }, folder));
    const waitForStatus = async (id: string, status: string) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const session = await request(`/sessions/${id}`);
        if (session.status === status && session.agent_session_id === "transport-fixture" && existsSync(pidPath))
          return session;
        if (["completed", "failed", "cancelled", "disconnected"].includes(session.status))
          throw new Error(`Expected ${status}: ${JSON.stringify(session)}`);
        await Bun.sleep(50);
      }
      throw new Error(`Session ${id} did not reach ${status}`);
    };
    for (const [prompt, status] of [
      ["protocol failure", "disconnected"],
      ["provider failure", "failed"],
    ]) {
      rmSync(releasePath, { force: true });
      rmSync(pidPath, { force: true });
      const session = await request("/sessions", "POST", {
        project_id: project.id,
        title: prompt,
        prompt,
        model: "gpt-5.5",
        agent: "pstdio.harness-codex.harness.codex",
      });
      await waitForStatus(session.id, "in_progress");
      const pid = Number(readFileSync(pidPath, "utf8"));
      peers.push(pid);
      writeFileSync(releasePath, "release");
      const terminal = await waitForStatus(session.id, status);
      expect(terminal.agent_session_id).toBe("transport-fixture");
      if (status === "failed") expect(() => process.kill(pid, 0)).not.toThrow();
    }
  } finally {
    try {
      if (child) await stopProcess(child);
      for (const pid of peers) expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
}, 30_000);
