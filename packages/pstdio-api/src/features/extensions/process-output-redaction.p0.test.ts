import { expect, test } from "bun:test";
import type { ProcessEvent, ProcessHandle } from "pstdio-api-contracts/extension-kernel";
import { redactProcessOutput } from "./process-output-redaction";

const streamed = (...chunks: string[]) =>
  ({
    events: async function* () {
      for (const chunk of chunks) yield { type: "stdout", data: new TextEncoder().encode(chunk) } as ProcessEvent;
      yield { type: "exit", exit: { code: 0, signal: null } } as ProcessEvent;
    },
  }) as unknown as ProcessHandle;

const stdout = async (handle: ProcessHandle) => {
  let text = "";
  for await (const event of handle.events()) if (event.type === "stdout") text += new TextDecoder().decode(event.data);
  return text;
};

test("a value whose prefix is another granted value is hidden whole, even split across chunks", async () => {
  expect(await stdout(redactProcessOutput(streamed("xxabc", "def yy"), ["abc", "abcdef"]))).toBe("xx[Redacted] yy");
  expect(await stdout(redactProcessOutput(streamed("xxabc", " yy"), ["abc", "abcdef"]))).toBe("xx[Redacted] yy");
});

test("values split over several chunks and at the very end are hidden", async () => {
  expect(await stdout(redactProcessOutput(streamed("a", "sec", "ret", "b secr", "et"), ["secret"]))).toBe(
    "a[Redacted]b [Redacted]",
  );
});
