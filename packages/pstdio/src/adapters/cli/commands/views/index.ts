import { createClient } from "@pstdio/sdk/client";
import type { Argv } from "yargs";
import { resolveApiUrl } from "@/features/api-url";
import { findProjectRoot, readConfig } from "@/features/config/config";
import { ensureApi } from "@/features/ensure-api";
import { buildViewInput, type ViewFlags } from "./view-input";

export const command = "views [command]";
export const describe = "Manage shared project board views";
export const middlewares = [() => ensureApi(process.env.PSTDIO_API_URL)];
interface Args extends ViewFlags {
  "project-id"?: string;
  board?: string;
  id?: string;
  ids?: string;
  orphaned?: boolean;
  "copy-from"?: string;
}
const project = (args: Args) => {
  if (args["project-id"]) return args["project-id"];
  const root = findProjectRoot(process.cwd());
  const config = root ? readConfig(root) : null;
  if (!config) throw new Error("No .pstdio/config.json found. Pass --project-id.");
  return config.project_id;
};
const base = (yargs: Argv) => yargs.option("project-id", { type: "string" });
const board = (yargs: Argv) => base(yargs).option("board", { type: "string", demandOption: true });
const id = (yargs: Argv) => base(yargs).option("id", { type: "string", demandOption: true });
const edit = (yargs: Argv) =>
  yargs
    .option("title", { type: "string" })
    .option("filter", { type: "array", string: true })
    .option("mode", { type: "string", choices: ["board", "list"] })
    .option("columns", { type: "string" })
    .option("rows", { type: "string" })
    .option("sort", { type: "string" })
    .option("show", { type: "string" });
const run =
  (fn: (api: ReturnType<typeof createClient>["views"], projectId: string, args: Args) => Promise<unknown>) =>
  async (raw: unknown) => {
    const args = raw as Args;
    console.log(
      JSON.stringify(await fn(createClient({ baseUrl: resolveApiUrl() }).views, project(args), args), null, 2),
    );
  };
let parser: Argv;
export const builder = (yargs: Argv) => {
  parser = yargs;
  return yargs
    .command({
      command: "boards",
      describe: "List boards and resolved fields",
      builder: base,
      handler: run((api, p) => api.boards(p)),
    })
    .command({
      command: "list",
      describe: "List board views or orphaned views",
      builder: (y) => base(y).option("board", { type: "string" }).option("orphaned", { type: "boolean" }),
      handler: run((api, p, a) => {
        if (Boolean(a.board) === Boolean(a.orphaned)) throw new Error("Choose --board or --orphaned");
        return a.orphaned ? api.orphaned(p) : api.list(p, a.board!);
      }),
    })
    .command({
      command: "create",
      describe: "Create or duplicate a shared view",
      builder: (y) =>
        edit(board(y)).option("title", { type: "string", demandOption: true }).option("copy-from", { type: "string" }),
      handler: run(async (api, p, a) => {
        const { fields } = await api.board(p, a.board!);
        return api.create(p, a.board!, { ...buildViewInput(a, fields), title: a.title!, copyFrom: a["copy-from"] });
      }),
    })
    .command({
      command: "update",
      describe: "Update a saved view",
      builder: (y) => edit(id(y)),
      handler: run(async (api, p, a) => {
        const view = await api.get(p, a.id!);
        const board = await api.board(p, view.boardId);
        return api.update(p, a.id!, buildViewInput(a, board.fields));
      }),
    })
    .command({
      command: "delete",
      describe: "Delete a saved view",
      builder: id,
      handler: run((api, p, a) => api.delete(p, a.id!)),
    })
    .command({
      command: "reorder",
      describe: "Order saved views",
      builder: (y) => board(y).option("ids", { type: "string", demandOption: true }),
      handler: run((api, p, a) => api.reorder(p, a.board!, a.ids!.split(",").filter(Boolean))),
    })
    .command({
      command: "set-default",
      describe: "Set the project board default",
      builder: (y) => board(id(y)),
      handler: run((api, p, a) => api.setDefault(p, a.board!, a.id === "none" ? null : a.id!)),
    });
};
export const handler = () => {
  parser.showHelp();
};
