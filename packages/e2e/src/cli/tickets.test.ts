import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";

const findTicketDir = (repo: string, shorthand: string) => {
  const ticketsBase = join(repo, ".pstdio", "tickets");
  const prefix = `${shorthand}_`;
  const match = readdirSync(ticketsBase).find((name) => name.startsWith(prefix));
  if (!match) throw new Error(`Ticket dir not found for ${shorthand}`);
  return join(ticketsBase, match);
};

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
    expect(saveOutput).toContain(`Saved ticket ${shorthand}`);

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

describe("pstdio tickets files", () => {
  test("shows local and db status for ticket files", () => {
    const repo = createInitializedRepo("tk-files");
    const writeOutput = run('tickets write --title "File statuses"', repo);
    const shorthand = writeOutput.match(/Created ticket (\S+)/)![1];

    const ticketDir = findTicketDir(repo, shorthand);
    const attachmentDir = join(ticketDir, "files");
    const attachmentPath = join(attachmentDir, "notes.txt");
    mkdirSync(attachmentDir, { recursive: true });
    writeFileSync(attachmentPath, "hello attachment");

    const saveOutput = run(`tickets save --id ${shorthand}`, repo);
    expect(saveOutput).toContain(`Saved ticket ${shorthand}`);
    expect(saveOutput).toContain("Uploaded 1 ticket files");

    const outputBoth = run(`tickets files --id ${shorthand}`, repo);
    expect(outputBoth).toContain("File Name");
    expect(outputBoth).toContain("notes.txt");
    expect(outputBoth).toMatch(/notes\.txt\s+yes\s+yes/);

    rmSync(attachmentPath);

    const outputDbOnly = run(`tickets files --id ${shorthand}`, repo);
    expect(outputDbOnly).toContain("notes.txt");
    expect(outputDbOnly).toMatch(/notes\.txt\s+yes\s+no/);
  });
});

describe("pstdio tickets pull", () => {
  test("pulls ticket markdown and attachments from db when local files are missing", () => {
    const repo = createInitializedRepo("tk-pull");
    const writeOutput = run('tickets write --title "Pull ticket"', repo);
    const shorthand = writeOutput.match(/Created ticket (\S+)/)![1];

    const ticketDir = findTicketDir(repo, shorthand);
    const attachmentDir = join(ticketDir, "files");
    const attachmentPath = join(attachmentDir, "notes.txt");
    mkdirSync(attachmentDir, { recursive: true });
    writeFileSync(attachmentPath, "sync me");

    run(`tickets save --id ${shorthand}`, repo);
    rmSync(ticketDir, { recursive: true, force: true });

    const pullOutput = run(`tickets pull --id ${shorthand}`, repo);
    expect(pullOutput).toContain(`Pulled ticket ${shorthand}`);
    expect(pullOutput).toContain("Downloaded 1 ticket files");

    const pulledDir = findTicketDir(repo, shorthand);
    expect(readFileSync(join(pulledDir, "ticket.md"), "utf8")).toContain("# Pull ticket");
    expect(readFileSync(join(pulledDir, "files", "notes.txt"), "utf8")).toBe("sync me");
  });

  test("requires --force to overwrite local ticket files", () => {
    const repo = createInitializedRepo("tk-pull-force");
    const writeOutput = run('tickets write --title "Pull force ticket"', repo);
    const shorthand = writeOutput.match(/Created ticket (\S+)/)![1];
    const ticketDir = findTicketDir(repo, shorthand);
    const ticketPath = join(ticketDir, "ticket.md");

    run(`tickets save --id ${shorthand}`, repo);
    writeFileSync(ticketPath, "local changes");

    const withoutForce = runSafe(`tickets pull --id ${shorthand}`, repo);
    expect(withoutForce.exitCode).not.toBe(0);
    expect(withoutForce.stderr).toContain("Use --force to overwrite");

    const withForce = run(`tickets pull --id ${shorthand} --force`, repo);
    expect(withForce).toContain(`Pulled ticket ${shorthand}`);
    expect(readFileSync(ticketPath, "utf8")).toContain("# Pull force ticket");
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
