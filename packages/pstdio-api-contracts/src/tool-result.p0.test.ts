import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { ToolPart } from "./session-messages";
import { createToolOutputBuffer, normalizeToolResult, toolOutputFingerprint, toolResultBytes } from "./tool-result";

const tool = (state: ToolPart["state"]): ToolPart => ({ type: "tool", tool: "shell", status: "completed", state });

test("normal text and structured results retain their complete value and type", () => {
  for (const output of ["normal\noutput", { files: ["a", "b"], count: 2 }, "", null]) {
    const part = tool({ output, errorText: "failure", metadata: { exitCode: 1 } });
    expect(normalizeToolResult(part)).toBe(part);
  }
});

test("one allowance covers a 76 MB failed result, duplicate errors, metadata and omission metadata", () => {
  const output = `START${"x".repeat(76_000_000)}END`;
  const result = normalizeToolResult(tool({ output, errorText: output, metadata: { copy: output } }));
  expect(toolResultBytes(result)).toBeLessThanOrEqual(262144);
  expect(result.state?.output).toContain("START");
  expect(result.state?.output).toContain("END");
  expect(result.state?.resultSummary?.originalBytes).toBeGreaterThan(228_000_000);
  expect(result.state?.resultSummary?.omittedBytes).toBeGreaterThan(227_000_000);
  expect(normalizeToolResult(result)).toBe(result);
});

test("many small structured values and escaped Unicode obey the aggregate serialized allowance", () => {
  for (const output of [Array.from({ length: 80000 }, (_, i) => ({ [i]: "small" })), '😀"\n\\é'.repeat(100000)]) {
    const result = normalizeToolResult(tool({ output }));
    expect(toolResultBytes(result)).toBeLessThanOrEqual(262144);
    expect(String(result.state?.output)).not.toContain("\ufffd");
    expect(result.state?.resultSummary?.omittedBytes).toBeGreaterThan(0);
  }
});

test("changed allowances preserve original identity and never count an existing marker as output", () => {
  const original = tool({ output: `HEAD${"x".repeat(1000000)}TAIL` });
  const saved = normalizeToolResult(original, 65536);
  expect(normalizeToolResult(saved, 262144)).toBe(saved);
  const smaller = normalizeToolResult(saved, 32768);
  expect(toolResultBytes(smaller)).toBeLessThanOrEqual(32768);
  expect(smaller.state?.resultSummary?.originalBytes).toBe(saved.state?.resultSummary?.originalBytes);
  expect(toolOutputFingerprint(smaller)).toBe(toolOutputFingerprint(original));
  expect(String(smaller.state?.output).match(/bytes omitted/g)).toHaveLength(1);
});

test("fingerprints distinguish results with identical retained ends and use returnDisplay for comparison", () => {
  const a = tool({ output: { extra: "native metadata", returnDisplay: `HEAD${"x".repeat(1000000)}TAIL` } });
  const b = tool({ output: `HEAD${"y".repeat(1000000)}TAIL` });
  const aSummary = normalizeToolResult(a);
  expect(toolOutputFingerprint(aSummary)).toBe(
    toolOutputFingerprint(
      tool({ output: a.state?.output && (a.state.output as { returnDisplay: string }).returnDisplay }),
    ),
  );
  expect(toolOutputFingerprint(aSummary)).not.toBe(toolOutputFingerprint(normalizeToolResult(b)));
});

test("streaming 76 MB retains bounded state for different chunk sizes and keeps the final tail", () => {
  for (const chunkSize of [1000, 76000, 1000000]) {
    const buffer = createToolOutputBuffer();
    const chunk = "x".repeat(chunkSize);
    buffer.append("HEAD");
    for (let bytes = 0; bytes < 76_000_000; bytes += chunkSize)
      buffer.append(chunk.slice(0, Math.min(chunkSize, 76_000_000 - bytes)));
    buffer.append("TAIL");
    const result = tool(buffer.result());
    expect(toolResultBytes(result)).toBeLessThanOrEqual(262144);
    expect(result.state?.output).toMatch(/^HEAD[\s\S]*TAIL$/);
    expect(result.state?.resultSummary?.originalBytes).toBe(76_000_008);
    expect(buffer.retainedBytes).toBeLessThanOrEqual(524288);
  }
});

test("streaming split surrogate pairs has the same identity as complete Unicode output", () => {
  const buffer = createToolOutputBuffer();
  buffer.append("\ud83d");
  buffer.append("\ude00");
  buffer.append("é".repeat(200000));
  buffer.append("\ud83d");
  buffer.append("\ude00");
  const streamed = tool(buffer.result());
  expect(toolOutputFingerprint(streamed)).toBe(toolOutputFingerprint(tool({ output: `😀${"é".repeat(200000)}😀` })));
  expect(String(streamed.state?.output)).not.toContain("\ufffd");
});

test("host and browser results preserve standard SHA-256 identity across streaming snapshots", async () => {
  const build = await Bun.build({
    entrypoints: [resolve(import.meta.dir, "tool-result.ts")],
    target: "browser",
    define: { Bun: "undefined" },
  });
  expect(build.success).toBe(true);
  const browser: typeof import("./tool-result") = await import(
    `data:text/javascript;base64,${Buffer.from(await build.outputs[0].text()).toString("base64")}`
  );
  const output = '😀"\n\\é'.repeat(50000);
  const digest = (value: string) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  for (const api of [{ createToolOutputBuffer, normalizeToolResult }, browser]) {
    const buffer = api.createToolOutputBuffer();
    buffer.append(output.slice(0, 1));
    buffer.append(output.slice(1));
    const first = buffer.result();
    expect(first.resultSummary?.outputFingerprint).toBe(digest(output));
    expect(buffer.result()).toEqual(first);
    buffer.append("TAIL");
    expect(buffer.result().resultSummary?.outputFingerprint).toBe(digest(`${output}TAIL`));
    const normalized = api.normalizeToolResult(tool({ output }));
    expect(normalized.state?.resultSummary?.outputFingerprint).toBe(digest(output));
  }
});
