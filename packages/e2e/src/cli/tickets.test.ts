import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi();
}, 20_000);

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

describe("pstdio tickets create", () => {
  test("creates a ticket and shows shorthand", () => {
    const repo = createInitializedRepo("tk-create");

    const output = run('tickets create --content "My first ticket"', repo);

    expect(output).toMatch(/Created ticket \S+-1/);
  });

  test("fails outside a pstdio project", () => {
    const repo = createGitRepo();
    dirs.push(repo);

    const result = runSafe('tickets create --content "Fail"', repo);
    expect(result.exitCode).not.toBe(0);
  });
});

describe("pstdio tickets list", () => {
  test("shows 'No tickets found' when empty", () => {
    const repo = createInitializedRepo("tk-list-empty");

    const output = run("tickets list", repo);

    expect(output).toContain("No tickets found");
  });

  test("lists created tickets in table format", () => {
    const repo = createInitializedRepo("tk-list");

    run('tickets create --content "Ticket A"', repo);
    run('tickets create --content "Ticket B"', repo);

    const output = run("tickets list", repo);

    expect(output).toContain("Ticket A");
    expect(output).toContain("Ticket B");
    expect(output).toContain("Shorthand");
  });

  test("does not list draft tickets by default", () => {
    const repo = createInitializedRepo("tk-list-draft");

    run('tickets write --title "Draft only"', repo);

    const output = run("tickets list", repo);
    expect(output).toContain("No tickets found");

    const draftOutput = run("tickets list --draft", repo);
    expect(draftOutput).toContain("Draft only");
  });
});

describe("pstdio tickets write", () => {
  test("creates draft ticket and writes local file", () => {
    const repo = createInitializedRepo("tk-write");

    const output = run('tickets write --title "Draft ticket"', repo);

    expect(output).toMatch(/Created ticket \S+-1 \(draft\)/);
    expect(output).toContain(".pstdio/tickets/");

    const ticketDir = join(repo, ".pstdio", "tickets");
    expect(existsSync(ticketDir)).toBe(true);

    // Find the created ticket file
    const { readdirSync } = require("node:fs");
    const ticketDirs = readdirSync(ticketDir);
    expect(ticketDirs.length).toBe(1);

    const ticketFile = join(ticketDir, ticketDirs[0], "ticket.md");
    expect(existsSync(ticketFile)).toBe(true);

    const content = readFileSync(ticketFile, "utf8");
    expect(content).toContain("# Draft ticket");
  });

  test("creates draft with template", () => {
    const repo = createInitializedRepo("tk-write-tpl");

    const output = run('tickets write --title "Templated" --template ticket', repo);

    expect(output).toMatch(/Created ticket \S+-1 \(draft\)/);

    const ticketDir = join(repo, ".pstdio", "tickets");
    const { readdirSync } = require("node:fs");
    const ticketDirs = readdirSync(ticketDir);
    const ticketFile = join(ticketDir, ticketDirs[0], "ticket.md");
    const content = readFileSync(ticketFile, "utf8");

    expect(content).toContain("Templated");
  });

  test("fails with nonexistent template", () => {
    const repo = createInitializedRepo("tk-write-badtpl");

    const result = runSafe('tickets write --title "Bad" --template nonexistent', repo);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Template not found");
  });
});

describe("pstdio tickets save", () => {
  test("pushes draft ticket to database and sets draft=false", () => {
    const repo = createInitializedRepo("tk-save");

    // Create a draft
    const writeOutput = run('tickets write --title "Save me"', repo);
    const shorthandMatch = writeOutput.match(/Created ticket (\S+)/);
    const shorthand = shorthandMatch![1];

    // Save it
    const saveOutput = run(`tickets save --id ${shorthand}`, repo);
    expect(saveOutput).toContain(`Pushed ticket ${shorthand}`);

    // Verify it appears in non-draft list
    const listOutput = run("tickets list", repo);
    expect(listOutput).toContain("Save me");

    // Verify it no longer appears in draft list
    const draftOutput = run("tickets list --draft", repo);
    expect(draftOutput).toContain("No tickets found");
  });

  test("fails for nonexistent ticket", () => {
    const repo = createInitializedRepo("tk-save-missing");

    const result = runSafe("tickets save --id MISSING-99", repo);
    expect(result.exitCode).not.toBe(0);
  });
});

describe("pstdio tickets update", () => {
  test("fails for nonexistent ticket", () => {
    const repo = createInitializedRepo("tk-update-missing");

    const result = runSafe("tickets update --id MISSING-99 --status wip", repo);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Ticket not found");
  });
});

describe("pstdio tickets full flow", () => {
  test("write → save → list → update lifecycle", () => {
    const repo = createInitializedRepo("tk-flow");

    // 1. Write a draft
    const writeOutput = run('tickets write --title "Lifecycle ticket"', repo);
    const shorthandMatch = writeOutput.match(/Created ticket (\S+)/);
    const shorthand = shorthandMatch![1];

    // 2. Draft should not appear in default list
    const emptyList = run("tickets list", repo);
    expect(emptyList).toContain("No tickets found");

    // 3. Save the draft
    run(`tickets save --id ${shorthand}`, repo);

    // 4. Now appears in list
    const listOutput = run("tickets list", repo);
    expect(listOutput).toContain("Lifecycle ticket");
    expect(listOutput).toContain(shorthand);
  });
});
