import type { Arguments, Argv } from "yargs";
import { createMachineAutomationClient } from "./client";

export const command = "watch";
export const describe = "Wait for an automation run to finish";
export const builder = (yargs: Argv) =>
  yargs.option("project", { type: "string", demandOption: true }).option("id", { type: "string", demandOption: true });

const terminal = new Set(["succeeded", "failed", "cancelled", "rejected"]);

export const createHandler = (client?: ReturnType<typeof createMachineAutomationClient>) =>
  async function watchRun(argv: Arguments<{ project: string; id: string }>) {
    const automationClient = client ?? createMachineAutomationClient();
    for (;;) {
      const run = await automationClient.getRun(argv.project, argv.id);
      if (terminal.has(run.status)) {
        console.log(JSON.stringify(run, null, 2));
        return;
      }
      await Bun.sleep(1000);
    }
  };

export const handler = createHandler();
