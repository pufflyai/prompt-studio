import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandDefinition, CommandRunContext, ExtensionStorageCollection } from "@pstdio/sdk/extensions";
import { plannerCommands } from "./commands";

const createCollection = (): ExtensionStorageCollection => {
  const values = new Map<string, unknown>();

  return {
    list: async () => [...values.entries()].map(([id, value]) => ({ id, value })),
    get: async (id) => values.get(id) ?? null,
    put: async (id, value) => {
      values.set(id, value);
    },
    delete: async (id) => {
      values.delete(id);
    },
  };
};

const createContext = (root: string): CommandRunContext => {
  const collections = new Map<string, ExtensionStorageCollection>();

  return {
    projectId: "project-1",
    params: { title: "Templated", template: "ticket", __cli: true },
    target: { type: "project", id: "project-1", projectId: "project-1" },
    project: { get: async () => ({ shorthand: "PS" }) },
    storage: {
      get: async () => null,
      set: async () => undefined,
      delete: async () => undefined,
      templatePreferences: {
        isEnabled: async () => true,
        setEnabled: async () => undefined,
      },
      skillPreferences: {
        isEnabled: async () => true,
        setEnabled: async () => undefined,
      },
      collection: (name) => {
        const existing = collections.get(name);
        if (existing) return existing;

        const collection = createCollection();
        collections.set(name, collection);
        return collection;
      },
    },
    files: {
      upload: async () => ({ id: "file-1" }),
      readContent: async () => new Uint8Array(),
      delete: async () => false,
    },
    templates: {
      get: async () => null,
    },
    repos: {
      list: async () => [{ path: root }],
      getDefault: async () => ({ path: root }),
      resolvePath: async (_repoId, relativePath) => join(root, relativePath),
    },
    workspaces: {
      list: async () => [],
      removeWorktree: async () => ({ removed: false }),
    },
    sessions: {
      create: async () => ({ id: "session-1" }),
    },
    commands: {
      run: async () => undefined,
    },
    activity: {
      record: async () => undefined,
    },
  };
};

describe("plannerCommands", () => {
  test("contributes the full ticket CLI surface", () => {
    const paths = (Object.values(plannerCommands) as CommandDefinition[])
      .map((command) => command.cli?.path)
      .filter(Boolean)
      .sort();

    expect(paths).toEqual([
      "tickets archive",
      "tickets create",
      "tickets delete",
      "tickets files",
      "tickets implement",
      "tickets list",
      "tickets pull",
      "tickets push",
      "tickets save",
      "tickets update",
      "tickets update-when-attempt-status",
      "tickets view",
      "tickets workspaces",
      "tickets worktrees list",
      "tickets worktrees remove-all",
      "tickets write",
    ]);
  });

  test("keeps --id as a pull alias for the ticket shorthand", () => {
    expect(plannerCommands.pullTickets.cli?.options).toMatchObject({
      id: { type: "string" },
      ticket_id: { type: "string" },
    });
  });

  test("writes draft ticket artifacts from templates", async () => {
    const root = mkdtempSync(join(tmpdir(), "planner-write-template-"));
    try {
      const ctx = {
        ...createContext(root),
        templates: {
          get: async (name: string) =>
            name === "ticket"
              ? {
                  name,
                  templateType: "ticket",
                  content: "# {{TICKET_TITLE}}\n\n{{USER_PROMPT}}\n{{TICKET_ID}}\n{{CREATED_AT}}",
                }
              : null,
        },
      } as CommandRunContext;

      await expect(plannerCommands.writeTicket.run(ctx)).resolves.toContain("Created ticket PS-1 (draft)");

      const content = readFileSync(join(root, ".pstdio", "tickets", "PS-1", "ticket.md"), "utf8");
      expect(content).toContain("# Templated");
      expect(content).toContain("PS-1");
      expect(content).not.toContain("{{TICKET_TITLE}}");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
