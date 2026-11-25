import { expect, test } from "bun:test";
import type { ProcessEvent, ProcessHandle } from "pstdio-api-contracts/extension-kernel";
import { redactText } from "./process-output-redaction";
import { redactProcessOutput } from "./process-output-stream-redaction";

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

test("overlapping values hold back at most the longest value and redact in linear time", async () => {
  // Each copy of the value overlaps the next by one byte, so the run never ends.
  const value = "tok9Zt";
  const chunks = Array.from({ length: 4_000 }, () => "tok9Z");
  const seen: string[] = [];
  const started = performance.now();
  const handle = redactProcessOutput(
    {
      events: async function* () {
        for (const chunk of chunks) yield { type: "stdout", data: new TextEncoder().encode(chunk) } as ProcessEvent;
        yield { type: "exit", exit: { code: 0, signal: null } } as ProcessEvent;
      },
    } as unknown as ProcessHandle,
    [value],
  );
  let emittedBeforeExit = 0;
  for await (const event of handle.events()) {
    if (event.type === "stdout") seen.push(new TextDecoder().decode(event.data));
    if (event.type !== "exit") emittedBeforeExit = seen.length;
  }
  expect(emittedBeforeExit).toBeGreaterThan(1);
  expect(seen.join("")).not.toContain("tok9Zt");
  expect(performance.now() - started).toBeLessThan(2_000);
  const mutual = "xyz".repeat(100_000);
  const collected = performance.now();
  expect(redactText(mutual, ["xy", "yzx"])).not.toContain("xy");
  expect(performance.now() - collected).toBeLessThan(2_000);
});

test("hides overlapping values in collected output", () => {
  expect(redactText("before abcdefg after", ["abc", "bcdefg"])).toBe("before [Redacted] after");
  expect(redactText("before abcdefg after", ["bcdefg", "abc"])).toBe("before [Redacted] after");
  expect(redactText("before abcdefg after", ["ab", "abc", "bcdefg"])).toBe("before [Redacted] after");
});

test("preserves neighboring text around long overlapping runs", () => {
  const repeated = "ab".repeat(25_000);
  expect(redactText(`一${repeated}🙂c`, ["aba", "bab", "b🙂c", "🙂", ""])).toBe("一[Redacted]");
  expect(redactText("🙂abc🙂abc🙂", ["abc"])).toBe("🙂[Redacted]🙂[Redacted]🙂");
});

test("closing redacted output releases its underlying pending read", async () => {
  const pending = Promise.withResolvers<IteratorResult<ProcessEvent>>();
  const entered = Promise.withResolvers<void>();
  const done = { done: true, value: undefined } as const;
  const source = {
    ...streamed(),
    events: () => ({
      [Symbol.asyncIterator]: () => ({
        next() {
          entered.resolve();
          return pending.promise;
        },
        async return() {
          pending.resolve(done);
          return done;
        },
      }),
    }),
  };
  const iterator = redactProcessOutput(source, ["fixture-grant"]).events()[Symbol.asyncIterator]();
  const read = iterator.next();
  await entered.promise;
  try {
    const returned = iterator.return!();
    expect(await Promise.race([Promise.all([read, returned]), Bun.sleep(100).then(() => "pending")])).toEqual([
      done,
      done,
    ]);
  } finally {
    pending.resolve(done);
  }
});
