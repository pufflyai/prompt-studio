import { type SQL, sql } from "drizzle-orm";

export const seedRetirementGraph = async (execute: (query: SQL) => Promise<unknown>, count: number) => {
  const accountId = `retirement-account-${crypto.randomUUID()}`;
  const projectKey = `retirement-project-${crypto.randomUUID()}`;
  await execute(sql`INSERT INTO relay_sync_projects ("projectKey", "accountId", "createdAt")
    VALUES (${projectKey}, ${accountId}, '2020-01-01')`);
  await execute(sql`INSERT INTO relay_sync_blobs
    ("projectKey", "blobId", "sha256", "byteLength", status, "createdAt", "completedAt", children)
    SELECT ${projectKey}, 'a-retained-' || lpad(n::text, 6, '0'), repeat('a',64), 1,
      'completed', '2020-01-01', '2020-01-01',
      CASE WHEN n < ${count} THEN ARRAY['a-retained-' || lpad((n+1)::text,6,'0')] ELSE '{}'::text[] END
    FROM generate_series(1,${count}) n`);
  await execute(sql`INSERT INTO relay_sync_blobs
    ("projectKey", "blobId", "sha256", "byteLength", status, "createdAt")
    SELECT ${projectKey}, 'z-expired-' || lpad(n::text,6,'0'), repeat('b',64),1,'open','2020-01-01'
    FROM generate_series(1,${count}) n`);
  await execute(sql`INSERT INTO relay_sync_updates
    ("projectKey", "documentId", sequence, "updateId", "deviceId", "byteLength", "objectKey", "blobIds", "createdAt")
    VALUES (${projectKey},'document',1,'update','device',1,${crypto.randomUUID()},ARRAY['a-retained-000001'],'2020-01-01')`);
  return { accountId, projectKey };
};

export interface RetirementPlan {
  "Node Type": string;
  "Relation Name"?: string;
  "Actual Rows"?: number;
  "Actual Loops"?: number;
  "Rows Removed by Filter"?: number;
  "Rows Removed by Index Recheck"?: number;
  Plans?: RetirementPlan[];
}
export const retirementPlanNodes = (plan: RetirementPlan): RetirementPlan[] => [
  plan,
  ...(plan.Plans ?? []).flatMap(retirementPlanNodes),
];
