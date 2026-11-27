import type { ManagerTransaction } from "./database";
import type { Snapshot } from "./recovery";
import { accounts } from "./schema";

export const assertTeamUsersMatch = async (transaction: ManagerTransaction, snapshot: Snapshot) => {
  const users = new Set((snapshot.teamMembers ?? []).map(({ userId }) => userId));
  for (const key of snapshot.keys) if (key.ownerId) users.add(key.ownerId);
  if (!users.size) return;
  const known = new Map((await transaction.select().from(accounts)).map((row) => [row.id, row]));
  for (const account of snapshot.accounts) {
    if (!users.has(account.id)) continue;
    const current = known.get(account.id);
    if (current && (current.ownerIssuer !== account.ownerIssuer || current.ownerSubject !== account.ownerSubject))
      throw new Error("Manager snapshot conflicts with a verified team user");
  }
};
