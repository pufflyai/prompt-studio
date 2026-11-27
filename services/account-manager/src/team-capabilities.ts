import type { ManagerTransaction } from "./database";
import { teamProjectGrant } from "./team-project-access";
import { requireTeamMember } from "./teams";

// Team administration and project authority remain distinct when custom roles are added.
export const resolveTeamCapabilities = async (
  transaction: ManagerTransaction,
  accountId: string,
  userId: string,
  workbenchId?: string,
) => {
  const { role } = await requireTeamMember(transaction, accountId, userId);
  const owner = role === "owner";
  const assigned =
    workbenchId !== undefined && Boolean(await teamProjectGrant(transaction, accountId, workbenchId, userId));
  return {
    manageTeam: owner,
    manageManagedExtensions: owner,
    manageProjectAccess: owner || assigned,
    manageProject: owner || assigned,
    publishProjectExtensions: assigned,
  };
};
