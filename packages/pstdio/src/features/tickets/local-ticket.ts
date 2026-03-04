import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const TICKETS_DIR = join(".pstdio", "tickets");
const TICKET_FILES_DIR = "files";

export const ticketDir = (root: string, shorthand: string) => join(root, TICKETS_DIR, shorthand);

export const ticketFilePath = (root: string, shorthand: string) => join(ticketDir(root, shorthand), "ticket.md");

export const ticketFilesDir = (root: string, shorthand: string) => join(ticketDir(root, shorthand), TICKET_FILES_DIR);

const toRelativeFilePath = (baseDir: string, absolutePath: string) => {
  const rel = relative(baseDir, absolutePath);
  return rel.split("\\").join("/");
};

const resolveTicketAttachmentPath = (root: string, shorthand: string, fileName: string) => {
  const baseDir = ticketFilesDir(root, shorthand);
  const targetPath = resolve(baseDir, fileName);
  const rel = relative(baseDir, targetPath);

  if (isAbsolute(rel) || rel.startsWith("..")) {
    throw new Error(`Ticket file path resolves outside ticket files directory: ${fileName}`);
  }

  return targetPath;
};

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
  if (!existsSync(baseDir)) return [];

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
  const dir = ticketDir(root, shorthand);
  if (!existsSync(dir)) return false;
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
