import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { ticketFilesDir, ticketMarkdownPath } from "../data/draft-storage";
import { applyTicketTemplateCommand } from "./apply-ticket-template";
import { makeCommandArgs } from "./command-context.fixture";
import { listTicketFilesCommand } from "./list-ticket-files";
import { pullTicketCommand } from "./pull-ticket";
import { writeTicketCommand } from "./write-ticket";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("ticket draft commands return usable project paths when the selected workspace is elsewhere", async () => {
  const root = await mkdtemp(join(tmpdir(), "ticket-draft-location-"));
  roots.push(root);
  const storage = createMemoryStorage();
  const memory = createMemoryRepoFiles();
  const projectRoot = join(root, "project");
  const projectFiles = {
    ...memory,
    async writeText(path: string, content: string) {
      await mkdir(dirname(join(projectRoot, path)), { recursive: true });
      await writeFile(join(projectRoot, path), content);
      await memory.writeText(path, content);
    },
  };
  const overrides = {
    workspaceId: "selected-workspace",
    projectFiles,
    workspaces: {
      getDefault: async () => ({ id: "home", execution_kind: "local" as const, root_path: projectRoot }),
      get: async () => ({ id: "selected-workspace", root_path: join(root, "selected") }),
    },
  };
  const written = await writeTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Draft" }, overrides }));
  const path = join(projectRoot, ticketMarkdownPath(written.shorthand));
  expect(written.path).toBe(path);
  expect(await readFile(written.path, "utf8")).toBe(await projectFiles.readText(ticketMarkdownPath(written.shorthand)));
  const applied = await applyTicketTemplateCommand.run(
    ...makeCommandArgs({ storage, params: { id: written.shorthand, template: "proposal" }, overrides }),
  );
  expect(applied.path).toBe(path);
  const skipped = await pullTicketCommand.run(
    ...makeCommandArgs({ storage, params: { id: written.shorthand }, overrides }),
  );
  expect(skipped).toMatchObject({ skipped: true, path });
  const pulled = await pullTicketCommand.run(
    ...makeCommandArgs({ storage, params: { id: written.shorthand, force: true }, overrides }),
  );
  expect(pulled).toMatchObject({ skipped: false, path });
  const attachment = `${ticketFilesDir(written.shorthand)}/notes.md`;
  await projectFiles.writeText(attachment, "Project evidence");
  const files = await listTicketFilesCommand.run(
    ...makeCommandArgs({ storage, params: { id: written.shorthand }, overrides }),
  );
  expect(files[0].path).toBe(join(projectRoot, attachment));
  expect(await readFile(files[0].path, "utf8")).toBe("Project evidence");
});

test.each([
  "remote",
  "missing",
])("ticket draft creation rejects a %s default target before changing data", async (target) => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
  await expect(
    writeTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: { title: "Unavailable" },
        overrides: {
          projectFiles,
          workspaces: {
            getDefault: async () =>
              target === "remote"
                ? { id: "home", execution_kind: "remote", root_path: resolve("stale-local-root") }
                : { id: "home", execution_kind: "local", root_path: null },
          },
        },
      }),
    ),
  ).rejects.toThrow("local project folder");
  expect(await ticketsCollection(storage).list()).toEqual([]);
  expect(await projectFiles.list()).toEqual([]);
});
