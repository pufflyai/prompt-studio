import { describe, expect, test } from "bun:test";
import { defineEvent, defineExtension, defineResource, defineSlot, packageAsset, params } from "./index";

describe("defineExtension", () => {
  test("preserves a workflow-agnostic extension definition", () => {
    const workspaceHeader = defineSlot({ id: "workspace.header.primary", label: "Workspace header" });
    const workspaceCreated = defineEvent<{ workspaceId: string }>({ id: "workspace.created" });
    const workspaceResource = defineResource({ type: "workspace", label: "Workspace" });
    const source = packageAsset("../templates/default-ticket.md", import.meta.url);

    const extension = defineExtension({
      id: "local.review",
      name: "Review",
      resources: { workspace: workspaceResource },
      slots: { workspaceHeader },
      events: {
        workspaceCreated: {
          event: workspaceCreated,
          handler: async () => {},
        },
      },
      commands: {
        runReview: {
          title: "Run review",
          target: "workspace",
          params: {
            harness: params.harness({ label: "Harness" }),
            prompt: params.longText({ label: "Prompt", required: true }),
          },
          menus: [{ slot: workspaceHeader.id, order: 10 }],
          cli: {
            path: "workspaces review",
            description: "Start a review session for a workspace",
            examples: ["pstdio workspaces review --workspace <id>"],
          },
          async run() {},
        },
      },
      templateTypes: {
        ticket: {
          label: "Ticket",
          description: "Templates used for tickets.",
        },
      },
      templates: {
        defaultTicket: {
          title: "Default Ticket",
          type: "ticket",
          source,
        },
      },
      initialSetup: async () => {},
    });

    expect(extension.id).toBe("local.review");
    expect(extension.commands.runReview.params?.harness.type).toBe("harness");
    expect(extension.commands.runReview.menus?.[0]?.slot).toBe("workspace.header.primary");
    expect(extension.templates.defaultTicket.source).toEqual({
      kind: "package-asset",
      sourcePath: "../templates/default-ticket.md",
      baseUrl: import.meta.url,
    });
  });

  test("rejects command definitions without handlers", () => {
    expect(() =>
      defineExtension({
        id: "local.broken",
        name: "Broken",
        commands: {
          run: {
            title: "Run",
          } as never,
        },
      }),
    ).toThrow('Extension command "run" is missing run(ctx)');
  });
});
