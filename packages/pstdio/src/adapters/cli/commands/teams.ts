import type { CommandModule } from "yargs";
import { apiClient } from "@/features/api-client";

export const teamsCommand = {
  command: "teams",
  describe: "Create and list Cloud teams",
  builder: (yargs) =>
    yargs
      .command("list", "List your Cloud teams", {}, async () => {
        console.log(JSON.stringify(await apiClient().account.teams()));
      })
      .command(
        "create <name>",
        "Create a Cloud team",
        (command) => command.positional("name", { type: "string", demandOption: true }),
        async ({ name }) => {
          console.log(JSON.stringify(await apiClient().account.createTeam(name)));
        },
      )
      .demandCommand(1),
  handler: () => {},
} satisfies CommandModule;
