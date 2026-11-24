import { and, asc, eq, sql } from "drizzle-orm";
import type { ManagerTransaction } from "./database";
import { accounts, projectMembers, teamMembers, workbenches } from "./schema";
import { rotateProjectSharedKeys } from "./space-keys";
import { TeamMembershipDenied } from "./teams";

const teamProject = (accountId: string, workbenchId: string) =>
  and(eq(projectMembers.accountId, accountId), eq(projectMembers.workbenchId, workbenchId));

export const teamUserProjectIds = async (transaction: ManagerTransaction, accountId: string, userId: string) =>
  (
    await transaction
      .select({ id: projectMembers.workbenchId })
      .from(projectMembers)
      .where(and(eq(projectMembers.accountId, accountId), eq(projectMembers.userId, userId)))
  ).map(({ id }) => id);

export const hasTeamProjectGrant = async (
  transaction: ManagerTransaction,
  accountId: string,
  workbenchId: string,
  userId: string,
) => {
  const [grant] = await transaction
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(teamProject(accountId, workbenchId), eq(projectMembers.userId, userId)));
  return Boolean(grant);
};

// Owners can manage grant metadata even after removing their own content access.
export const listTeamProjectAccess = (transaction: ManagerTransaction, accountId: string) =>
  transaction
    .select({
      workbenchId: workbenches.id,
      userIds: sql<string[]>`coalesce(array_agg(${projectMembers.userId} order by ${projectMembers.userId})
        filter (where ${projectMembers.userId} is not null), array[]::text[])`,
    })
    .from(workbenches)
    .leftJoin(
      projectMembers,
      and(eq(projectMembers.accountId, workbenches.accountId), eq(projectMembers.workbenchId, workbenches.id)),
    )
    .where(eq(workbenches.accountId, accountId))
    .groupBy(workbenches.id)
    .orderBy(asc(workbenches.id));

// The caller holds the owning team lock. Removal and the next shared generation commit together.
export const updateTeamProjectGrant = async (
  transaction: ManagerTransaction,
  accountId: string,
  workbenchId: string,
  userId: string,
  granted: boolean,
) => {
  const [project] = await transaction
    .select({ id: workbenches.id })
    .from(workbenches)
    .where(and(eq(workbenches.accountId, accountId), eq(workbenches.id, workbenchId)));
  if (!project) return false;

  if (granted) {
    const [member] = await transaction
      .select({ id: teamMembers.userId })
      .from(teamMembers)
      .innerJoin(accounts, eq(accounts.id, teamMembers.userId))
      .where(and(eq(teamMembers.accountId, accountId), eq(teamMembers.userId, userId), eq(accounts.state, "active")));
    if (!member) throw new TeamMembershipDenied("Only active team members can access a team project");
    await transaction.insert(projectMembers).values({ accountId, workbenchId, userId }).onConflictDoNothing();
  } else {
    const [removed] = await transaction
      .delete(projectMembers)
      .where(and(teamProject(accountId, workbenchId), eq(projectMembers.userId, userId)))
      .returning({ userId: projectMembers.userId });
    if (removed) await rotateProjectSharedKeys(transaction, accountId, [workbenchId]);
  }
  return true;
};
