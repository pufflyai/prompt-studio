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

  test("listTicketFiles returns relative file paths", () => {
    writeTicketAttachment(tmpBase, "PS-3", "notes.txt", Buffer.from("hi"));
    writeTicketAttachment(tmpBase, "PS-3", "nested/inner.md", Buffer.from("nested"));

    expect(listTicketFiles(tmpBase, "PS-3")).toEqual(["nested/inner.md", "notes.txt"]);
  });

  test("writeTicketAttachment refuses to overwrite without overwrite flag", () => {
    writeTicketAttachment(tmpBase, "PS-4", "notes.txt", Buffer.from("v1"));

    expect(() => writeTicketAttachment(tmpBase, "PS-4", "notes.txt", Buffer.from("v2"))).toThrow(
      "Local file already exists",
    );
  });

  test("readTicketAttachment returns saved content", () => {
    writeTicketAttachment(tmpBase, "PS-5", "binary.bin", Buffer.from("abc"));

    const content = readTicketAttachment(tmpBase, "PS-5", "binary.bin");
    expect(content.toString("utf8")).toBe("abc");
  });
});
