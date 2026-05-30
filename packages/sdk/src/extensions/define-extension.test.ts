import { describe, expect, test } from "bun:test";
import { defineExtension } from "./define-extension";
import { ticketEvents, worktreeEvents } from "./kernel-slots";

describe("defineExtension", () => {
  test("preserves contribution literals", () => {
    const extension = defineExtension({
      commands: {
        hello: {
          title: "Hello",
          async run() {
            return { ok: true };
          },
        },
      },
    });

    expect(extension.commands!.hello.title).toBe("Hello");
  });

  test("supports kernel lifecycle event hooks with worktree helpers", () => {
    const extension = defineExtension({
      hooks: {
        worktreeCreated: {
          event: worktreeEvents.created,
          async handler(ctx, event) {
            await ctx.worktrees.bootstrap({
              repoPath: event.repoPath,
              worktreePath: event.worktreePath,
              ticketId: event.ticket,
            });
          },
        },
        ticketArchived: {
          event: ticketEvents.archived,
          async handler(ctx, event) {
            await ctx.worktrees.removeAllForTicket({ ticketId: event.ticket.id });
          },
        },
      },
    });

    expect(extension.hooks!.worktreeCreated.event?.id).toBe("worktree.created");
    expect(extension.hooks!.ticketArchived.event?.id).toBe("ticket.archived");
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
