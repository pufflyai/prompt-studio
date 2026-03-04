import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TICKETS_DIR = join(".pstdio", "tickets");

export const ticketDir = (root: string, shorthand: string) => join(root, TICKETS_DIR, shorthand);

export const ticketFilePath = (root: string, shorthand: string) => join(ticketDir(root, shorthand), "ticket.md");

export const writeTicketFile = (root: string, shorthand: string, content: string) => {
  const dir = ticketDir(root, shorthand);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, "ticket.md");
  writeFileSync(filePath, content);
  return filePath;
};

export const readTicketFile = (root: string, shorthand: string) => {
  const filePath = ticketFilePath(root, shorthand);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf8");
};
