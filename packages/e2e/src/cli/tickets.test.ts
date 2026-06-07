import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { FLOW_TIMEOUT, SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

const findTicketDir = (repo: string, shorthand: string) => {
  const ticketsBase = join(repo, ".pstdio", "tickets");
  const exactDir = join(ticketsBase, shorthand);
  if (!existsSync(exactDir)) throw new Error(`Ticket dir not found for ${shorthand}`);
  return exactDir;
};

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

const run = (args: string, cwd: string, timeout?: number) => runPstdio(args, cwd, { PSTDIO_API_URL: api.url }, timeout);

const runSafe = (args: string, cwd: string, timeout?: number) =>
  runPstdioSafe(args, cwd, { PSTDIO_API_URL: api.url }, timeout);

const createInitializedRepo = (name: string) => {
  const repo = createGitRepo();
  dirs.push(repo);
  run(`projects create ${name}`, repo, FLOW_TIMEOUT);
  return repo;
};

describe("pstdio tickets create", () => {
  test(
    "creates a ticket and shows shorthand",
    () => {
      const repo = createInitializedRepo("tk-create");

      const ticket = JSON.parse(run('tickets create --content "My first ticket"', repo));

      expect(ticket.shorthand).toBe("T-1");
      expect(ticket.title).toBe("My first ticket");
      expect(ticket.draft).toBe(false);
    },
    TEST_TIMEOUT,
  );

  test(
    "fails outside a pstdio project",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      const result = runSafe('tickets create --content "Fail"', repo);
      expect(result.exitCode).not.toBe(0);
    },
    TEST_TIMEOUT,
  );
});

describe("pstdio tickets list", () => {
  test(
    "returns an empty array when there are no tickets",
    () => {
      const repo = createInitializedRepo("tk-list-empty");

      const tickets = JSON.parse(run("tickets list", repo));

      expect(tickets).toEqual([]);
    },
    TEST_TIMEOUT,
  );

  test(
    "lists created tickets",
    () => {
      const repo = createInitializedRepo("tk-list");

      run('tickets create --content "Ticket A"', repo);
      run('tickets create --content "Ticket B"', repo);

      const tickets = JSON.parse(run("tickets list", repo));

      const titles = tickets.map((ticket: { title: string }) => ticket.title);
      expect(titles).toContain("Ticket A");
      expect(titles).toContain("Ticket B");
      expect(tickets.map((ticket: { shorthand: string }) => ticket.shorthand)).toContain("T-1");
    },
    TEST_TIMEOUT,
  );

  test(
    "hides draft tickets by default and lists them with --draft",
    () => {
      const repo = createInitializedRepo("tk-list-draft");

      run('tickets create --content "Saved ticket"', repo);
      run('tickets write --title "Draft only"', repo);

      const byDefault = JSON.parse(run("tickets list", repo));
      const defaultTitles = byDefault.map((ticket: { title: string }) => ticket.title);
      expect(defaultTitles).toContain("Saved ticket");
      expect(defaultTitles).not.toContain("Draft only");

      const draftTickets = JSON.parse(run("tickets list --draft", repo));
      expect(draftTickets.map((ticket: { title: string }) => ticket.title)).toEqual(["Draft only"]);
    },
    TEST_TIMEOUT,
  );
});

describe("pstdio tickets write", () => {
  test(
    "creates draft ticket and writes local file",
    () => {
      const repo = createInitializedRepo("tk-write");

      const result = JSON.parse(run('tickets write --title "Draft ticket"', repo));

      expect(result.shorthand).toBe("T-1");
      expect(result.path).toBe(".pstdio/tickets/T-1/ticket.md");

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
      expect(content).toContain('ticket_id: "T-1"');
      expect(content).toContain("draft: true");
    },
    TEST_TIMEOUT,
  );

  test(
    "writes a plain draft body from the title",
    () => {
      const repo = createInitializedRepo("tk-write-body");

      const result = JSON.parse(run('tickets write --title "Templated"', repo));

      expect(result.shorthand).toBe("T-1");

      const ticketFile = join(repo, ".pstdio", "tickets", result.shorthand, "ticket.md");
      const content = readFileSync(ticketFile, "utf8");

      expect(content).toContain("# Templated");
      expect(content).toContain("draft: true");
    },
    TEST_TIMEOUT,
  );
});

describe("pstdio tickets save", () => {
  test(
    "pushes draft ticket to database and sets draft=false",
    () => {
      const repo = createInitializedRepo("tk-save");

      // Create a draft
      const { shorthand } = JSON.parse(run('tickets write --title "Save me"', repo));

      // Save it
      const saveResult = JSON.parse(run(`tickets save --id ${shorthand}`, repo));
      expect(saveResult.shorthand).toBe(shorthand);

      // Verify it appears in non-draft list
      const tickets = JSON.parse(run("tickets list", repo));
      expect(tickets.map((ticket: { title: string }) => ticket.title)).toContain("Save me");

      // Verify it no longer appears in draft list
      const draftTickets = JSON.parse(run("tickets list --draft", repo));
      expect(draftTickets).toEqual([]);
    },
    TEST_TIMEOUT,
  );

  test(
    "persists parent_id from ticket frontmatter",
    () => {
      const repo = createInitializedRepo("tk-save-parent");

      const { shorthand: parentShorthand } = JSON.parse(run('tickets create --content "Parent ticket"', repo));

      const { shorthand: childShorthand } = JSON.parse(run('tickets write --title "Child ticket"', repo));

      const ticketFile = join(findTicketDir(repo, childShorthand), "ticket.md");
      const content = readFileSync(ticketFile, "utf8");
      const updatedContent = content.replace(
        "---\n\n# Child ticket",
        `parent_id: "${parentShorthand}"\n---\n\n# Child ticket`,
      );
      writeFileSync(ticketFile, updatedContent);

      const saveResult = JSON.parse(run(`tickets save --id ${childShorthand}`, repo));
      expect(saveResult.shorthand).toBe(childShorthand);

      const children = JSON.parse(run(`tickets list --parent ${parentShorthand}`, repo));
      expect(children.map((ticket: { shorthand: string }) => ticket.shorthand)).toContain(childShorthand);
      expect(children.map((ticket: { title: string }) => ticket.title)).toContain("Child ticket");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails for nonexistent ticket",
    () => {
      const repo = createInitializedRepo("tk-save-missing");

      const result = runSafe("tickets save --id MISSING-99", repo);
      expect(result.exitCode).not.toBe(0);
    },
    TEST_TIMEOUT,
  );
});

describe("pstdio tickets files", () => {
  test(
    "shows local and db status for ticket files",
    () => {
      const repo = createInitializedRepo("tk-files");
      const { shorthand } = JSON.parse(run('tickets write --title "File statuses"', repo));

      const ticketDir = findTicketDir(repo, shorthand);
      const attachmentDir = join(ticketDir, "files");
      const attachmentPath = join(attachmentDir, "notes.txt");
      mkdirSync(attachmentDir, { recursive: true });
      writeFileSync(attachmentPath, "hello attachment");

      const saveResult = JSON.parse(run(`tickets save --id ${shorthand}`, repo));
      expect(saveResult.shorthand).toBe(shorthand);
      expect(saveResult.files).toBe(1);

      const filesBoth = JSON.parse(run(`tickets files --id ${shorthand}`, repo));
      const notesBoth = filesBoth.find((entry: { file: string }) => entry.file === "notes.txt");
      expect(notesBoth).toMatchObject({ storage: "yes", local: "yes" });

      rmSync(attachmentPath);

      const filesDbOnly = JSON.parse(run(`tickets files --id ${shorthand}`, repo));
      const notesDbOnly = filesDbOnly.find((entry: { file: string }) => entry.file === "notes.txt");
      expect(notesDbOnly).toMatchObject({ storage: "yes", local: "no" });
    },
    TEST_TIMEOUT,
  );
});

describe("pstdio tickets pull", () => {
  test(
    "pulls ticket markdown and attachments from db when local files are missing",
    () => {
      const repo = createInitializedRepo("tk-pull");
      const { shorthand } = JSON.parse(run('tickets write --title "Pull ticket"', repo));

      const ticketDir = findTicketDir(repo, shorthand);
      const attachmentDir = join(ticketDir, "files");
      const attachmentPath = join(attachmentDir, "notes.txt");
      mkdirSync(attachmentDir, { recursive: true });
      writeFileSync(attachmentPath, "sync me");

      run(`tickets save --id ${shorthand}`, repo);
      rmSync(ticketDir, { recursive: true, force: true });

      const pullResult = JSON.parse(run(`tickets pull --id ${shorthand}`, repo));
      expect(pullResult.shorthand).toBe(shorthand);
      expect(pullResult.skipped).toBe(false);
      expect(pullResult.files).toBe(1);

      const pulledDir = findTicketDir(repo, shorthand);
      expect(readFileSync(join(pulledDir, "ticket.md"), "utf8")).toContain("# Pull ticket");
      expect(readFileSync(join(pulledDir, "files", "notes.txt"), "utf8")).toBe("sync me");
    },
    TEST_TIMEOUT,
  );

  test(
    "requires --force to overwrite local ticket files",
    () => {
      const repo = createInitializedRepo("tk-pull-force");
      const { shorthand } = JSON.parse(run('tickets write --title "Pull force ticket"', repo));
      const ticketDir = findTicketDir(repo, shorthand);
      const ticketPath = join(ticketDir, "ticket.md");

      run(`tickets save --id ${shorthand}`, repo);
      writeFileSync(ticketPath, "local changes");

      const withoutForce = JSON.parse(run(`tickets pull --id ${shorthand}`, repo));
      expect(withoutForce.skipped).toBe(true);
      expect(readFileSync(ticketPath, "utf8")).toBe("local changes");

      const withForce = JSON.parse(run(`tickets pull --id ${shorthand} --force`, repo));
      expect(withForce.shorthand).toBe(shorthand);
      expect(withForce.skipped).toBe(false);
      expect(readFileSync(ticketPath, "utf8")).toContain("# Pull force ticket");
    },
    TEST_TIMEOUT,
  );
});

describe.skip("pstdio tickets update", () => {
  test(
    "fails for nonexistent ticket",
    () => {
      const repo = createInitializedRepo("tk-update-missing");

      const result = runSafe("tickets update --id MISSING-99 --status wip", repo, FLOW_TIMEOUT);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Ticket not found");
    },
    FLOW_TIMEOUT,
  );
});

describe.skip("pstdio tickets full flow", () => {
  test(
    "write → save → list → update lifecycle",
    () => {
      const repo = createInitializedRepo("tk-flow");

      // 1. Write a draft
      const writeOutput = run('tickets write --title "Lifecycle ticket"', repo, FLOW_TIMEOUT);
      const shorthandMatch = writeOutput.match(/Created ticket (\S+)/);
      const shorthand = shorthandMatch![1];

      // 2. Draft should not appear in default list
      const emptyList = run("tickets list", repo, FLOW_TIMEOUT);
      expect(emptyList).toContain("No tickets found");

      // 3. Save the draft
      run(`tickets save --id ${shorthand}`, repo, FLOW_TIMEOUT);

      // 4. Now appears in list
      const listOutput = run("tickets list", repo, FLOW_TIMEOUT);
      expect(listOutput).toContain("lifecycle-ticket");
      expect(listOutput).toContain(shorthand);

      // 5. Update status
      const updateOutput = run(`tickets update --id ${shorthand} --status wip`, repo, FLOW_TIMEOUT);
      expect(updateOutput).toContain(`Updated ticket ${shorthand}`);
    },
    FLOW_TIMEOUT,
  );
});
