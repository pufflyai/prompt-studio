import { expect, test } from "bun:test";
import type { ArtifactMount, WorkspaceFilesMount } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "../data/memory-storage";
import type { StoredTicket } from "../data/types";
import { copyOrWriteTicketFile } from "./worktree-created";

const memoryMount = (initial: Record<string, string> = {}) => {
  const files = new Map(Object.entries(initial));
  const mount = {
    exists: async (path: string) => files.has(path),
    readText: async (path: string) => files.get(path) ?? "",
    writeText: async (path: string, value: string) => void files.set(path, value),
  } as ArtifactMount;
  return { files, mount };
};

test("workspace provisioning ignores Planner ticket drafts before copying one", async () => {
  const repo = memoryMount({ ".pstdio/tickets/PS-1/ticket.md": "# Ticket" });
  const workspace = memoryMount({ ".pstdio/.gitignore": "config.json\n" });
  const ticket = { shorthand: "PS-1" } as StoredTicket;

  await copyOrWriteTicketFile({
    repoFiles: repo.mount,
    workspaceFiles: workspace.mount as WorkspaceFilesMount,
    storage: createMemoryStorage(),
    ticket,
  });

  expect(workspace.files.get(".pstdio/.gitignore")).toBe("config.json\n/tickets\n");
  expect(workspace.files.get(".pstdio/tickets/PS-1/ticket.md")).toBe("# Ticket");
});
