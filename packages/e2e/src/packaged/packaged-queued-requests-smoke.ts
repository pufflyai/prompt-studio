import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Browser, chromium } from "@playwright/test";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { expectPackagedQueuedEditRecovery } from "./packaged-queued-edit-recovery-smoke";
import { expectPackagedQueuedEditorCancellation } from "./packaged-queued-editor-smoke";
import { createPackagedQueueFixture, logQueuedPhase } from "./packaged-queued-fixture";
import { runtimeAuthorization } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

export const registerQueuedRequestSmokeTests = () => {
  describe("packaged queued requests", () => {
    let fixture: Awaited<ReturnType<typeof createPackagedQueueFixture>> | undefined;
    let browser: Browser | undefined;
    beforeAll(async () => {
      fixture = await createPackagedQueueFixture();
      logQueuedPhase("setup", "launch shared Chromium browser");
      browser = await chromium.launch(PROVISIONED_CHROMIUM);
    }, PACKAGED_TEST_TIMEOUT);
    afterAll(async () => {
      try {
        await browser?.close();
      } finally {
        await fixture?.close();
      }
    });

    test("API queue retains settings, combines, and steers once into active work", async () => {
      const { request } = fixture!;
      logQueuedPhase("API queue", "create active session");
      const session = await fixture!.createSession();
      logQueuedPhase("API queue", "queue, edit, combine, and steer");
      const path = `/sessions/${session.id}/queued-follow-ups`;
      for (const prompt of ["First", "Second", "Other"])
        expect(
          (
            await request(`/sessions/${session.id}/follow-up`, "POST", {
              prompt,
              model: "one",
              params: { thinking: "high" },
            })
          ).follow_up.status,
        ).toBe("queued");
      const queue = await request(path);
      const [first, second, other] = queue.requests;
      expect(first.params).toEqual({ thinking: "high" });
      expect(queue.steeringAvailable).toBe(true);
      const edited = (
        await request(`${path}/${first.queuePosition}`, "PATCH", {
          prompt: "Correction",
          expectedRevision: first.revision,
          model: "one",
          params: { thinking: "high" },
          attachments: [],
        })
      ).request;
      const combined = (
        await request(`${path}/${second.queuePosition}/combine`, "POST", {
          sourcePosition: first.queuePosition,
          sourceRevision: edited.revision,
          targetRevision: second.revision,
        })
      ).request;
      expect(combined.prompt).toBe("Correction\n\nSecond");
      const outcome = await request(`${path}/${second.queuePosition}/steer`, "POST", {
        expectedRevision: combined.revision,
        expectedRunStartedAt: queue.activeRunStartedAt,
      });
      expect(outcome.status).toBe("accepted");
      expect((await request(path)).requests).toEqual([other]);
      const conversation = await request(`/sessions/${session.id}/conversation`);
      expect(conversation.messages.filter((message: { id: string }) => message.id === outcome.deliveryId)).toHaveLength(
        1,
      );
      expect((await request(`/sessions/${session.id}`)).last_request_started).toBe(queue.activeRunStartedAt);
      expect(
        (
          await request(`${path}/${second.queuePosition}/steer`, "POST", {
            expectedRevision: combined.revision,
            expectedRunStartedAt: queue.activeRunStartedAt,
          })
        ).status,
      ).toBe("rejected");

      logQueuedPhase("API queue", "verified single delivery and retained active run");
      const interacted = await request(
        `/projects/${fixture!.projectId}/extensions/commands/test.queue-smoke.command.interact/execute`,
        "POST",
        { params: { sessionId: session.id } },
      );
      expect(interacted).toMatchObject({
        outcome: {
          ok: true,
          value: {
            queued: 1,
            events: expect.arrayContaining(["ready", "queued_messages", "patch"]),
            attachment: "Extension attachment",
            draft: "/plan",
            native: "/plan",
            operation: { status: "completed", message: "Native result" },
            resolved: session.id,
            archived: true,
            deleted: null,
          },
        },
      });
      const stopped = await request(
        `/projects/${fixture!.projectId}/extensions/commands/test.queue-smoke.command.stop/execute`,
        "POST",
        { params: { sessionId: session.id } },
      );
      expect(stopped).toMatchObject({
        outcome: {
          ok: true,
          value: { session: { status: "cancelled", lastExit: { cause: "user_stop" } }, queue: { requests: [] } },
        },
      });
    });

    for (const acceptsLiveInput of [true, false]) {
      const scenario = acceptsLiveInput ? "with steering" : "without steering";
      test(`editor cancellation ${scenario}`, async () => {
        logQueuedPhase(scenario, "create active session and queued messages");
        const session = await fixture!.createSession(acceptsLiveInput ? "worker" : "queued-worker");
        const prompts = acceptsLiveInput ? ["First", "Second", "Other"] : ["First", "Second"];
        for (const prompt of prompts) await fixture!.request(`/sessions/${session.id}/follow-up`, "POST", { prompt });
        const queue = await fixture!.request(`/sessions/${session.id}/queued-follow-ups`);
        expect(queue.activeRunStartedAt).toBeString();
        expect(queue.steeringAvailable).toBe(acceptsLiveInput);
        await expectPackagedQueuedEditorCancellation(
          browser!,
          fixture!.baseUrl,
          runtimeAuthorization(fixture!.descriptor),
          fixture!.projectId,
          session.id,
          acceptsLiveInput,
        );
        logQueuedPhase(scenario, "verified cancellation and draft preservation");
      });
    }
    for (const scenario of ["occupied", "empty", "remaining"] as const) {
      test(`edit recovery with ${scenario} draft or queue`, async () => {
        logQueuedPhase(scenario, "start edit recovery");
        await expectPackagedQueuedEditRecovery(
          browser!,
          fixture!.baseUrl,
          runtimeAuthorization(fixture!.descriptor),
          fixture!.projectId,
          scenario,
        );
        logQueuedPhase(scenario, "verified recovered prompt, settings, and attachments");
      });
    }
  });
};
