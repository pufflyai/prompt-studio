import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import type { PromptStudioDesktopApi } from "../desktop-api";
import { waitForLifecyclePage, waitForWorkbenchPage } from "./desktop-pages";

const require = createRequire(import.meta.url);
const electronPath = require("electron") as string;

test("trusted Save as returns cancellation, saves exact bytes, and recovers from a write failure", async () => {
  const home = await mkdtemp(join(tmpdir(), "desktop-file-save-"));
  const destination = join(home, "wave.svg");
  const streams = new Set<import("node:http").ServerResponse>();
  const server = createServer((request, response) => {
    if (request.url === "/runtime/events") {
      response.setHeader("content-type", "text/event-stream");
      response.write(": ready\n\n");
      streams.add(response);
      response.on("close", () => streams.delete(response));
      return;
    }
    response.setHeader("content-type", "application/json");
    if (request.url === "/runtime/ready") {
      response.end(
        JSON.stringify({ ok: true, protocolVersion: 1, instanceId: "save-runtime", ownerType: "persistent" }),
      );
    } else if (request.url === "/runtime/browser-login") {
      response.end(JSON.stringify({ url: `http://${request.headers.host}/#browser-login=save-code` }));
    } else {
      response.setHeader("content-type", "text/html");
      response.end('<!doctype html><main id="root">Device export host</main>');
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Save fixture did not bind");
  const origin = `http://127.0.0.1:${address.port}`;
  await writeFile(
    join(home, "runtime.json"),
    JSON.stringify({
      schemaVersion: 1,
      protocolVersion: 1,
      pid: process.pid,
      instanceId: "save-runtime",
      ownerType: "persistent",
      origin,
      token: "save-secret",
      appVersion: "0.48.0",
      startedAt: new Date().toISOString(),
    }),
  );
  const env = Object.fromEntries(
    Object.entries({ ...process.env, PSTDIO_HOME: home }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const application = await electron.launch({
    executablePath: electronPath,
    args: [resolve(import.meta.dirname, "../../dist/main.js"), `--user-data-dir=${join(home, "profile")}`],
    env,
  });
  try {
    const lifecycle = await waitForLifecyclePage(application.context());
    const page = await waitForWorkbenchPage(lifecycle, origin);
    await application.evaluate(({ dialog }) => {
      Object.assign(dialog, { showSaveDialog: async () => ({ canceled: true, filePath: "" }) });
    });
    const save = () =>
      page.evaluate(async () => {
        const bridge = (window as unknown as { promptStudioDesktop: PromptStudioDesktopApi }).promptStudioDesktop;
        return bridge.saveFile({
          name: "great-wave.svg",
          data: new TextEncoder().encode("<svg>Våg</svg>"),
          mimeType: "image/svg+xml",
        });
      });
    expect(await save()).toEqual({ status: "cancelled" });
    await application.evaluate(
      ({ dialog }, path) => {
        Object.assign(dialog, { showSaveDialog: async () => ({ canceled: false, filePath: path }) });
      },
      join(home, "missing", "wave.svg"),
    );
    let message = "";
    try {
      await save();
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain("Could not save");
    expect(message).not.toContain(home);
    await application.evaluate(({ dialog }, path) => {
      Object.assign(dialog, {
        showSaveDialog: async (_window: unknown, options: { defaultPath: string }) => {
          if (options.defaultPath !== "great-wave.svg") throw new Error("Wrong suggested filename");
          return { canceled: false, filePath: path };
        },
      });
    }, destination);
    expect(await save()).toEqual({ status: "saved" });
    expect(await readFile(destination, "utf8")).toBe("<svg>Våg</svg>");
  } finally {
    await application.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await application.close().catch(() => {});
    for (const response of streams) response.end();
    await new Promise<void>((done) => server.close(() => done()));
    await rm(home, { recursive: true, force: true });
  }
});
