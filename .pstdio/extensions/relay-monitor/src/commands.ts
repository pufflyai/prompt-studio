import { defineCommand, params } from "@pstdio/sdk/extensions";
import { readFailures } from "./failures";
import { checkConnection, inputSchema, readSnapshot } from "./source";

const inputs = {
  range: params.text({ defaultValue: "24h" }),
  section: params.text({ defaultValue: "Overview" }),
};
const read = (id: string, section?: string) =>
  defineCommand({
    id,
    title: `Read relay ${id}`,
    cli: true,
    params: inputs,
    run: (ctx, input) => readSnapshot(ctx, { ...input, ...(section ? { section } : {}) }),
  });
export const commands = {
  status: read("status"),
  checks: read("checks"),
  history: read("history"),
  storage: read("storage", "Storage"),
  infrastructure: read("infrastructure", "Infrastructure"),
  "connection.check": defineCommand({
    id: "connection.check",
    title: "Check monitoring connection",
    cli: true,
    params: inputs,
    run: (ctx) => checkConnection(ctx),
  }),
  failures: defineCommand({
    id: "failures",
    title: "Read redacted service failures",
    cli: true,
    params: { range: inputs.range, before: params.text() },
    run: (ctx, input) => readFailures(ctx, inputSchema.parse(input).range, input.before),
  }),
};
