import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { enableCoreTemplatesExtension, enableCoreTicketsExtension } from "./extension-helpers";
import { cleanupDirs, createGitRepo, runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi();
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

const dirs: string[] = [];

afterEach(() => {
  cleanupDirs(dirs);
});

const run = (args: string, cwd: string) => runPstdio(args, cwd, { PSTDIO_API_URL: api.url });

const runSafe = (args: string, cwd: string) => runPstdioSafe(args, cwd, { PSTDIO_API_URL: api.url });

const createInitializedRepo = (name: string) => {
  const repo = createGitRepo();
  dirs.push(repo);
  run(`projects create ${name}`, repo);
  return repo;
};

const readProjectId = (repo: string) => {
  const config = JSON.parse(readFileSync(join(repo, ".pstdio", "config.json"), "utf8")) as { project_id: string };
  return config.project_id;
};

describe("pstdio templates list", () => {
  test(
    "shows default markers",
    () => {
      const repo = createInitializedRepo("tpl-defaults");

      const tplFile = join(repo, "default.md");
      writeFileSync(tplFile, "# Default");
      run(`templates create --name default-doc --type document --file ${tplFile} --default`, repo);

      const output = run("templates list", repo);
      expect(output).toContain("default-doc");
      expect(output).toContain("*");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails outside a pstdio project",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      const result = runSafe("templates list", repo);
      expect(result.exitCode).not.toBe(0);
    },
    TEST_TIMEOUT,
  );
});

describe("pstdio templates create", () => {
  test(
    "creates a custom template from file",
    () => {
      const repo = createInitializedRepo("tpl-create");

      const tplFile = join(repo, "my-template.md");
      writeFileSync(tplFile, "# {{TICKET_TITLE}}\n\nCustom template content");

      const output = run(`templates create --name custom --type document --file ${tplFile}`, repo);
      expect(output).toContain('Created template "custom" (document)');

      const listOutput = run("templates list", repo);
      expect(listOutput).toContain("custom");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails for duplicate name",
    () => {
      const repo = createInitializedRepo("tpl-create-dup");

      const tplFile = join(repo, "dup.md");
      writeFileSync(tplFile, "# duplicate");

      run(`templates create --name my-tpl --type ticket --file ${tplFile}`, repo);

      const result = runSafe(`templates create --name my-tpl --type ticket --file ${tplFile}`, repo);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("already exists");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails for invalid type",
    () => {
      const repo = createInitializedRepo("tpl-create-badtype");

      const tplFile = join(repo, "bad.md");
      writeFileSync(tplFile, "# bad");

      const result = runSafe(`templates create --name bad --type invalid --file ${tplFile}`, repo);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Invalid type");
    },
    TEST_TIMEOUT,
  );
});

describe("pstdio templates update", () => {
  test(
    "updates template content and default",
    () => {
      const repo = createInitializedRepo("tpl-update");

      const originalFile = join(repo, "original.md");
      writeFileSync(originalFile, "# Original content");
      run(`templates create --name project-doc --type document --file ${originalFile}`, repo);

      const tplFile = join(repo, "updated.md");
      writeFileSync(tplFile, "# Updated content");

      const output = run(`templates update --name project-doc --file ${tplFile} --default`, repo);
      expect(output).toContain('Updated template "project-doc"');
    },
    TEST_TIMEOUT,
  );

  test(
    "fails for nonexistent template",
    () => {
      const repo = createInitializedRepo("tpl-update-missing");

      const result = runSafe("templates update --name nonexistent --default", repo);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("not found");
    },
    TEST_TIMEOUT,
  );
});

describe("pstdio templates delete", () => {
  test(
    "deletes a template and hides it from list",
    async () => {
      const repo = createInitializedRepo("tpl-delete");
      await enableCoreTemplatesExtension(api.url, readProjectId(repo));

      const tplFile = join(repo, "delete-me.md");
      writeFileSync(tplFile, "# Delete me");
      run(`templates create --name delete-me --type document --file ${tplFile}`, repo);

      const output = run("templates delete --name delete-me", repo);
      expect(output).toContain('Deleted template "delete-me"');

      const listOutput = run("templates list", repo);
      expect(listOutput).not.toContain("delete-me");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails for nonexistent template",
    () => {
      const repo = createInitializedRepo("tpl-delete-missing");

      const result = runSafe("templates delete --name nonexistent", repo);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("not found");
    },
    TEST_TIMEOUT,
  );
});

describe("pstdio templates write", () => {
  test(
    "writes a ticket template to an existing ticket directory with --ticket",
    async () => {
      const repo = createInitializedRepo("tpl-write-ticket");
      await enableCoreTicketsExtension(api.url, readProjectId(repo));

      const ticketDir = join(repo, ".pstdio", "tickets", "TP-1");
      mkdirSync(ticketDir, { recursive: true });

      const output = run("templates write --name ticket --ticket TP-1", repo);
      expect(output).toContain('Wrote template "ticket" to .pstdio/tickets/TP-1/ticket.md');

      const ticketFile = join(ticketDir, "ticket.md");
      expect(existsSync(ticketFile)).toBe(true);

      const content = readFileSync(ticketFile, "utf8");
      expect(content).toContain("TP-1");
    },
    TEST_TIMEOUT,
  );

  test(
    "writes a template to an arbitrary path with --target",
    async () => {
      const repo = createInitializedRepo("tpl-write-target");
      await enableCoreTemplatesExtension(api.url, readProjectId(repo));

      run("templates write --name cookbook --target scratch/cookbook.md", repo);

      const out = join(repo, "scratch", "cookbook.md");
      expect(existsSync(out)).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "fails when ticket shorthand does not exist",
    async () => {
      const repo = createInitializedRepo("tpl-write-noticket");
      await enableCoreTicketsExtension(api.url, readProjectId(repo));

      const result = runSafe("templates write --name ticket --ticket MISSING-1", repo);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Ticket not found");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails for nonexistent template",
    () => {
      const repo = createInitializedRepo("tpl-write-notpl");

      const result = runSafe("templates write --name nonexistent --target docs/test.md", repo);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Template not found");
    },
    TEST_TIMEOUT,
  );
});
