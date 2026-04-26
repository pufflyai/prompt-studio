import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apiLogger } from "../../lib/logger";
import { createPluginService } from "../plugins/plugin-service";
import { fireTicketHook, fireTicketHookAsync } from "./ticket-hooks";

let repoDir: string;

beforeEach(async () => {
  repoDir = await realpath(await mkdtemp(join(tmpdir(), "pstdio-ticket-hooks-test-")));
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

const writePlugin = (fileName: string, code: string) => {
  const pluginsDir = join(repoDir, ".pstdio", "plugins");
  mkdirSync(pluginsDir, { recursive: true });
  writeFileSync(join(pluginsDir, fileName), code);
};

const makeDeps = () => ({
  pluginService: createPluginService({
    repoService: { listByProject: async () => [{ path: repoDir }] },
    listProjectIds: async () => ["proj-1"],
    filesRoot: "",
    storageRoot: repoDir,
    ensureWorkspace: async () => {},
  }),
});

describe("fireTicketHook", () => {
  test("pre-hook can reject", async () => {
    writePlugin(
      "guard.ts",
      `export default { hooks: { preTicketCreation: () => ({ reject: true, reason: "Missing description" }) } };`,
    );

    const result = await fireTicketHook(makeDeps(), "preTicketCreation", "proj-1", {
      title: "Incomplete",
    });

    expect(result.rejected).toBe(true);
    expect(result.stderr).toContain("Missing description");
  });

  test("allows when no plugins exist", async () => {
    const result = await fireTicketHook(makeDeps(), "preTicketCreation", "proj-1", {
      title: "Test",
    });

    expect(result.rejected).toBe(false);
  });

  test("pre-hook passes when handler does not reject", async () => {
    writePlugin("pass.ts", `export default { hooks: { preTicketDeletion: () => {} } };`);

    const result = await fireTicketHook(makeDeps(), "preTicketDeletion", "proj-1", {
      id: "TK-1",
    });

    expect(result.rejected).toBe(false);
  });

  test("async post-hook logs dispatch failures instead of swallowing them", async () => {
    const errorSpy = spyOn(apiLogger, "error").mockImplementation(() => {});

    fireTicketHookAsync(
      {
        pluginService: {
          getForProject: async () => ({
            hooks: {
              firePre: async () => ({ rejected: false }),
              firePost: async () => {
                throw new Error("ticket hook dispatch failed");
              },
            },
            client: {},
          }),
        } as never,
      },
      "postTicketCreation",
      "proj-1",
      { ticketId: "t1" },
    );

    await Bun.sleep(10);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: "hooks.ticket_post.dispatch_failed", error: "ticket hook dispatch failed" }),
      "ticket hook dispatch failed",
    );

    errorSpy.mockRestore();
  });
});
