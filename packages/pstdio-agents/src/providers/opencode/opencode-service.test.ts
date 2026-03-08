import { afterEach, beforeEach, expect, test } from "bun:test";
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
