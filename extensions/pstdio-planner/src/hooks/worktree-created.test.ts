import { expect, test } from "bun:test";
import type { ArtifactMount, WorkspaceFilesMount } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../commands/command-context.fixture";
import { putTicket } from "../data/collections";
import type { StoredTicket } from "../data/types";
import { copyOrWriteTicketFile, worktreeCreatedHook } from "./worktree-created";

const memoryMount = (initial: Record<string, string> = {}) => {
  const files = new Map(Object.entries(initial));
  const mount = {
    exists: async (path: string) => files.has(path),
    readText: async (path: string) => files.get(path) ?? "",
    writeText: async (path: string, value: string) => void files.set(path, value),
  } as ArtifactMount;
  return { files, mount };
};

test.each(["local", "remote"])("ticket-linked %s provisioning without file mounts", async (executionKind) => {
  const storage = createMemoryStorage();
  await putTicket(storage, { id: "ticket-1", shorthand: "PS-1" } as StoredTicket);
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: { projectFiles: undefined, workspaceFiles: undefined },
  });
  const payload = { workspace: { execution_kind: executionKind, anchors_json: [{ type: "ticket", id: "ticket-1" }] } };
  const result = worktreeCreatedHook.run(ctx as never, payload as never);
  if (executionKind === "remote") await expect(result).resolves.toBeUndefined();
  else await expect(result).rejects.toThrow("Workspace file mounts are unavailable");
});

test("workspace provisioning ignores Planner ticket drafts before copying one", async () => {
  const repo = memoryMount({ ".pstdio/tickets/PS-1/ticket.md": "# Ticket" });
  const workspace = memoryMount({ ".pstdio/.gitignore": "config.json\n" });
  const ticket = { shorthand: "PS-1" } as StoredTicket;

  await copyOrWriteTicketFile({
    projectFiles: repo.mount,
    workspaceFiles: workspace.mount as WorkspaceFilesMount,
    storage: createMemoryStorage(),
    ticket,
  });

  expect(workspace.files.get(".pstdio/.gitignore")).toBe("config.json\n/tickets\n");
  expect(workspace.files.get(".pstdio/tickets/PS-1/ticket.md")).toBe("# Ticket");
});
