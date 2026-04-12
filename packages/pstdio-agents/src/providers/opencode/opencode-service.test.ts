import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOpencodeService } from "./opencode-service";

let customHome: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

beforeEach(() => {
  customHome = mkdtempSync(join(tmpdir(), "pstdio-opencode-home-"));
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  process.env.HOME = customHome;
  process.env.USERPROFILE = customHome;
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;

  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;

  rmSync(customHome, { recursive: true, force: true });
});

describe("request timeouts", () => {
  const noopServerStore = { read: async () => null, write: async () => {}, clear: async () => {} };

  test("GET timeout retries through withServerUrl attach path", async () => {
    let getCalls = 0;
    const service = createOpencodeService({
      startServer: async () => "http://127.0.0.1:4900",
      serverStore: { read: async () => "http://127.0.0.1:4900", write: async () => {}, clear: async () => {} },
      isPortOpen: async () => true,
      pingServer: async () => true,
      fetcher: async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url.includes("/session/")) {
          getCalls++;
          if (getCalls <= 1) {
            throw new DOMException("The operation was aborted", "AbortError");
          }
          return new Response(JSON.stringify([]));
        }

        throw new Error(`Unexpected: ${method} ${url}`);
      },
    });

    // First call fails (AbortError), withServerUrl retries with fresh server
    const messages = await service.getSessionMessages("session-1", "/repo");
    expect(messages).toEqual([]);
    expect(getCalls).toBe(2);
  });

  test("POST timeout does not produce a terminal error", async () => {
    const service = createOpencodeService({
      startServer: async () => "http://127.0.0.1:4900",
      serverStore: noopServerStore,
      isPortOpen: async () => false,
      pingServer: async () => false,
      fetcher: async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "POST" && url.includes("/session?")) {
          return new Response(JSON.stringify({ id: "session-1" }));
        }

        if (method === "POST" && url.includes("/session/session-1/message")) {
          throw new DOMException("The operation was aborted", "AbortError");
        }

        throw new Error(`Unexpected: ${method} ${url}`);
      },
    });

    const result = await service.startSession({ prompt: "hello", cwd: "/repo" });
    // messageComplete rejects, but the error is a timeout — not a provider failure
    const error = await result.messageComplete.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe("AbortError");
  });

  test("POST explicit HTTP error remains terminal", async () => {
    const service = createOpencodeService({
      startServer: async () => "http://127.0.0.1:4900",
      serverStore: noopServerStore,
      isPortOpen: async () => false,
      pingServer: async () => false,
      fetcher: async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "POST" && url.includes("/session?")) {
          return new Response(JSON.stringify({ id: "session-1" }));
        }

        if (method === "POST" && url.includes("/session/session-1/message")) {
          return new Response("Internal Server Error", { status: 500 });
        }

        throw new Error(`Unexpected: ${method} ${url}`);
      },
    });

    const result = await service.startSession({ prompt: "hello", cwd: "/repo" });
    // messageComplete should reject with the HTTP 500 error
    await expect(result.messageComplete).rejects.toThrow("500");
  });
});

test("createOpencodeService stores discovered server url under ~/.pstdio", async () => {
  const service = createOpencodeService({
    startServer: async () => "http://127.0.0.1:4900",
    isPortOpen: async () => false,
    pingServer: async () => false,
    fetcher: async (input) => {
      const url = String(input);

      if (url.includes("/session?")) {
        return new Response(JSON.stringify({ id: "session-1" }));
      }

      if (url.includes("/session/session-1/message?")) {
        return new Response(JSON.stringify({ info: {}, parts: [] }));
      }

      throw new Error(`Unexpected request URL: ${url}`);
    },
  });

  await service.startSession({ prompt: "Start session", cwd: customHome });

  const storePath = join(customHome, ".pstdio", "opencode-server.txt");
  const storedServerUrl = readFileSync(storePath, "utf8").trim();
  expect(storedServerUrl).toBe("http://127.0.0.1:4900");
});
