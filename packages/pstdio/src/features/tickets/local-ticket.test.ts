import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readTicketFile, ticketFilePath, writeTicketFile } from "./local-ticket";

const tmpBase = join(import.meta.dirname, "__test-tmp-local__");

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("local-ticket", () => {
  test("writeTicketFile creates directory and file", () => {
    const path = writeTicketFile(tmpBase, "PS-1", "# Ticket content");

    expect(path).toBe(ticketFilePath(tmpBase, "PS-1"));

    const content = readTicketFile(tmpBase, "PS-1");
    expect(content).toBe("# Ticket content");
  });

  test("readTicketFile returns null when file does not exist", () => {
    const content = readTicketFile(tmpBase, "PS-999");
    expect(content).toBeNull();
  });

  test("writeTicketFile overwrites existing content", () => {
    writeTicketFile(tmpBase, "PS-2", "version 1");
    writeTicketFile(tmpBase, "PS-2", "version 2");

    const content = readTicketFile(tmpBase, "PS-2");
    expect(content).toBe("version 2");
  });
});
