import { describe, expect, it } from "bun:test";
import type { TicketListItem } from "../resources/ticket";
import { definePlugin } from "./define-plugin";

const trigger = () => {};

describe("definePlugin", () => {
  it("returns the plugin definition unchanged", () => {
    const plugin = definePlugin({
      key: "test-plugin",
      actions: [{ key: "do-thing", label: "Do thing", targetType: "ticket", placement: "primary", trigger }],
    });

    expect(plugin.key).toBe("test-plugin");
    expect(plugin.actions).toHaveLength(1);
    expect(plugin.actions![0]!.key).toBe("do-thing");
    expect(plugin.actions![0]!.trigger).toBe(trigger);
  });

  it("accepts a plugin with hooks only", () => {
    const plugin = definePlugin({
      key: "hooks-only",
      hooks: {
        postSessionSuccess(ctx) {
          void ctx.sessionId;
        },
      },
    });

    expect(plugin.key).toBe("hooks-only");
    expect(plugin.hooks?.postSessionSuccess).toBeDefined();
  });

  it("supports optional raw payload on hook context", () => {
    const plugin = definePlugin({
      key: "payload-aware",
      hooks: {
        postTicketArchive(ctx) {
          void ctx.id;
          void ctx.payload;
        },
      },
    });

    expect(plugin.hooks?.postTicketArchive).toBeDefined();
  });

  it("accepts a plugin with no actions and no hooks", () => {
    const plugin = definePlugin({ key: "empty" });
    expect(plugin.key).toBe("empty");
    expect(plugin.actions).toBeUndefined();
    expect(plugin.hooks).toBeUndefined();
  });

  it("accepts a plugin with actions and hooks", () => {
    const plugin = definePlugin({
      key: "full",
      actions: [
        {
          key: "refine",
          label: "Refine",
          targetType: "ticket",
          placement: "overflow",
          trigger,
        },
      ],
      hooks: {
        preTicketStatusChange(ctx) {
          if (ctx.toStatus === "done" && ctx.draft) {
            return { reject: true, reason: "Cannot mark draft as done" };
          }
        },
      },
    });

    expect(plugin.key).toBe("full");
    expect(plugin.actions).toHaveLength(1);
    expect(plugin.hooks?.preTicketStatusChange).toBeDefined();
  });

  it("narrows ctx.target to the correct type for single-target actions", () => {
    const plugin = definePlugin({
      key: "narrowing-test",
      actions: [
        {
          key: "ticket-action",
          label: "Ticket action",
          targetType: "ticket",
          placement: "primary",
          trigger(ctx) {
            // ctx.target should be TicketListItem without casting
            const _target: TicketListItem = ctx.target;
            void _target;
          },
        },
      ],
    });

    expect(plugin.actions).toHaveLength(1);
  });

  it("throws when an action is missing trigger", () => {
    expect(() =>
      definePlugin({
        key: "missing-trigger",
        actions: [
          {
            key: "refine",
            label: "Refine",
            targetType: "ticket",
            placement: "primary",
          } as never,
        ],
      }),
    ).toThrow('Action "refine" is missing trigger(ctx)');
  });

  it("accepts a plugin with schedules", () => {
    const plugin = definePlugin({
      key: "scheduled",
      schedules: [
        {
          name: "daily-sync",
          cron: "0 9 * * *",
          trigger: async () => {},
        },
      ],
    });

    expect(plugin.schedules).toHaveLength(1);
    expect(plugin.schedules![0]!.name).toBe("daily-sync");
  });

  it("accepts a plugin with actions, hooks, and schedules", () => {
    const plugin = definePlugin({
      key: "full-with-schedules",
      actions: [{ key: "run", label: "Run", targetType: "ticket", placement: "primary", trigger }],
      hooks: { postSessionStart() {} },
      schedules: [{ name: "nightly", cron: "0 0 * * *", trigger: async () => {} }],
    });

    expect(plugin.actions).toHaveLength(1);
    expect(plugin.hooks?.postSessionStart).toBeDefined();
    expect(plugin.schedules).toHaveLength(1);
  });

  it("throws when a schedule has an empty name", () => {
    expect(() =>
      definePlugin({
        key: "bad-schedule",
        schedules: [{ name: "", cron: "0 9 * * *", trigger: async () => {} }],
      }),
    ).toThrow("Schedule name must be a non-empty string");
  });

  it("throws when a schedule trigger is not a function", () => {
    expect(() =>
      definePlugin({
        key: "bad-trigger",
        schedules: [{ name: "sync", cron: "0 9 * * *", trigger: "not-a-fn" } as never],
      }),
    ).toThrow('Schedule "sync" is missing trigger(ctx)');
  });

  it("throws when schedule names are not unique within a plugin", () => {
    expect(() =>
      definePlugin({
        key: "dup-schedules",
        schedules: [
          { name: "sync", cron: "0 9 * * *", trigger: async () => {} },
          { name: "sync", cron: "0 18 * * *", trigger: async () => {} },
        ],
      }),
    ).toThrow('Duplicate schedule name "sync"');
  });

  it("throws when timeoutMs is not a positive number", () => {
    expect(() =>
      definePlugin({
        key: "bad-timeout",
        schedules: [{ name: "sync", cron: "0 9 * * *", trigger: async () => {}, timeoutMs: -1 }],
      }),
    ).toThrow('Schedule "sync" timeoutMs must be a positive finite number');
  });

  it("throws when timeoutMs is Infinity", () => {
    expect(() =>
      definePlugin({
        key: "inf-timeout",
        schedules: [{ name: "sync", cron: "0 9 * * *", trigger: async () => {}, timeoutMs: Infinity }],
      }),
    ).toThrow('Schedule "sync" timeoutMs must be a positive finite number');
  });

  it("accepts valid timeoutMs", () => {
    const plugin = definePlugin({
      key: "good-timeout",
      schedules: [{ name: "sync", cron: "0 9 * * *", trigger: async () => {}, timeoutMs: 30000 }],
    });

    expect(plugin.schedules![0]!.timeoutMs).toBe(30000);
  });
});
