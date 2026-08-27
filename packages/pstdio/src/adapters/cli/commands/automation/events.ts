import type { Arguments, Argv } from "yargs";
import { createMachineAutomationClient } from "./client";

export const command = "events";
export const describe = "List automation run events";
export const builder = (yargs: Argv) =>
  yargs
    .option("project", { type: "string", demandOption: true })
    .option("id", { type: "string", demandOption: true })
    .option("after", { type: "number", default: 0 });

export const createHandler = (client?: ReturnType<typeof createMachineAutomationClient>) =>
  async function listEvents(argv: Arguments<{ project: string; id: string; after: number }>) {
    const automationClient = client ?? createMachineAutomationClient();
    console.log(JSON.stringify(await automationClient.listRunEvents(argv.project, argv.id, argv.after), null, 2));
  };

export const handler = createHandler();
