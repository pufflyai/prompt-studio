import type { CreateAutomationRunInput } from "@pstdio/sdk/api";
import type { Arguments, Argv } from "yargs";
import { createMachineAutomationClient } from "./client";

export const command = "run";
export const describe = "Create an idempotent automation run";
export const builder = (yargs: Argv) =>
  yargs
    .option("project", { type: "string", demandOption: true })
    .option("command", { type: "string", demandOption: true })
    .option("idempotency-key", { type: "string", demandOption: true })
    .option("input", { type: "string", default: "{}", describe: "JSON command input" });

export const createHandler = (client?: ReturnType<typeof createMachineAutomationClient>) =>
  async function createRun(
    argv: Arguments<{ project: string; command: string; idempotencyKey: string; input: string }>,
  ) {
    const automationClient = client ?? createMachineAutomationClient();
    const input = JSON.parse(argv.input) as CreateAutomationRunInput["input"];
    const run = await automationClient.createRun(argv.project, argv.idempotencyKey, { commandId: argv.command, input });
    console.log(JSON.stringify(run, null, 2));
  };

export const handler = createHandler();
