import type { Argv, CommandModule } from "yargs";
import { apiClient } from "@/features/api-client";

const team = (command: Argv) => command.positional("accountId", { type: "string", demandOption: true });

const projectMember = (command: Argv) =>
  team(command)
    .positional("workbenchId", { type: "string", demandOption: true })
    .positional("userId", { type: "string", demandOption: true });

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
      .command("project-access <accountId>", "List team project grants", team, async ({ accountId }) => {
        print(await apiClient().account.readTeamMembership({ op: "projectAccess", accountId }));
      })
      .command(
        "grant-project <accountId> <workbenchId> <userId>",
        "Give a team member project access",
        projectMember,
        async ({ accountId, workbenchId, userId }) => {
          print(
            await apiClient().account.writeTeamMembership({
              op: "setProjectAccess",
              accountId,
              workbenchId,
              userId,
              granted: true,
            }),
          );
        },
      )
      .command(
        "revoke-project <accountId> <workbenchId> <userId>",
        "Remove a team member's project access",
        projectMember,
        async ({ accountId, workbenchId, userId }) => {
          print(
            await apiClient().account.writeTeamMembership({
              op: "setProjectAccess",
              accountId,
              workbenchId,
              userId,
              granted: false,
            }),
          );
        },
      )
      .command(
        "ownership-offer <accountId>",
        "Read the current ownership offer for you",
        team,
        async ({ accountId }) => {
          print(await apiClient().account.readTeamMembership({ op: "ownershipOffer", accountId }));
        },
      )
      .command(
        "offer-ownership <accountId> <recipientUserId>",
        "Offer team ownership to an active member",
        (command) => team(command).positional("recipientUserId", { type: "string", demandOption: true }),
        async ({ accountId, recipientUserId }) => {
          print(await apiClient().account.writeTeamMembership({ op: "offerOwnership", accountId, recipientUserId }));
        },
      )
      .command(
        "answer-ownership <accountId> <offerId> <decision>",
        "Accept, decline or cancel an ownership offer",
        (command) =>
          team(command)
            .positional("offerId", { type: "string", demandOption: true })
            .positional("decision", { choices: ["accept", "decline", "cancel"] as const, demandOption: true }),
        async ({ accountId, offerId, decision }) => {
          print(await apiClient().account.writeTeamMembership({ op: "answerOwnership", accountId, offerId, decision }));
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
