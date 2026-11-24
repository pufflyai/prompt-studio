import { and, asc, eq, exists, type SQLWrapper } from "drizzle-orm";
import { z } from "zod";
import { readAccountFeatures, relayEnabled } from "./account-features";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { DeviceAccessDenied } from "./renewal-errors";
import { accounts, projectMembers, spaceKeys, teamMembers, teams } from "./schema";

type Reader = Pick<ManagerDatabase, "select">;
export const teamNameSchema = z.string().trim().min(1).max(100);

export const listTeams = (db: Reader, userId: string) =>
  db
    .select({
      accountId: teams.accountId,
      name: teams.name,
      role: teamMembers.role,
      relay: relayEnabled(db, teams.accountId),
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.accountId, teamMembers.accountId))
    .innerJoin(accounts, eq(accounts.id, teams.accountId))
    .where(and(eq(teamMembers.userId, userId), eq(accounts.state, "active")))
    .orderBy(asc(teams.name), asc(teams.accountId))
    .then((rows) => rows.map(({ relay, ...team }) => ({ ...team, features: { relay } })));

export const createTeam = async (transaction: ManagerTransaction, userId: string, input: unknown) => {
  const name = teamNameSchema.parse(input);
  const accountId = crypto.randomUUID();
  const role = "owner";
  await transaction.insert(accounts).values({ id: accountId, state: "active" });
  await transaction.insert(teams).values({ accountId, name });
  await transaction.insert(teamMembers).values({ accountId, userId, role });
  return { accountId, name, role, features: await readAccountFeatures(transaction, accountId) };
};

export const requireTeamMember = async (db: Reader, accountId: string, userId: string) => {
  const [member] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(accounts, eq(accounts.id, teamMembers.accountId))
    .where(and(eq(teamMembers.accountId, accountId), eq(teamMembers.userId, userId), eq(accounts.state, "active")));
  if (!member) throw new DeviceAccessDenied();
  return member;
};

export const canUseTeamProject = (
  db: Reader,
  accountId: string | SQLWrapper,
  workbenchId: string | SQLWrapper,
  userId: string | SQLWrapper,
) =>
  exists(
    db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .innerJoin(accounts, eq(accounts.id, projectMembers.accountId))
      .where(
        and(
          eq(projectMembers.accountId, accountId),
          eq(projectMembers.workbenchId, workbenchId),
          eq(projectMembers.userId, userId),
          eq(accounts.state, "active"),
        ),
      ),
  );

export const hasTeamIdentity = async (db: Reader, userId: string) => {
  const [membership] = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1);
  if (membership) return true;
  // A departed user's key history still belongs to the same person.
  const [keys] = await db
    .select({ ownerId: spaceKeys.ownerId })
    .from(spaceKeys)
    .where(eq(spaceKeys.ownerId, userId))
    .limit(1);
  return Boolean(keys);
};
