import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "export";
export const describe = "Print a session and its complete conversation as JSON";
export const builder = (yargs: Argv) =>
  yargs.option("id", { type: "string", demandOption: true, describe: "Session ID" });

type ExportArgs = { id: string };
const getConversation = (id: string) => apiClient().sessions.getConversation(id);

export const createHandler =
  (deps = { getConversation, log: (message: string) => console.log(message) }) =>
  async (argv: Arguments<ExportArgs>) => {
    const conversation = await deps.getConversation(argv.id);
    deps.log(JSON.stringify(conversation, null, 2));
  };

export const handler = createHandler();
