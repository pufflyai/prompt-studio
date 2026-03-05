import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { ticketDirName } from "./display-title";

const TICKETS_DIR = join(".pstdio", "tickets");
const TICKET_FILES_DIR = "files";

export const resolveTicketDir = (root: string, shorthand: string) => {
  const ticketsBase = join(root, TICKETS_DIR);
  if (!existsSync(ticketsBase)) return null;

  const prefix = `${shorthand}_`;
  const entries = readdirSync(ticketsBase, { withFileTypes: true });
  const match = entries.find((e) => e.isDirectory() && e.name.startsWith(prefix));
  return match ? join(ticketsBase, match.name) : null;
};

const ticketFilesDir = (root: string, shorthand: string) => {
  const dir = resolveTicketDir(root, shorthand);
  return dir ? join(dir, TICKET_FILES_DIR) : null;
};

const toRelativeFilePath = (baseDir: string, absolutePath: string) => {
  const rel = relative(baseDir, absolutePath);
  return rel.split("\\").join("/");
};

const resolveTicketAttachmentPath = (root: string, shorthand: string, fileName: string) => {
  const baseDir = ticketFilesDir(root, shorthand);
  if (!baseDir) throw new Error(`Ticket directory not found for ${shorthand}`);

  const targetPath = resolve(baseDir, fileName);
  const rel = relative(baseDir, targetPath);

  if (isAbsolute(rel) || rel.startsWith("..")) {
    throw new Error(`Ticket file path resolves outside ticket files directory: ${fileName}`);
  }

  return targetPath;
};

export const writeTicketFile = (root: string, shorthand: string, content: string) => {
  const dirName = ticketDirName(shorthand, content);
  const dir = join(root, TICKETS_DIR, dirName);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, "ticket.md");
  writeFileSync(filePath, content);
  return filePath;
};

export const readTicketFile = (root: string, shorthand: string) => {
  const dir = resolveTicketDir(root, shorthand);
  if (!dir) return null;
  const filePath = join(dir, "ticket.md");
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf8");
};

export const ticketFilePath = (root: string, shorthand: string) => {
  const dir = resolveTicketDir(root, shorthand);
  if (!dir) return null;
  return join(dir, "ticket.md");
};

const walkFiles = (rootDir: string, currentDir: string, files: string[]) => {
  const entries = readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      walkFiles(rootDir, fullPath, files);
      continue;
    }

    if (!entry.isFile()) continue;
    files.push(toRelativeFilePath(rootDir, fullPath));
  }
};

export const listTicketFiles = (root: string, shorthand: string) => {
  const baseDir = ticketFilesDir(root, shorthand);
  if (!baseDir || !existsSync(baseDir)) return [];

  const files: string[] = [];
  walkFiles(baseDir, baseDir, files);
  files.sort();
  return files;
};

export const readTicketAttachment = (root: string, shorthand: string, fileName: string) => {
  const filePath = resolveTicketAttachmentPath(root, shorthand, fileName);
  return readFileSync(filePath);
};

export const removeTicketDir = (root: string, shorthand: string) => {
  const dir = resolveTicketDir(root, shorthand);
  if (!dir) return false;
  rmSync(dir, { recursive: true });
  return true;
};

export const writeTicketAttachment = (
  root: string,
  shorthand: string,
  fileName: string,
  content: Buffer,
  overwrite = false,
) => {
  const filePath = resolveTicketAttachmentPath(root, shorthand, fileName);

  if (!overwrite && existsSync(filePath)) {
    throw new Error(`Local file already exists: ${toRelativeFilePath(root, filePath)}. Use --force to overwrite.`);
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return filePath;
};
