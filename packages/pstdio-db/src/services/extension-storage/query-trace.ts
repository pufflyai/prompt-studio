import { appendFileSync } from "node:fs";
import { type SQL, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";

/** Opt-in local query diagnostics: no predicates, projected values, documents or credentials. */
export const traceStorageQuery = (phase: string, index: string) => {
  if (process.env.PSTDIO_STORAGE_QUERY_TRACE === "1")
    console.info(JSON.stringify({ diagnostic: "storage-query", phase, index, at: performance.now() }));
};

type QueryPlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  "Index Name"?: string;
  "Plan Rows": number;
  Plans?: QueryPlanNode[];
};

const summarizePlan = (node: QueryPlanNode): object => ({
  type: node["Node Type"],
  relation: node["Relation Name"],
  index: node["Index Name"],
  estimatedRows: node["Plan Rows"],
  children: node.Plans?.map(summarizePlan),
});

export const traceTicketQueryPlan = async (
  tx: Pick<DbClient, "execute">,
  index: string,
  operation: string,
  statement: SQL,
) => {
  const output = process.env.BENCHMARK_RESULTS;
  if (!output || process.env.PSTDIO_BENCHMARK_COUNTERS !== "1" || index !== "ticket-view") return;
  const result = await tx.execute<{ "QUERY PLAN": { Plan: QueryPlanNode }[] }>(sql`EXPLAIN (FORMAT JSON) ${statement}`);
  const plan = result.rows[0]?.["QUERY PLAN"][0]?.Plan;
  if (plan)
    appendFileSync(
      `${output}.ticket-query-plans.jsonl`,
      `${JSON.stringify({ at: performance.now(), operation, plan: summarizePlan(plan) })}\n`,
    );
};
