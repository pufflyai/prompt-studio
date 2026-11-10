import { expect, test } from "bun:test";
import { normalizeOpencodeQuotas, readOpencodeQuotas } from "./quotas";

test("OpenCode reports Go windows and account budgets", () => {
  const result = normalizeOpencodeQuotas({
    data: {
      go: {
        rolling: { percent: 20, limited: false, resetsAt: 1800000000000 },
        weekly: { percent: 100, limited: true, resetsAt: 1800000000000 },
        monthly: { percent: 0, limited: false, resetsAt: 1800000000000 },
      },
      budgets: [{ id: "team", limit: 200, spent: 50, resetsAt: 1800000000000 }],
    },
  });
  expect(result.status).toBe("available");
  expect(result.limits.map((limit) => limit.remainingPercent)).toEqual([80, 0, 100, 75]);
  expect(result.limits[0]?.resetsAt).toBe("2027-01-15T08:00:00.000Z");
});

test("OpenCode reads account limits through the standalone native API and keeps errors private", async () => {
  let command: string[] = [];
  const report = await readOpencodeQuotas({
    process: {
      run: async (input: { command: string[] }) => {
        command = input.command;
        return { exitCode: 0, stdout: JSON.stringify({ data: null }), stderr: "" };
      },
    },
  } as never);
  expect(command.slice(1)).toEqual(["api", "GET", "/api/experimental/usage/limits", "--standalone"]);
  expect(report.status).toBe("unavailable");
  const failed = await readOpencodeQuotas({
    process: { run: async () => ({ exitCode: 1, stdout: "sensitive native output", stderr: "credential" }) },
  } as never);
  expect(JSON.stringify(failed)).not.toContain("credential");
  expect(JSON.stringify(failed)).not.toContain("sensitive native output");
});
