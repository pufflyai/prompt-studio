import type { Arguments, Argv } from "yargs";
import { createMachineAutomationClient } from "./client";

export const command = "cancel";
export const describe = "Cancel an automation run";
export const builder = (yargs: Argv) =>
  yargs.option("project", { type: "string", demandOption: true }).option("id", { type: "string", demandOption: true });

export const createHandler = (client?: ReturnType<typeof createMachineAutomationClient>) =>
  async function cancelRun(argv: Arguments<{ project: string; id: string }>) {
    const automationClient = client ?? createMachineAutomationClient();
    console.log(JSON.stringify(await automationClient.cancelRun(argv.project, argv.id), null, 2));
  };

export const handler = createHandler();
