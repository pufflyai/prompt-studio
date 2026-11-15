import { expect, test } from "bun:test";
import { mkdtemp, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeCopilotQuotas } from "./quotas";
import { readCopilotUsage } from "./usage";

const checkpoint = (timestamp: string, models: Record<string, [number, number]>, nanoAiu = 0) =>
  JSON.stringify({
    type: "session.usage_checkpoint",
    timestamp,
    data: {
      totalNanoAiu: nanoAiu,
      providerModelMetrics: Object.entries(models).map(([modelId, [inputTokens, outputTokens]]) => ({
        modelId,
        metrics: { usage: { inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 } },
      })),
    },
  });

const shutdown = (timestamp: string, models: Record<string, [number, number]>) =>
  JSON.stringify({
    type: "session.shutdown",
    timestamp,
    data: {
      modelMetrics: Object.fromEntries(
        Object.entries(models).map(([id, [inputTokens, outputTokens]]) => [
          id,
          { usage: { inputTokens, outputTokens, cacheReadTokens: 5, cacheWriteTokens: 0 } },
        ]),
      ),
    },
  });

test("usage counts only tokens added this billing cycle, across sessions and models", async () => {
  const home = await mkdtemp(join(tmpdir(), "copilot-usage-"));
  try {
    const write = async (id: string, lines: string[], modified?: Date) => {
      const file = join(home, "session-state", id, "events.jsonl");
      await Bun.write(file, `${lines.join("\n")}\n`);
      if (modified) await utimes(file, modified, modified);
    };
    // Spans the month boundary: October's 100/10 is subtracted from the latest running total.
    await write("spanning", [
      checkpoint("2026-10-30T10:00:00Z", { "gpt-6-luna": [100, 10] }, 1_000),
      '{"type":"user.message","data":{"content":"ignored"}}',
      checkpoint("2026-11-03T10:00:00Z", { "gpt-6-luna": [250, 40] }, 4_000),
      '{"type":"session.usage_checkpoint","timestamp":"2026-11-03T1', // partial line while Copilot writes
    ]);
    await write("november", [
      shutdown("2026-11-10T08:00:00Z", { "claude-sonnet-5.5": [1_000, 200], "gpt-6-luna": [50, 5] }),
    ]);
    await write(
      "october",
      [checkpoint("2026-10-12T08:00:00Z", { "gpt-6-luna": [9_999, 999] })],
      new Date("2026-10-12T08:00:00Z"),
    );

    const usage = await readCopilotUsage({ home, now: new Date("2026-11-15T12:00:00Z") });
    expect(usage).toMatchObject({
      since: "2026-11-01T00:00:00.000Z",
      scope: "device",
      inputTokens: 1_200,
      outputTokens: 235,
      cacheReadTokens: 10,
      nanoAiu: 3_000,
    });
    expect(usage.models.map((model) => [model.id, model.inputTokens, model.outputTokens])).toEqual([
      ["claude-sonnet-5.5", 1_000, 200],
      ["gpt-6-luna", 200, 35],
    ]);

    const report = normalizeCopilotQuotas(
      {
        premium_interactions: { isUnlimitedEntitlement: true, remainingPercentage: 100, tokenBasedBilling: true },
      } as never,
      usage,
    );
    expect(report).toMatchObject({ status: "unsupported", limits: [], usage: { inputTokens: 1_200 } });
    expect(report.message).toStartWith("This device used 1.2K input and 235 output tokens since Nov 1.");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("usage is empty when Copilot has no saved sessions", async () => {
  const usage = await readCopilotUsage({
    home: join(tmpdir(), "missing-copilot-home"),
    now: new Date("2026-11-15T00:00:00Z"),
  });
  expect(usage).toMatchObject({ inputTokens: 0, outputTokens: 0, models: [] });
});
