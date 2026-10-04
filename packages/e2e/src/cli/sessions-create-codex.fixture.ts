import { appendFileSync } from "node:fs";

if (process.argv.includes("--version")) {
  console.log("codex-cli 0.0.0");
  process.exit(0);
}
const emit = (event: unknown) => console.log(JSON.stringify(event));
for await (const line of console) {
  const request = JSON.parse(line);
  if (request.method === "initialize") emit({ id: request.id, result: {} });
  if (request.method === "thread/start")
    emit({ id: request.id, result: { thread: { id: "codex-e2e-thread", path: null } } });
  // Session creation reads the model list to resolve harness parameters.
  if (request.method === "model/list") emit({ id: request.id, result: { data: [{ id: "gpt-5.5", isDefault: true }] } });
  if (request.method !== "turn/start") continue;
  appendFileSync(
    process.env.CODEX_E2E_PROMPTS!,
    `${request.params.input.map((part: { text: string }) => part.text).join("\n")}\n`,
  );
  emit({ id: request.id, result: {} });
  emit({ method: "item/completed", params: { item: { id: "item_0", type: "agentMessage", text: "done" } } });
  emit({ method: "turn/completed", params: { turn: { status: "completed" } } });
}
