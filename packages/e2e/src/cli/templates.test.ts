import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

describe("pstdio templates list", () => {
  test(
    "lists bundled templates after project creation",
    () => {
      const repo = createInitializedRepo("tpl-list");

      const output = run("templates list", repo);

      expect(output).toContain("ticket");
      expect(output).toContain("proposal");
      expect(output).toContain("spec");
      expect(output).toContain("adr");
      expect(output).toContain("cookbook");
      expect(output).toContain("review-me");
    },
    TEST_TIMEOUT,
  );

  test(
    "shows default markers",
    () => {
      const repo = createInitializedRepo("tpl-defaults");

      const output = run("templates list", repo);
      const lines = output.trim().split("\n");

      const ticketLine = lines.find((l) => l.match(/^ticket\s/));
      expect(ticketLine).toContain("*");

      const specLine = lines.find((l) => l.match(/^spec\s/));
      expect(specLine).toContain("*");
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

      const tplFile = join(repo, "updated.md");
      writeFileSync(tplFile, "# Updated content");

      const output = run(`templates update --name adr --file ${tplFile} --default`, repo);
      expect(output).toContain('Updated template "adr"');
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
    () => {
      const repo = createInitializedRepo("tpl-delete");

      const output = run("templates delete --name cookbook", repo);
      expect(output).toContain('Deleted template "cookbook"');

      const listOutput = run("templates list", repo);
      expect(listOutput).not.toContain("cookbook");
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
    "writes a docs template to the filesystem and updates navigation",
    () => {
      const repo = createInitializedRepo("tpl-write-docs");

      const output = run("templates write --name spec --target docs/specs/cli/new-feature", repo);
      expect(output).toContain('Wrote template "spec" to .pstdio/docs/specs/cli/new-feature.md');

      const filePath = join(repo, ".pstdio", "docs", "specs", "cli", "new-feature.md");
      expect(existsSync(filePath)).toBe(true);

      const content = readFileSync(filePath, "utf8");
      expect(content).toContain("Purpose");

      const nav = JSON.parse(readFileSync(join(repo, ".pstdio", "docs", "navigation.json"), "utf8"));
      const navStr = JSON.stringify(nav);
      expect(navStr).toContain("/specs/cli/new-feature");
    },
    TEST_TIMEOUT,
  );

  test(
    "writes a ticket template to an existing ticket directory",
    () => {
      const repo = createInitializedRepo("tpl-write-ticket");

      const ticketDir = join(repo, ".pstdio", "tickets", "TP-1");
      mkdirSync(ticketDir, { recursive: true });

      const output = run("templates write --name ticket --target TP-1", repo);
      expect(output).toContain('Wrote template "ticket" to .pstdio/tickets/TP-1/ticket.md');

      const ticketFile = join(ticketDir, "ticket.md");
      expect(existsSync(ticketFile)).toBe(true);

      const content = readFileSync(ticketFile, "utf8");
      expect(content).toContain("TP-1");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails when ticket directory does not exist",
    () => {
      const repo = createInitializedRepo("tpl-write-noticket");

      const result = runSafe("templates write --name ticket --target MISSING-1", repo);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Ticket not found");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails when using ticket template for docs target",
    () => {
      const repo = createInitializedRepo("tpl-write-badtarget");

      const result = runSafe("templates write --name ticket --target docs/bad/path", repo);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Ticket templates cannot target docs");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails for nonexistent template",
    () => {
      const repo = createInitializedRepo("tpl-write-notpl");

      const result = runSafe("templates write --name nonexistent --target docs/test", repo);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Template not found");
    },
    TEST_TIMEOUT,
  );
});
