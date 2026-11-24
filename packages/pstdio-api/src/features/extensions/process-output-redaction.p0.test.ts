import { expect, test } from "bun:test";
import type { ProcessEvent, ProcessHandle } from "pstdio-api-contracts/extension-kernel";
import { redactProcessOutput, redactText } from "./process-output-redaction";

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

test("output that cannot start a granted value is not held back", async () => {
  const seen: string[] = [];
  const handle = redactProcessOutput(
    {
      events: async function* () {
        yield { type: "stdout", data: new TextEncoder().encode("ready\n") } as ProcessEvent;
        // The child waits for input here; the prompt must already be visible.
        expect(seen).toEqual(["ready\n"]);
        yield { type: "stdout", data: new TextEncoder().encode("sec") } as ProcessEvent;
        expect(seen).toEqual(["ready\n"]);
        yield { type: "stdout", data: new TextEncoder().encode("ret done") } as ProcessEvent;
        yield { type: "exit", exit: { code: 0, signal: null } } as ProcessEvent;
      },
    } as unknown as ProcessHandle,
    ["a-very-long-granted-credential", "secret"],
  );
  for await (const event of handle.events())
    if (event.type === "stdout") seen.push(new TextDecoder().decode(event.data));
  expect(seen.join("")).toBe("ready\n[Redacted] done");
});

test("many matches of one value redact in linear time when another value is absent", async () => {
  const chunk = "ab".repeat(200_000);
  const started = performance.now();
  const text = await stdout(redactProcessOutput(streamed(chunk), ["ab", "x".repeat(64)]));
  expect(text).toBe("[Redacted]".repeat(200_000));
  expect(performance.now() - started).toBeLessThan(2_000);
});

test("overlapping granted values are hidden whole, in streams and in collected output", async () => {
  expect(await stdout(redactProcessOutput(streamed("x abcdefg y"), ["abc", "bcdefg"]))).toBe("x [Redacted] y");
  // The second value only completes in the next chunk.
  expect(await stdout(redactProcessOutput(streamed("x abcd", "efg y"), ["abc", "bcdefg"]))).toBe("x [Redacted] y");
  expect(redactText("x abcdefg y", ["abc", "bcdefg"])).toBe("x [Redacted] y");
});
