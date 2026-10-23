import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

appendFileSync(process.argv[2]!, `${process.pid}\n`);
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (request.id === undefined) continue;
  let result: unknown = {};
  if (request.method === "initialize")
    result = {
      protocolVersion: request.params.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: "cleanup-fixture", version: "1" },
    };
  if (request.method === "tools/list") result = { tools: [] };
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, result })}\n`);
}
