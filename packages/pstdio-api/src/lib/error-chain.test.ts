import { describe, expect, test } from "bun:test";
import { flattenErrorChain } from "./error-chain";

describe("flattenErrorChain", () => {
  test("returns a single entry when there is no cause", () => {
    const chain = flattenErrorChain(new Error("boom"));
    expect(chain).toHaveLength(1);
    expect(chain[0].message).toBe("boom");
  });

  test("walks nested causes", () => {
    const root = new Error("pg: null value in column");
    const middle = new Error("Failed query");
    (middle as Error & { cause?: unknown }).cause = root;
    const top = new Error("DB write failed");
    (top as Error & { cause?: unknown }).cause = middle;

    const chain = flattenErrorChain(top);
    expect(chain.map((entry) => entry.message)).toEqual([
      "DB write failed",
      "Failed query",
      "pg: null value in column",
    ]);
  });

  test("captures known driver fields like code/detail/constraint", () => {
    const driverError = Object.assign(new Error("violates not-null"), {
      code: "23502",
      detail: "actor_id cannot be null",
      constraint: "activity_events_actor_id_check",
    });
    const wrapper = new Error("Failed query");
    (wrapper as Error & { cause?: unknown }).cause = driverError;

    const chain = flattenErrorChain(wrapper);
    expect(chain[1].extra).toMatchObject({
      code: "23502",
      detail: "actor_id cannot be null",
      constraint: "activity_events_actor_id_check",
    });
  });

  test("stops at the depth limit", () => {
    let current: Error & { cause?: unknown } = new Error("deepest");
    for (let i = 0; i < 10; i += 1) {
      const next: Error & { cause?: unknown } = new Error(`level-${i}`);
      next.cause = current;
      current = next;
    }
    const chain = flattenErrorChain(current, 3);
    expect(chain).toHaveLength(3);
  });
});
