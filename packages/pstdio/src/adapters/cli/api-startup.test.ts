import { describe, expect, test } from "bun:test";
import { ensureCliApi } from "./api-startup";

describe("ensureCliApi", () => {
  test("uses --api-port for the API URL and spawned server port", async () => {
    const ensuredUrls: string[] = [];
    const env: Record<string, string | undefined> = {};

    await ensureCliApi({
      argv: { _: [], "api-port": 4511 },
      defaultApiUrl: "http://localhost:19840",
      ensureApi: async (url) => {
        ensuredUrls.push(url);
      },
      env,
    });

    expect(ensuredUrls).toEqual(["http://localhost:4511"]);
    expect(env.PSTDIO_API_PORT).toBe("4511");
  });

  test("prefers PSTDIO_API_URL without changing the server port", async () => {
    const ensuredUrls: string[] = [];
    const env: Record<string, string | undefined> = {
      PSTDIO_API_URL: "http://localhost:9000",
    };

    await ensureCliApi({
      argv: { _: [], "api-port": 4511 },
      defaultApiUrl: "http://localhost:19840",
      ensureApi: async (url) => {
        ensuredUrls.push(url);
      },
      env,
    });

    expect(ensuredUrls).toEqual(["http://localhost:9000"]);
    expect(env.PSTDIO_API_PORT).toBeUndefined();
  });

  test.each([{ _: ["close"] }, { _: ["serve"] }])("does not start the API for %p", async (argv) => {
    const ensuredUrls: string[] = [];
    const env: Record<string, string | undefined> = {};

    await ensureCliApi({
      argv,
      defaultApiUrl: "http://localhost:19840",
      ensureApi: async (url) => {
        ensuredUrls.push(url);
      },
      env,
    });

    expect(ensuredUrls).toEqual([]);
    expect(env.PSTDIO_API_PORT).toBeUndefined();
  });
});
