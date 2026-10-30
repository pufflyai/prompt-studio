import { createInterface } from "node:readline";

const emit = (event: object) => process.stdout.write(`${JSON.stringify(event)}\n`);
let count = 0;
createInterface({ input: process.stdin }).on("line", (line) => {
  const input = JSON.parse(line);
  if (input.type !== "user") return;
  if (count++ === 0) emit({ type: "system", subtype: "init", session_id: "same-thread" });
  const echo = { ...input, isReplay: true };
  emit(echo);
  if (count === 1) return;
  emit(echo);
  emit({
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text: "Correction processed" }] },
  });
  emit({ type: "result", usage: {} });
});
