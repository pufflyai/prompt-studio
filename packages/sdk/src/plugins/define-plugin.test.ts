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
});
