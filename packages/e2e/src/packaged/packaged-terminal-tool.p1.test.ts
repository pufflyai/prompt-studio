import { expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { TerminalWebSocketServerMessage } from "pstdio-api-contracts";
import { folderProjectInput } from "../helpers/folder-project";
import { registerPendingTestProcess } from "../scripts/pending-test-processes";
import { waitForProcessReady } from "../scripts/process-readiness";
import { preparePackagedExtensionSource } from "./packaged-extension-source";
import { PACKAGED_BINARY_PATH, runPackagedAsync } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();
const NativeWebSocket = globalThis.WebSocket as { new (url: string | URL, options?: Bun.WebSocketOptions): WebSocket };

test(
  "the compiled host installs the production Terminal through public packages and opens its native shell",
  async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "packaged-terminal-tool-")));
    let child: ChildProcess | undefined;
    let socket: WebSocket | undefined;
    try {
      const source = await preparePackagedExtensionSource(
        join(root, "source"),
        join(import.meta.dir, "../../../../extensions/pstdio-terminal"),
      );
      const folder = join(root, "project");
      mkdirSync(folder);
      const runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
      child = runtime.child;
      const headers = { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" };
      const request = async (path: string, body?: unknown) => {
        const response = await fetch(`${runtime.baseUrl}/v1${path}`, {
          headers,
          ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
        });
        const text = await response.text();
        expect(response.ok, `${path}: ${text}`).toBe(true);
        return text ? JSON.parse(text) : null;
      };
      const project = await request("/projects", folderProjectInput({ name: "Installed Terminal" }, folder));
      const env = { PSTDIO_HOME: root, PSTDIO_API_URL: runtime.baseUrl, PSTDIO_API_TOKEN: runtime.descriptor.token };
      const dev = spawn(PACKAGED_BINARY_PATH, ["extensions", "dev", source, "--name", "pstdio-terminal"], {
        cwd: folder,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      dev.stdout?.on("data", (chunk) => {
        output += chunk;
      });
      dev.stderr?.on("data", (chunk) => {
        output += chunk;
      });
      const lifetime = registerPendingTestProcess(dev);
      try {
        await waitForProcessReady(dev, "Terminal tool dev", async () =>
          output.includes(`watching ${source}`) ? true : undefined,
        );
        expect(output).toContain("validated pstdio.pstdio-terminal");
      } finally {
        try {
          await stopProcess(dev);
        } finally {
          lifetime.finish();
        }
      }
      console.log(
        await runPackagedAsync(["extensions", "add", source, "--force", "--name", "pstdio-terminal"], folder, env),
      );
      const listing = await request(`/projects/${project.id}/extensions`);
      const owner = listing.extensions.find(
        (extension: { extensionId: string }) => extension.extensionId === "pstdio.pstdio-terminal",
      );
      expect(owner).toMatchObject({ enabled: true, status: "loaded" });
      const dependency = realpathSync(join(owner.sourcePath, "node_modules/@pstdio/sdk"));
      expect(relative(join(owner.sourcePath, "node_modules"), dependency).startsWith("..")).toBe(false);
      renameSync(source, `${source}.unavailable`);
      const metadata = await request(`/projects/${project.id}/extensions/ui`);
      expect(metadata.views).toContainEqual(
        expect.objectContaining({
          id: "pstdio.pstdio-terminal.view.terminal",
          body: expect.objectContaining({ kind: "terminal" }),
        }),
      );
      const workspace = (await request(`/workspaces?project_id=${project.id}`)).find(
        (entry: { is_default: boolean }) => entry.is_default,
      );
      const url = new URL("/v1/terminal", runtime.baseUrl);
      url.protocol = "ws:";
      socket = new NativeWebSocket(url, { headers });
      const finished = Promise.withResolvers<TerminalWebSocketServerMessage>();
      let terminalOutput = "";
      socket.onopen = () =>
        socket!.send(
          JSON.stringify({
            type: "openView",
            request: {
              projectId: project.id,
              viewId: "pstdio.pstdio-terminal.view.terminal",
              cols: 80,
              rows: 24,
              resource: {
                type: "terminal",
                id: "installed-shell",
                extensionId: "pstdio.pstdio-terminal",
                projectId: project.id,
                metadata: { workspaceId: workspace.id },
              },
            },
          }),
        );
      socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as TerminalWebSocketServerMessage;
        if (message.type === "open") {
          const command =
            process.platform === "win32"
              ? "echo TERMINAL_TOOL & cd & exit 0\r"
              : "printf 'TERMINAL_TOOL\\n'; pwd; exit 0\n";
          socket!.send(JSON.stringify({ type: "resize", cols: 120, rows: 40 }));
          socket!.send(JSON.stringify({ type: "write", data: Buffer.from(command).toString("base64") }));
        }
        if (message.type === "data") terminalOutput += Buffer.from(message.chunk, "base64").toString();
        if (message.type === "error") finished.reject(new Error(message.message));
        if (message.type === "exit") finished.resolve(message);
      };
      socket.onerror = () => finished.reject(new Error("Installed terminal connection failed"));
      socket.onclose = () => finished.reject(new Error(`Installed terminal closed before exit: ${terminalOutput}`));
      expect(await finished.promise).toEqual({ type: "exit", code: 0, signal: null });
      expect(terminalOutput).toContain("TERMINAL_TOOL");
      expect(terminalOutput.replaceAll("\\", "/")).toContain(folder.replaceAll("\\", "/"));
    } finally {
      socket?.close();
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
