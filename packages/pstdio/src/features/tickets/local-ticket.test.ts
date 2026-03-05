import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  listTicketFiles,
  readTicketAttachment,
  readTicketFile,
  ticketFilePath,
  writeTicketAttachment,
  writeTicketFile,
} from "./local-ticket";

const tmpBase = join(import.meta.dirname, "__test-tmp-local__");

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("local-ticket", () => {
  test("writeTicketFile creates directory with display title and writes file", () => {
    const path = writeTicketFile(tmpBase, "PS-1", "# Ticket content\n");

    expect(path).toContain("PS-1_ticket-content");
    expect(path).toEndWith("ticket.md");

    const content = readTicketFile(tmpBase, "PS-1");
    expect(content).toBe("# Ticket content\n");
  });

  test("ticketFilePath resolves existing ticket by shorthand prefix", () => {
    writeTicketFile(tmpBase, "PS-1", "# My ticket\n");

    const path = ticketFilePath(tmpBase, "PS-1");
    expect(path).toContain("PS-1_my-ticket");
    expect(path).toEndWith("ticket.md");
  });

  test("ticketFilePath returns null when ticket does not exist", () => {
    expect(ticketFilePath(tmpBase, "PS-999")).toBeNull();
  });

  test("readTicketFile returns null when file does not exist", () => {
    const content = readTicketFile(tmpBase, "PS-999");
    expect(content).toBeNull();
  });

  test("writeTicketFile overwrites existing content", () => {
    writeTicketFile(tmpBase, "PS-2", "# Version 1\n");
    writeTicketFile(tmpBase, "PS-2", "# Version 2\n");

    const content = readTicketFile(tmpBase, "PS-2");
    expect(content).toBe("# Version 2\n");
  });

  test("listTicketFiles returns relative file paths", () => {
    writeTicketFile(tmpBase, "PS-3", "# Attachments\n");
    writeTicketAttachment(tmpBase, "PS-3", "notes.txt", Buffer.from("hi"));
    writeTicketAttachment(tmpBase, "PS-3", "nested/inner.md", Buffer.from("nested"));

    expect(listTicketFiles(tmpBase, "PS-3")).toEqual(["nested/inner.md", "notes.txt"]);
  });

  test("writeTicketAttachment refuses to overwrite without overwrite flag", () => {
    writeTicketFile(tmpBase, "PS-4", "# Test\n");
    writeTicketAttachment(tmpBase, "PS-4", "notes.txt", Buffer.from("v1"));

    expect(() => writeTicketAttachment(tmpBase, "PS-4", "notes.txt", Buffer.from("v2"))).toThrow(
      "Local file already exists",
    );
  });

  test("readTicketAttachment returns saved content", () => {
    writeTicketFile(tmpBase, "PS-5", "# Binary test\n");
    writeTicketAttachment(tmpBase, "PS-5", "binary.bin", Buffer.from("abc"));

    const content = readTicketAttachment(tmpBase, "PS-5", "binary.bin");
    expect(content.toString("utf8")).toBe("abc");
  });
});
