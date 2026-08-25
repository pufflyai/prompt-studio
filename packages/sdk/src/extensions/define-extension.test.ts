import { describe, expect, test } from "bun:test";
import { workspaceEvents } from "pstdio-api-contracts/extension-kernel";
import { defineExtension } from "./define-extension";

describe("defineExtension", () => {
  test("preserves contribution literals", () => {
    const extension = defineExtension({
      commands: {
        hello: {
          title: "Hello",
          async run(_ctx, _commandParams) {
            return { ok: true };
          },
        },
      },
    });

    expect(extension.commands!.hello.title).toBe("Hello");
  });

  test("supports kernel lifecycle event hooks with workspace file helpers", () => {
    const extension = defineExtension({
      hooks: {
        provision: {
          event: workspaceEvents.provision,
          async handler(ctx, _payload) {
            await ctx.workspaceFiles?.syncDir(".claude/skills", []);
          },
        },
      },
    });

    expect(extension.hooks!.provision.event?.id).toBe("workspace.provision");
  });
});

// @ts-expect-error identity must live in package.json
defineExtension({ id: "pstdio.extension-lab" });

// @ts-expect-error package name must live in package.json
defineExtension({ name: "extension-lab" });

// @ts-expect-error namespace has been removed
defineExtension({ namespace: "lab" });

// @ts-expect-error extensions cannot contribute host slots
defineExtension({ slots: {} });

// @ts-expect-error package version must live in package.json
defineExtension({ version: "1.0.0" });

// @ts-expect-error engines.pstdio replaces apiVersion in package.json
defineExtension({ apiVersion: "1" });
