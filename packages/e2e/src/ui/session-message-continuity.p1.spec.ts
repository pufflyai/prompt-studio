import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { expect, type Request, test } from "../scripts/session-test";
import { uiOrigin } from "../ui-server";

const actionPath = "/extensions/commands/pstdio.session-browser.view.conversation.chat.onAction/execute";
const isSubmit = (request: Request) =>
  request.method() === "POST" &&
  request.url().endsWith(actionPath) &&
  request.postDataJSON()?.params?.action?.type === "submit";

// Critical: a submitted message must remain visible while its draft becomes the created session.
test("keeps sent messages visible through session creation, redirect and follow-up confirmation", async ({
  page,
  request,
}) => {
  const repo = resolve(import.meta.dirname, "../../../..");
  const parent = join(repo, "__test-tmp__");
  mkdirSync(parent, { recursive: true });
  const folder = mkdtempSync(join(parent, "message-continuity-"));
  let projectId: string | undefined;
  try {
    const created = await request.post(`${uiOrigin}/v1/projects`, {
      data: folderProjectInput(
        { name: "Message continuity", agents: ["pstdio.workbench-fixture.harness.fake"] },
        folder,
      ),
    });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id;
    const enabled = await request.post(
      `${uiOrigin}/v1/projects/${projectId}/extensions/installed/workbench-fixture/enable`,
      {
        data: {
          displayName: "Workbench fixture",
          extensionId: "pstdio.workbench-fixture",
          manifest: { id: "pstdio.workbench-fixture", name: "workbench-fixture" },
          name: "workbench-fixture",
          sourceHash: "message-continuity-native-echo",
          sourceKind: "local_path",
          sourcePath: join(repo, "packages/workbench-fixture"),
          sourceRef: null,
          version: null,
        },
      },
    );
    expect(enabled.ok()).toBe(true);
    await page.addInitScript(() => {
      if (window !== window.top) return;
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
      localStorage.setItem(
        "session-model-preferences",
        JSON.stringify({ harnessId: "pstdio.workbench-fixture.harness.fake" }),
      );
    });
    await page.goto(`/projects/${projectId}/sessions`);
    const main = page.locator('[data-workbench-panel="main"]');
    const editor = main.locator('[data-testid="content-editable"][contenteditable="true"]:visible');
    const send = main.locator('[data-testid="send-message-button"]:visible');
    let sessionId: string | undefined;
    for (const prompt of ["Initial continuity check", "Follow-up continuity check"]) {
      await editor.fill(`${prompt} __fake_user_echo__`);
      await expect(send).toHaveAttribute("aria-label", "Send message");
      await expect(send).toBeEnabled();
      await page.evaluate((text) => {
        const evidence = {
          started: false,
          missingFrames: 0,
          replacements: 0,
          contentReplacements: 0,
          contentNode: null as Element | null,
          stopped: false,
          node: null as Element | null,
        };
        (window as unknown as { messageContinuity: typeof evidence }).messageContinuity = evidence;
        const isVisible = (row: Element | undefined) => {
          if (!row) return false;
          for (let element: Element | null = row; element; element = element.parentElement) {
            const style = getComputedStyle(element);
            if (style.visibility === "hidden" || style.display === "none") return false;
          }
          return true;
        };
        const recordContent = (row: Element) => {
          const content = row.querySelector("[data-chat-response] [data-lexical-editor]");
          if (evidence.contentNode && evidence.contentNode !== content) evidence.contentReplacements++;
          evidence.contentNode = content;
        };
        const frame = () => {
          const row = [
            ...document.querySelectorAll('[data-workbench-panel="main"] [data-chat-message-list-item="user"]'),
          ].find((element) => element.textContent?.includes(text) && element.getClientRects().length > 0);
          const visible = isVisible(row);
          if (evidence.started && !visible) evidence.missingFrames++;
          if (row && visible) {
            if (evidence.node && evidence.node !== row) evidence.replacements++;
            recordContent(row);
            evidence.node = row;
            evidence.started = true;
          }
          if (!evidence.stopped) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }, prompt);
      const saved = page.waitForResponse((response) => isSubmit(response.request()));
      await send.click();
      const response = await saved;
      expect(response.ok()).toBe(true);
      const outcome = (await response.json()).outcome;
      expect(outcome.ok).toBe(true);
      if (!sessionId) sessionId = outcome.navigationRequests[0].resource.id;
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === `/projects/${projectId}/extensions/pstdio.session-browser/conversation` &&
          Boolean(url.searchParams.get("resource")?.includes(sessionId!)),
      );
      const confirmed = main.locator('[data-chat-message-list-item="user"]:visible').filter({ hasText: prompt });
      await expect(confirmed).toHaveAttribute("data-chat-message-id", /^optimistic-fake-/);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      const session = await request.get(`${uiOrigin}/v1/sessions/${sessionId}`);
      expect(session.ok()).toBe(true);
      writeFileSync(join((await session.json()).cwd, ".fake-user-echo-release"), "");
      await expect(confirmed).toHaveAttribute("data-chat-message-id", /^fake-/);
      await expect(send).toHaveAttribute("aria-label", "Send message");
      const evidence = await page.evaluate(async () => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const evidence = (
          window as unknown as {
            messageContinuity: {
              started: boolean;
              missingFrames: number;
              replacements: number;
              contentReplacements: number;
              stopped: boolean;
            };
          }
        ).messageContinuity;
        evidence.stopped = true;
        return {
          started: evidence.started,
          missingFrames: evidence.missingFrames,
          replacements: evidence.replacements,
          contentReplacements: evidence.contentReplacements,
        };
      });
      expect(evidence).toEqual({ started: true, missingFrames: 0, replacements: 0, contentReplacements: 0 });
    }
  } finally {
    try {
      if (projectId) await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }
});
