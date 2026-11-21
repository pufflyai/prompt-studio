import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { e2eExtensions } from "../default-extensions";
import { cleanupDirs } from "./helpers";
import { createInitializedRepo, createWorkspaceInRepo, type HookTestContext, waitForPath } from "./hooks-infra";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
const ctx: HookTestContext = { api: null!, dirs: [] };

beforeAll(async () => {
  api = await startApi({
    env: { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("pstdio-planner", "workbench-fixture", "pstdio-workspaces") },
  });
  ctx.api = api;
}, SETUP_TIMEOUT);

afterAll(async () => {
  await api?.stop();
});

afterEach(() => {
  cleanupDirs(ctx.dirs);
});

const createRepoWithDefaultExtensions = () => {
  return createInitializedRepo(ctx, "worktree-setup-e2e");
};

describe("workspace provisioning", () => {
  test(
    "provisions worktree config and copies the ticket file",
    async () => {
      const repo = createRepoWithDefaultExtensions();

      const { workspace, ticketShorthand } = await createWorkspaceInRepo(ctx, repo);
      expect(workspace.root_path).toBeTruthy();

      const worktreePath = workspace.root_path!;
      expect(await waitForPath(join(worktreePath, ".pstdio", "config.json"))).toBe(true);
      const ticketPath = join(
        worktreePath,
        ".pstdio",
        "extension-storage",
        "pstdio.planner",
        "tickets",
        ticketShorthand,
        "ticket.md",
      );
      expect(await waitForPath(ticketPath)).toBe(true);
      expect(readFileSync(ticketPath, "utf8")).toContain("Hook test ticket");
    },
    TEST_TIMEOUT,
  );
});
