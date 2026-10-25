import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import type { StorageRecord } from "@pstdio/sdk/extensions";
import {
  compareRows,
  contract,
  editOperation,
  matches,
  owners,
  type Profile,
  pageRows,
  rowSummary,
  workload,
} from "storage-scale-fixture";
import { openScaleBrowser } from "./storage-scale-browser-session";
import { type ScaleFixture, type ScaleRuntime, startScaleRuntime } from "./storage-scale-runtime";

declare global {
  interface Window {
    scaleEditClock: { visible?: number; submitted?: number };
  }
}

export const sampleVisibleEdit = async (
  home: string,
  fixture: ScaleFixture,
  profile: Profile,
  operation: string,
  environment: Record<string, string>,
  background?: (runtime: ScaleRuntime) => Promise<unknown>,
) => {
  const owner = owners(workload(fixture.kind))[0];
  const base = pageRows(workload(fixture.kind), 0, "focus", 0);
  const nonce = randomUUID();
  const edit = editOperation(fixture.kind, operation, nonce, owner.rows, base[0].ordinal);
  const expected = base.filter((row) => row.id !== edit.recordId);
  if (edit.expected && matches(edit.expected, "focus", owner.rows)) expected.push(edit.expected);
  expected.sort(compareRows);
  const runtime = await startScaleRuntime(home, environment);
  const { browser, page, replies, diagnostics } = await openScaleBrowser(profile);
  const changedSummary = edit.expected ? rowSummary(edit.expected) : "";
  const visibleValue = operation === "short" && edit.expected ? edit.expected.title : changedSummary;
  try {
    await page.addInitScript(
      ({ before, after, removed, first }) => {
        const state: { submitted?: number; visible?: number } = {};
        Object.assign(window, { scaleEditClock: state });
        document.addEventListener(
          "click",
          (event) => {
            if (
              event.target instanceof Element &&
              event.target.closest("button")?.textContent?.includes("Save resource")
            )
              state.submitted = performance.now();
          },
          true,
        );
        new MutationObserver(() => {
          if (state.submitted === undefined || state.visible !== undefined) return;
          const text = document.body?.textContent ?? "";
          const rowsMounted = document.querySelector('[data-testid="renderer-card"]');
          if (
            rowsMounted &&
            text.includes(first) &&
            ((removed && !text.includes(before)) || (!removed && text.includes(after)))
          )
            state.visible = performance.now();
        }).observe(document, { childList: true, subtree: true, characterData: true });
      },
      {
        before: base[0].title,
        after: visibleValue,
        removed: operation === "delete" || operation === "indexed",
        first: expected[0].title,
      },
    );
    const login = await runtime.request<{ url: string }>("/runtime/browser-login", "POST");
    const url = new URL(login.url);
    url.host = new URL(runtime.baseUrl).host;
    url.pathname = `/projects/${fixture.projectId}/extensions/${owner.id}/records-board`;
    await page.goto(url.href, { waitUntil: "commit" });
    await page.getByText(base[0].title, { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Edit resource", exact: true }).click();
    await page.getByRole("textbox", { name: "Operation", exact: true }).fill(operation);
    await page.getByRole("textbox", { name: "Save identity", exact: true }).fill(nonce);
    const queryOffset = replies.length;
    const response = page.waitForResponse((reply) => reply.url().includes(".command.save-edit/execute"));
    const running = background?.(runtime);
    await page.getByRole("button", { name: "Save resource", exact: true }).click();
    const saved = await (await response).json();
    assert.equal(saved.outcome.value.outcome.status, "saved-locally");
    const expectedValues = expected.map((row) => ({ id: row.id, title: row.title, summary: rowSummary(row) }));
    const committedQuery = (reply: (typeof replies)[number]) =>
      reply.path.includes(".records-board.kanban.query") &&
      JSON.stringify(reply.rows.map((row) => ({ id: row.id, title: row.title, summary: row.attributes?.summary }))) ===
        JSON.stringify(expectedValues);
    await page.waitForFunction(() => window.scaleEditClock.visible !== undefined);
    const committedReadAt = await page.evaluate(() => performance.now());
    const committedVisibleMs = await page.evaluate((readAt) => {
      const clock = window.scaleEditClock;
      if (clock.visible === undefined || clock.submitted === undefined) throw new Error("Missing browser edit clock");
      return Math.max(clock.visible, readAt) - clock.submitted;
    }, committedReadAt);
    const details = await diagnostics();
    const query = replies.slice(queryOffset).findLast((reply) => reply.path.includes(".records-board.kanban.query"));
    const dataCorrect = !!query && committedQuery(query);
    assert(dataCorrect, "Committed visible query has wrong order, membership or count");
    const screenshot = await page.screenshot();
    const backgroundResult = await running;
    await runtime.crash();
    const reopened = await startScaleRuntime(home, environment);
    try {
      const stored = await reopened.execute<StorageRecord>(fixture.projectId, owner.id, "scale", {
        input: { action: "record", id: edit.recordId },
      });
      assert.deepEqual(stored.value.value, edit.expected);
      assert.equal(stored.value.deleted, operation === "delete");
      await reopened.execute(fixture.projectId, owner.id, "scale", {
        input: { action: "commit", operationId: `restore-${nonce}`, ...edit.restore },
      });
    } finally {
      await reopened.stop();
    }
    return {
      ...details,
      committedVisibleMs,
      durationMs: committedVisibleMs,
      durableSdkMs: saved.outcome.value.durableAckMs,
      correctAfterKill: true,
      startupMs: runtime.startupMs,
      reopenedStartupMs: reopened.startupMs,
      runtimeControl: {
        writer: runtime.controlEvidence,
        reopened: reopened.controlEvidence,
        counterBoundary: "startup and independent calibration; no foreground throttled-time delta",
      },
      dataCorrect,
      committedMatching: expected.length,
      screenshot,
      backgroundResult,
      effectiveTemperature: "owner-hydrated-by-editor-preparation",
      passed: false,
      failures: [
        ...(committedVisibleMs >= contract.ceilingMs ? ["durable-visible-latency"] : []),
        "legacy-editor-preparation-hydrates-owner",
        "index-work-unmeasured",
      ],
    };
  } finally {
    await browser.close();
    await runtime.stop();
  }
};
