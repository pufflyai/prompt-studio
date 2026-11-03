import { strict as assert } from "node:assert";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import { defaultPageResourceCodec, type ResourceRef } from "@pstdio/sdk/extensions";
import { measurePageHeap, plannerBudget, throttleChromiumCpu } from "pstdio-benchmarks";
import { recordMeasurement } from "pstdio-benchmarks/writer";
import { afterTwoFrames } from "./perf-helpers";
import {
  type LinkedFixture,
  linkedResourceCount,
  linkedResourceOwner,
  linkedResourcesApi,
} from "./planner-linked-resources-fixture";

export const measureLinkedResources = async (
  baseUrl: string,
  token: string,
  fixture: LinkedFixture,
  evidence: string,
) => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const cdp = await throttleChromiumCpu(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.addInitScript(() => {
      localStorage.setItem("onboarding-complete", "true");
      const state = { readyMs: 0, longTasksMs: [] as number[] };
      Object.assign(window, { linkedResourcesTiming: state });
      new PerformanceObserver((list) => {
        state.longTasksMs.push(...list.getEntries().map((entry) => entry.duration));
      }).observe({ type: "longtask", buffered: true });
      const ready = () => {
        const card = document.querySelector('[data-testid="renderer-card"]');
        const badges = card?.querySelectorAll('button[data-testid="collection-badge"]');
        if (badges?.length === 3 && [...badges].every((badge) => badge.checkVisibility()))
          state.readyMs = performance.now();
        else requestAnimationFrame(ready);
      };
      requestAnimationFrame(ready);
    });
    const login = await fetch(`${baseUrl}/runtime/browser-login`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    assert(login.ok, `Login failed: ${login.status}`);
    const url = new URL(((await login.json()) as { url: string }).url);
    const boardPath = `/projects/${fixture.projectId}/extensions/pstdio.pstdio-planner/tickets`;
    url.pathname = boardPath;
    await page.goto(url.href, { waitUntil: "commit" });
    await page.waitForFunction(
      () => (window as unknown as { linkedResourcesTiming: { readyMs: number } }).linkedResourcesTiming.readyMs > 0,
    );
    const timing = await page.evaluate(
      () =>
        (window as unknown as { linkedResourcesTiming: { readyMs: number; longTasksMs: number[] } })
          .linkedResourcesTiming,
    );
    recordMeasurement({
      metric: "linked-resources/cold-open",
      label: "Open 200 tickets with 600 linked resource badges",
      unit: "ms",
      value: timing.readyMs,
      budget: plannerBudget.value,
    });
    await page.screenshot({ path: join(evidence, "board.png") });

    // Verify the full returned projection, then scroll through the virtual board to verify every card.
    const api = linkedResourcesApi(baseUrl, token);
    const queryStarted = performance.now();
    const result = await api.execute<{
      rows: {
        id: string;
        attributes: { linkedResourceItems: { label: string; action?: { kind: string; resource?: ResourceRef } }[] };
      }[];
    }>(fixture.projectId, "pstdio.pstdio-planner", "query-tickets");
    const queryMs = performance.now() - queryStarted;
    recordMeasurement({
      metric: "linked-resources/query",
      label: "Query 200 tickets and resolve 600 linked resources",
      unit: "ms",
      value: queryMs,
    });
    const responseBytes = Buffer.byteLength(JSON.stringify(result));
    recordMeasurement({
      metric: "linked-resources/response",
      label: "200 ticket projection response",
      unit: "bytes",
      value: responseBytes,
    });
    assert.equal(result.rows.length, linkedResourceCount);
    for (const ticket of fixture.tickets) {
      const row = result.rows.find((row) => row.id === ticket.id)!;
      assert.deepEqual(
        row.attributes.linkedResourceItems.map((item) => item.label).sort(),
        [ticket.workspaceLabel, `PR #${ticket.number}`, `Build #${ticket.number}`].sort(),
      );
      assert(
        row.attributes.linkedResourceItems.every((item) => item.action),
        `Missing navigation for ${ticket.title}`,
      );
      for (const [label, type, id, owner] of [
        [ticket.workspaceLabel, "workspace", ticket.workspaceId, "pstdio"],
        [`PR #${ticket.number}`, "pull-request", String(ticket.number), linkedResourceOwner],
        [`Build #${ticket.number}`, "build", String(ticket.number), linkedResourceOwner],
      ]) {
        const action = row.attributes.linkedResourceItems.find((item) => item.label === label)?.action;
        assert.equal(action?.kind, "page");
        assert.equal(action?.resource?.type, type);
        assert.equal(action?.resource?.id, id);
        assert.equal(action?.resource?.extensionId, owner);
        assert.equal(action?.resource?.projectId, fixture.projectId);
      }
    }
    const seen = new Set<number>();
    const scanStarted = performance.now();
    for (let step = 0; step < 200 && seen.size < linkedResourceCount; step++) {
      const mounted = await page.getByTestId("renderer-card").evaluateAll((cards) =>
        cards.map((card) => ({
          text: card.textContent ?? "",
          labels: [...card.querySelectorAll('button[data-testid="collection-badge"]')].map(
            (badge) => badge.textContent,
          ),
        })),
      );
      for (const card of mounted) {
        const ticket = fixture.tickets.find((ticket) => card.text.includes(ticket.title));
        assert(ticket, `Unexpected card: ${card.text}`);
        assert.deepEqual(
          card.labels.sort(),
          [ticket.workspaceLabel, `PR #${ticket.number}`, `Build #${ticket.number}`].sort(),
        );
        seen.add(ticket.number);
      }
      await page.locator("[data-board-column-viewport]").evaluateAll((viewports) => {
        for (const viewport of viewports) viewport.scrollTop += viewport.clientHeight * 0.7;
      });
      await afterTwoFrames(page);
    }
    const scanMs = performance.now() - scanStarted;
    recordMeasurement({
      metric: "linked-resources/scroll",
      label: "Scroll through every linked ticket card",
      unit: "ms",
      value: scanMs,
    });
    assert.equal(seen.size, linkedResourceCount, "Every ticket and all three badges must be reachable by scrolling");
    const retainedHeapBytes = await measurePageHeap(page);
    assert(
      retainedHeapBytes !== undefined && Number.isFinite(retainedHeapBytes),
      "Browser heap measurement is missing",
    );
    recordMeasurement({
      metric: "linked-resources/heap",
      label: "Heap after scrolling 200 linked tickets",
      unit: "bytes",
      value: retainedHeapBytes,
    });

    await page.locator("[data-board-column-viewport]").evaluateAll((viewports) => {
      for (const viewport of viewports) viewport.scrollTop = 0;
    });
    const first = fixture.tickets[0]!;
    const card = page.getByTestId("renderer-card").filter({ hasText: first.title });
    await card
      .getByTestId("collection-badge")
      .filter({ hasText: /^PR #1$/ })
      .click();
    await expect(page).toHaveURL(/linked-resource/);
    const prResource = defaultPageResourceCodec.fromUri(new URL(page.url()).searchParams.get("resource") ?? "");
    assert.deepEqual(prResource, {
      type: "pull-request",
      id: "1",
      extensionId: linkedResourceOwner,
      projectId: fixture.projectId,
    });
    await page.screenshot({ path: join(evidence, "pr-destination.png") });
    await page.goto(`${baseUrl}${boardPath}`);
    await card.getByTestId("collection-badge").filter({ hasText: first.workspaceLabel }).click();
    await expect(page).toHaveURL(new RegExp(first.workspaceId));
    const workspaceResource = defaultPageResourceCodec.fromUri(new URL(page.url()).searchParams.get("resource") ?? "");
    assert.deepEqual(workspaceResource, {
      type: "workspace",
      id: first.workspaceId,
      extensionId: "pstdio",
      projectId: fixture.projectId,
    });
    await page.screenshot({ path: join(evidence, "workspace-destination.png") });
    assert.deepEqual(errors, []);
    return {
      ...timing,
      queryMs,
      responseBytes,
      retainedHeapBytes,
      scanMs,
      ticketsVerified: seen.size,
      badgesVerified: seen.size * 3,
      browser: browser.version(),
      cpuThrottle: process.env.CPU_THROTTLE ?? "4",
    };
  } catch (error) {
    await page.screenshot({ path: join(evidence, "failure.png") }).catch(() => {});
    throw error;
  } finally {
    await cdp.detach();
    await browser.close();
  }
};
