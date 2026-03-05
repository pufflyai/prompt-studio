import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listTicketFiles as defaultListTicketFiles } from "@/features/tickets/api/list-ticket-files";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";
import { listTicketFiles as listLocalTicketFiles, resolveTicketDir } from "@/features/tickets/local-ticket";

export const command = "files";
export const describe = "List ticket files from database and local project";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("project-id", { type: "string", describe: "Project ID" });

type FilesArgs = {
  id: string;
  "project-id"?: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listTickets: typeof defaultListTickets;
  listTicketFiles: typeof defaultListTicketFiles;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listTickets: defaultListTickets,
  listTicketFiles: defaultListTicketFiles,
  log: console.log,
};

const resolveTicketByShorthand = async (deps: Deps, projectId: string, shorthand: string) => {
  const publishedTickets = await deps.listTickets(API_URL, {
    project_id: projectId,
    shorthand,
  });
  if (publishedTickets.length > 0) return publishedTickets[0];

  const draftTickets = await deps.listTickets(API_URL, {
    project_id: projectId,
    shorthand,
    draft: true,
  });
  return draftTickets[0] ?? null;
};

type FileRow = {
  fileName: string;
  db: string;
  local: string;
  localPath: string;
};

const formatTable = (rows: FileRow[]) => {
  const header: FileRow = {
    fileName: "File Name",
    db: "DB",
    local: "Local",
    localPath: "Local Path",
  };

  const widths = {
    fileName: Math.max(header.fileName.length, ...rows.map((row) => row.fileName.length)),
    db: Math.max(header.db.length, ...rows.map((row) => row.db.length)),
    local: Math.max(header.local.length, ...rows.map((row) => row.local.length)),
    localPath: Math.max(header.localPath.length, ...rows.map((row) => row.localPath.length)),
  };

  const pad = (value: string, width: number) => value.padEnd(width);
  const line = (row: FileRow) =>
    `${pad(row.fileName, widths.fileName)}   ${pad(row.db, widths.db)}   ${pad(row.local, widths.local)}   ${pad(row.localPath, widths.localPath)}`;

  return [line(header), ...rows.map(line)].join("\n");
};

const resolveProject = (deps: Deps, explicitId?: string) => {
  if (explicitId) {
    const root = deps.findGitRoot(deps.cwd());
    const hasConfig = root && deps.readConfig(root);
    return { projectId: explicitId, root: hasConfig ? root : null };
  }

  const root = deps.findGitRoot(deps.cwd());
  if (!root) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
  const config = deps.readConfig(root);
  if (!config) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
  return { projectId: config.project_id, root };
};

const buildFileRows = (dbFileNames: Set<string>, localFileNames: Set<string>, ticketDirRelative: string | null) => {
  const allFiles = Array.from(new Set([...dbFileNames, ...localFileNames])).sort();

  return allFiles.map((fileName) => ({
    fileName,
    db: dbFileNames.has(fileName) ? "yes" : "no",
    local: localFileNames.has(fileName) ? "yes" : "no",
    localPath: localFileNames.has(fileName) && ticketDirRelative ? `${ticketDirRelative}/files/${fileName}` : "-",
  }));
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<FilesArgs>) => {
    const { projectId, root } = resolveProject(deps, argv["project-id"]);

    const ticket = await resolveTicketByShorthand(deps, projectId, argv.id);
    if (!ticket) throw new Error(`Ticket not found: ${argv.id}`);

    const dbFiles = await deps.listTicketFiles(API_URL, ticket.id);
    const localFiles = root ? listLocalTicketFiles(root, argv.id) : [];
    const ticketDir = root ? resolveTicketDir(root, argv.id) : null;
    const ticketDirRelative = ticketDir && root ? ticketDir.replace(`${root}/`, "") : null;

    const rows = buildFileRows(new Set(dbFiles.map((file) => file.file_name)), new Set(localFiles), ticketDirRelative);

    if (rows.length === 0) {
      deps.log("No ticket files found.");
      return;
    }

    deps.log(formatTable(rows));
  };

export const handler = createHandler();
