import type { Argv, CommandModule } from "yargs";
import { apiClient } from "@/features/api-client";

const team = (command: Argv) => command.positional("accountId", { type: "string", demandOption: true });

const invitation = async () => {
  if (process.stdin.isTTY) throw new Error("Pass the invitation link on standard input");
  const url = (await Bun.stdin.text()).trim();
  if (!url || url.length > 2048) throw new Error("Pass a valid invitation link on standard input");
  return url;
};

const print = (result: unknown) => console.log(JSON.stringify(result));

export const teamsCommand = {
  command: "teams",
  describe: "Create and manage Cloud teams",
  builder: (yargs) =>
    yargs
      .command("list", "List your Cloud teams", {}, async () => {
        print(await apiClient().account.teams());
      })
      .command(
        "create <name>",
        "Create a Cloud team",
        (command) => command.positional("name", { type: "string", demandOption: true }),
        async ({ name }) => {
          print(await apiClient().account.createTeam(name));
        },
      )
      .command("members <accountId>", "List a team's members", team, async ({ accountId }) => {
        print(await apiClient().account.readTeamMembership({ op: "members", accountId }));
      })
      .command("invitations <accountId>", "List a team's outstanding invitations", team, async ({ accountId }) => {
        print(await apiClient().account.readTeamMembership({ op: "invitations", accountId }));
      })
      .command(
        "invite <accountId> <email>",
        "Create an invitation to share privately",
        (command) => team(command).positional("email", { type: "string", demandOption: true }),
        async ({ accountId, email }) => {
          print(await apiClient().account.writeTeamMembership({ op: "invite", accountId, email }));
        },
      )
      .command(
        "invite-microsoft <accountId> <tenantId> <objectId>",
        "Create a private invitation for a Microsoft Entra user",
        (command) =>
          team(command)
            .positional("tenantId", { type: "string", demandOption: true })
            .positional("objectId", { type: "string", demandOption: true }),
        async ({ accountId, tenantId, objectId }) => {
          print(
            await apiClient().account.writeTeamMembership({
              op: "invite",
              accountId,
              microsoft: { tenantId, objectId },
            }),
          );
        },
      )
      .command(
        "cancel-invitation <accountId> <invitationId>",
        "Cancel an invitation",
        (command) => team(command).positional("invitationId", { type: "string", demandOption: true }),
        async ({ accountId, invitationId }) => {
          print(await apiClient().account.writeTeamMembership({ op: "cancelInvitation", accountId, invitationId }));
        },
      )
      .command(
        "remove-member <accountId> <userId>",
        "Remove a member from a team",
        (command) => team(command).positional("userId", { type: "string", demandOption: true }),
        async ({ accountId, userId }) => {
          print(await apiClient().account.writeTeamMembership({ op: "removeMember", accountId, userId }));
        },
      )
      .command("leave <accountId>", "Leave a team", team, async ({ accountId }) => {
        print(await apiClient().account.writeTeamMembership({ op: "leave", accountId }));
      })
      .command("inspect-invitation", "Inspect an invitation link read from standard input", {}, async () => {
        print(await apiClient().account.readTeamMembership({ op: "inspectInvitation", url: await invitation() }));
      })
      .command("join", "Accept an invitation link read from standard input", {}, async () => {
        print(await apiClient().account.writeTeamMembership({ op: "acceptInvitation", url: await invitation() }));
      })
      .demandCommand(1),
  handler: () => {},
} satisfies CommandModule;
