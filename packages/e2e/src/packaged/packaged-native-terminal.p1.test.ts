import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TerminalWebSocketServerMessage } from "pstdio-api-contracts";
import { folderProjectInput } from "../helpers/folder-project";
import { writeNativeTerminalExtension } from "../helpers/native-terminal-extension";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

setupPackagedSmokeTests();
const NativeWebSocket = globalThis.WebSocket as { new (url: string | URL, options?: Bun.WebSocketOptions): WebSocket };

test("the compiled host admits an installed SDK terminal view and reports real PTY output and exit", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "packaged-native-terminal-")));
  let child: ChildProcess | undefined;
  let socket: WebSocket | undefined;
  try {
    writeNativeTerminalExtension(root);
    const runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
    child = runtime.child;
    const headers = { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" };
    const post = async (path: string, body: unknown) => {
      const response = await fetch(`${runtime.baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      expect(response.ok).toBe(true);
      return response.json();
    };
    const project = (await post("/v1/projects", folderProjectInput({ name: "Native console" }, root))) as {
      id: string;
    };
    const installed = (await post(`/v1/projects/${project.id}/extensions/install`, {
      source: { kind: "project-folder", path: "native-terminal", development: true },
      skipInstall: true,
    })) as { extension: { id: string } };
    const metadata = await fetch(`${runtime.baseUrl}/v1/projects/${project.id}/extensions/ui`, { headers });
    const url = new URL("/v1/terminal", runtime.baseUrl);
    url.protocol = "ws:";
    socket = new NativeWebSocket(url, { headers });
    let output = "";
    const completed = Promise.withResolvers<Extract<TerminalWebSocketServerMessage, { type: "exit" }>>();
    socket.onopen = () =>
      socket!.send(
        JSON.stringify({
          type: "openView",
          request: {
            projectId: project.id,
            viewId: "example.native-terminal.view.shell",
            cols: 100,
            rows: 30,
          },
        }),
      );
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as TerminalWebSocketServerMessage;
      if (message.type === "open") {
        const command =
          process.platform === "win32" ? "echo NATIVE_COMPILED & exit 0\r" : "printf 'NATIVE_COMPILED\\n'; exit 0\n";
        socket!.send(JSON.stringify({ type: "resize", cols: 120, rows: 40 }));
        socket!.send(JSON.stringify({ type: "write", data: Buffer.from(command).toString("base64") }));
      }
      if (message.type === "data") output += Buffer.from(message.chunk, "base64").toString();
      if (message.type === "error") completed.reject(new Error(message.message));
      if (message.type === "exit") completed.resolve(message);
    };
    socket.onerror = () => completed.reject(new Error("Native terminal connection failed"));
    socket.onclose = () => completed.reject(new Error(`Native terminal closed before exit: ${output}`));
    expect(await completed.promise).toEqual({ type: "exit", code: 0, signal: null });
    expect(output).toContain("NATIVE_COMPILED");
    // The installed declaration reaches compiled metadata without a renderer entry or handles.
    expect(metadata.status).toBe(200);
    expect(await metadata.json()).toMatchObject({
      views: expect.arrayContaining([
        expect.objectContaining({
          id: "example.native-terminal.view.shell",
          body: { kind: "terminal", sessionHandlerId: "example.native-terminal.view.shell.terminal.session" },
        }),
      ]),
    });
    socket.close();
    // An admitted native view is also stopped by its actual installed owner lifecycle.
    const second = new NativeWebSocket(url, { headers });
    socket = second;
    const accepted = Promise.withResolvers<void>();
    const ownerExited = Promise.withResolvers<TerminalWebSocketServerMessage>();
    let ownerOutput = "";
    let ownerEnded = false;
    second.onopen = () =>
      second.send(
        JSON.stringify({
          type: "openView",
          request: {
            projectId: project.id,
            viewId: "example.native-terminal.view.shell",
            cols: 80,
            rows: 24,
          },
        }),
      );
    second.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as TerminalWebSocketServerMessage;
      if (message.type === "open") {
        // The marker is assembled by the shell, then a builtin blocks on input until owner cleanup.
        const hold =
          process.platform === "win32"
            ? "echo NATIVE_^OWNER_READY & set /p NATIVE_HOLD=\r"
            : "printf 'NATIVE_%s_READY\\n' OWNER; read -r native_hold\n";
        second.send(JSON.stringify({ type: "write", data: Buffer.from(hold).toString("base64") }));
      }
      if (message.type === "data") {
        ownerOutput += Buffer.from(message.chunk, "base64").toString();
        if (ownerOutput.includes("NATIVE_OWNER_READY")) accepted.resolve();
      }
      if (message.type === "exit") {
        ownerEnded = true;
        accepted.reject(new Error("Native owner exited before the live-session probe"));
        ownerExited.resolve(message);
      }
      if (message.type === "error") {
        accepted.reject(new Error(message.message));
        ownerExited.reject(new Error(message.message));
      }
    };
    await accepted.promise;
    expect(ownerEnded).toBe(false);
    const disabled = await fetch(`${runtime.baseUrl}/v1/projects/${project.id}/extensions/${installed.extension.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ enabled: false }),
    });
    expect(disabled.ok).toBe(true);
    expect((await ownerExited.promise).type).toBe("exit");
  } finally {
    socket?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
