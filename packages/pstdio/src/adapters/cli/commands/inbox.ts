import type { Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { ensureApi } from "@/features/ensure-api";
import { createHandler as createListHandler } from "./notifications/list";

export const command = "inbox";
export const describe = "Alias for `pst notifications list --open`";

export const builder = (yargs: Argv) =>
  yargs
    .option("project", { type: "string", describe: "Project ID" })
    .option("priority", { type: "string", describe: "Comma-separated priorities (low,normal,high,urgent)" })
    .option("source", { type: "string", describe: "Filter by source extension id" });

export const middlewares = [() => ensureApi(API_URL)];

export const handler = (args: { project?: string; priority?: string; source?: string }) =>
  createListHandler()({ ...args, open: true });
