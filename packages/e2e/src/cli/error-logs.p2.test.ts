import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: "[]" } });
}, SETUP_TIMEOUT);

afterAll(async () => {
  await api?.stop();
});

describe("API error handling", () => {
  test(
    "returns 400 for invalid request body",
    async () => {
      const res = await fetch(`${api.url}/v1/projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBeLessThan(500);
      expect(res.status).toBeGreaterThanOrEqual(400);
    },
    TEST_TIMEOUT,
  );
});
