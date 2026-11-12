import { expect, test } from "bun:test";
import { PstdioConnectionError } from "../client/request";
import { createScopedQueryClient } from "./scoped-query";

for (const loaded of [false, true]) {
  test(`imperative connection failures settle with ${loaded ? "retained data" : "no snapshot"}`, async () => {
    const queries = createScopedQueryClient({ runtimeId: "runtime", extensionId: "catalog" });
    const failure = new PstdioConnectionError(new TypeError("Failed to fetch"));
    let attempts = 0;
    const query = queries.query<string>({
      id: "metadata",
      read: () => {
        attempts++;
        throw failure;
      },
    });
    if (loaded) query.accept("Loaded metadata");
    query.invalidate();
    try {
      await expect(query.read()).rejects.toBe(failure);
      expect(attempts).toBe(1);
      expect(query.getSnapshot()).toMatchObject({
        data: loaded ? "Loaded metadata" : undefined,
        error: failure,
        fetching: false,
      });
    } finally {
      queries.dispose();
    }
  });
}
