import { expect, test } from "bun:test";
import type { CommandContext } from "@pstdio/sdk/extensions";
import { readQuotas } from "./quotas";

test("Home reads quota commands independently and leaves disabled providers out", async () => {
  const seen: string[] = [];
  const context = {
    extensions: {
      list: async () => ({
        extensions: [{ extensionId: "pstdio.harness-codex", icon: "installed-codex-icon" }],
        marketplace: [{ extensionId: "pstdio.harness-codex", icon: "catalog-codex-icon" }],
      }),
    },
    commands: {
      execute: async (ref: { extensionId: string }) => {
        seen.push(ref.extensionId);
        if (ref.extensionId.includes("claude")) throw new Error("transport lost");
        if (ref.extensionId.includes("open-code")) return { ok: false, code: "command_not_found" };
        if (ref.extensionId.includes("harness-pi"))
          return {
            ok: true,
            value: {
              status: "unsupported",
              checkedAt: "2026-11-10T12:00:00Z",
              message: "Pi does not expose account quotas.",
              limits: [],
            },
          };
        return {
          ok: true,
          value: {
            status: "available",
            checkedAt: "2026-11-10T12:00:00Z",
            limits: [{ id: "weekly", label: "Weekly", remainingPercent: 0 }],
          },
        };
      },
    },
  } as unknown as CommandContext;
  const reports = await readQuotas(context);
  expect(seen).toHaveLength(4);
  expect(reports.map((report) => report.label)).toEqual(["Codex", "Claude Code", "Pi"]);
  expect(reports[0]?.limits[0]?.remainingPercent).toBe(0);
  expect(reports[0]?.icon).toBe("installed-codex-icon");
  expect(reports[1]?.status).toBe("unavailable");
  expect(reports[2]?.status).toBe("unsupported");
});

test("Home rejects malformed quota results without losing other providers", async () => {
  const context = {
    commands: {
      execute: async () => ({ ok: true, value: { status: "available", limits: [{ remainingPercent: Infinity }] } }),
    },
  } as unknown as CommandContext;
  expect((await readQuotas(context)).every((report) => report.status === "unavailable")).toBe(true);
});

test("Home still returns native quotas when optional icon metadata stalls", async () => {
  const context = {
    extensions: { list: () => new Promise(() => {}) },
    commands: {
      execute: async () => ({
        ok: true,
        value: {
          status: "available",
          checkedAt: "2026-11-10T12:00:00Z",
          limits: [{ id: "weekly", label: "Weekly", remainingPercent: 42 }],
        },
      }),
    },
  } as unknown as CommandContext;
  const reports = await readQuotas(context);
  expect(reports[0]?.status).toBe("available");
  expect(reports[0]?.icon).toBeUndefined();
});

test("Home preserves cancellation during optional metadata lookup", async () => {
  const controller = new AbortController();
  const context = {
    signal: controller.signal,
    extensions: {
      list: async () => {
        controller.abort(new Error("quota read cancelled"));
        throw controller.signal.reason;
      },
    },
    commands: {
      execute: async () => ({
        ok: true,
        value: {
          status: "available",
          checkedAt: "2026-11-10T12:00:00Z",
          limits: [{ id: "weekly", label: "Weekly", remainingPercent: 42 }],
        },
      }),
    },
  } as unknown as CommandContext;
  await expect(readQuotas(context)).rejects.toThrow("quota read cancelled");
});
