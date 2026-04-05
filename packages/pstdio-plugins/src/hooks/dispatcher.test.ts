import { describe, expect, test } from "bun:test";
import { createHookDispatcher } from "./dispatcher";

describe("createHookDispatcher", () => {
  describe("firePreHook", () => {
    test("returns not rejected when no handlers registered", async () => {
      const dispatcher = createHookDispatcher();
      const result = await dispatcher.firePreHook("preTicketCreation", {});
      expect(result).toEqual({ rejected: false });
    });

    test("runs handlers sequentially and returns not rejected when all pass", async () => {
      const dispatcher = createHookDispatcher();
      const order: number[] = [];

      dispatcher.register("preTicketCreation", async () => {
        order.push(1);
      });
      dispatcher.register("preTicketCreation", async () => {
        order.push(2);
      });

      const result = await dispatcher.firePreHook("preTicketCreation", {});
      expect(result).toEqual({ rejected: false });
      expect(order).toEqual([1, 2]);
    });

    test("stops at first rejection and returns reason", async () => {
      const dispatcher = createHookDispatcher();
      const order: number[] = [];

      dispatcher.register("preTicketDeletion", async () => {
        order.push(1);
        return { reject: true, reason: "not allowed" };
      });
      dispatcher.register("preTicketDeletion", async () => {
        order.push(2);
      });

      const result = await dispatcher.firePreHook("preTicketDeletion", {});
      expect(result).toEqual({ rejected: true, reason: "not allowed" });
      expect(order).toEqual([1]);
    });

    test("treats handler error as rejection", async () => {
      const dispatcher = createHookDispatcher();

      dispatcher.register("preCommit", () => {
        throw new Error("boom");
      });

      const result = await dispatcher.firePreHook("preCommit", {});
      expect(result).toEqual({ rejected: true, reason: "boom" });
    });

    test("passes context to handlers", async () => {
      const dispatcher = createHookDispatcher();
      let received: unknown;

      dispatcher.register("preTicketCreation", (ctx) => {
        received = ctx;
      });

      const ctx = { id: "t1", title: "test" };
      await dispatcher.firePreHook("preTicketCreation", ctx);
      expect(received).toBe(ctx);
    });

    test("collects data from non-rejecting handlers", async () => {
      const dispatcher = createHookDispatcher();

      dispatcher.register("preTicketCreation", () => ({ data: { priority: "high" } }));
      dispatcher.register("preTicketCreation", () => ({ data: { label: "urgent" } }));

      const result = await dispatcher.firePreHook("preTicketCreation", {});
      expect(result.rejected).toBe(false);
      expect(result.data).toEqual({ priority: "high", label: "urgent" });
    });

    test("does not include data when handler rejects", async () => {
      const dispatcher = createHookDispatcher();

      dispatcher.register("preTicketCreation", () => ({ data: { priority: "high" } }));
      dispatcher.register("preTicketCreation", () => ({ reject: true, reason: "nope" }));

      const result = await dispatcher.firePreHook("preTicketCreation", {});
      expect(result.rejected).toBe(true);
      expect(result.data).toBeUndefined();
    });

    test("returns no data when handlers return void", async () => {
      const dispatcher = createHookDispatcher();

      dispatcher.register("preTicketCreation", () => {});

      const result = await dispatcher.firePreHook("preTicketCreation", {});
      expect(result.rejected).toBe(false);
      expect(result.data).toBeUndefined();
    });
  });

  describe("firePostHook", () => {
    test("resolves when no handlers registered", async () => {
      const dispatcher = createHookDispatcher();
      await dispatcher.firePostHook("postTicketCreation", {});
    });

    test("runs all handlers concurrently", async () => {
      const dispatcher = createHookDispatcher();
      const results: number[] = [];

      dispatcher.register("postSessionStart", async () => {
        results.push(1);
      });
      dispatcher.register("postSessionStart", async () => {
        results.push(2);
      });

      await dispatcher.firePostHook("postSessionStart", {});
      expect(results).toHaveLength(2);
      expect(results).toContain(1);
      expect(results).toContain(2);
    });

    test("swallows handler errors without throwing", async () => {
      const dispatcher = createHookDispatcher();
      let secondRan = false;

      dispatcher.register("postSessionFail", () => {
        throw new Error("handler failed");
      });
      dispatcher.register("postSessionFail", async () => {
        secondRan = true;
      });

      await dispatcher.firePostHook("postSessionFail", {});
      expect(secondRan).toBe(true);
    });

    test("passes context to handlers", async () => {
      const dispatcher = createHookDispatcher();
      let received: unknown;

      dispatcher.register("postCommit", (ctx) => {
        received = ctx;
      });

      const ctx = { sha: "abc123" };
      await dispatcher.firePostHook("postCommit", ctx);
      expect(received).toBe(ctx);
    });
  });

  describe("isolation", () => {
    test("handlers for one hook do not fire for another", async () => {
      const dispatcher = createHookDispatcher();
      let called = false;

      dispatcher.register("preTicketCreation", () => {
        called = true;
      });

      await dispatcher.firePreHook("preTicketDeletion", {});
      expect(called).toBe(false);
    });
  });
});
