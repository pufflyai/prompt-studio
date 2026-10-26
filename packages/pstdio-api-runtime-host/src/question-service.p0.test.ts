import { describe, expect, test } from "bun:test";
import type { HarnessQuestionRequest } from "pstdio-api-contracts";
import { createQuestionService } from "./question-service";

const noHooks = { onAsk: () => {}, onAnswer: () => {} };

// Status notifications run on their own chain, so let it settle before reading the order.
const flushNotifications = () => new Promise((resolve) => setTimeout(resolve, 0));

const rejection = (pending: Promise<unknown>) =>
  pending.then(
    () => new Error("The ask resolved instead of rejecting."),
    (error: Error) => error,
  );

const request = (id: string, ...questions: string[]): HarnessQuestionRequest => ({
  id,
  toolUseId: `toolu_${id}`,
  questions: questions.map((question) => ({ question, options: [{ label: "Red" }, { label: "Blue" }] })),
});

describe("createQuestionService", () => {
  test("an ask stays open until it is answered", async () => {
    const asked: string[] = [];
    const service = createQuestionService({
      onAsk: () => {
        asked.push("ask");
      },
      onAnswer: () => {
        asked.push("answer");
      },
    });

    const pending = service.ask(request("q1", "Red or blue?"));
    await flushNotifications();

    expect(service.hasPending()).toBe(true);
    expect(asked).toEqual(["ask"]);
    expect(service.answer({ answers: [["Blue"]] })).toBe(true);

    expect(await pending).toEqual({ answers: [["Blue"]] });
    expect(service.hasPending()).toBe(false);
  });

  test("notifies that a question opened and closed, in that order", async () => {
    const calls: string[] = [];
    const service = createQuestionService({
      onAsk: () => {
        calls.push("ask");
      },
      onAnswer: () => {
        calls.push("answer");
      },
    });

    const pending = service.ask(request("q1", "Red or blue?"));
    service.answer("Blue");
    await pending;
    await flushNotifications();

    expect(calls).toEqual(["ask", "answer"]);
  });

  test("text answers every question in the open ask", async () => {
    const service = createQuestionService(noHooks);

    const pending = service.ask(request("q1", "Which colour?", "Which size?"));
    service.answer("Blue");

    expect(await pending).toEqual({ answers: [["Blue"], ["Blue"]] });
  });

  test("a structured answer resolves only its matching ask and keeps other asks open", async () => {
    let closed = 0;
    const service = createQuestionService({
      onAsk: () => {},
      onAnswer: () => {
        closed += 1;
      },
    });
    const first = service.ask(request("first", "Which color?"));
    const second = service.ask(request("second", "Which size?"));
    const response = { callId: "toolu_first", answers: [["Blue"]] };

    expect(service.answer(response)).toBe(true);
    expect(await first).toEqual(response);
    expect(service.hasPending()).toBe(true);
    expect(closed).toBe(0);
    expect(service.answer({ callId: "toolu_stale", answers: [["Blue"]] })).toBe(false);

    expect(service.answer({ callId: "toolu_second", answers: [["Small"]] })).toBe(true);
    expect(await second).toEqual({ callId: "toolu_second", answers: [["Small"]] });
    expect(service.hasPending()).toBe(false);
    expect(closed).toBe(1);
  });

  test("the ask stays open until the session is back in progress", async () => {
    const release = Promise.withResolvers<void>();
    const service = createQuestionService({ onAsk: () => {}, onAnswer: () => release.promise });

    const pending = service.ask(request("q1", "Red or blue?"));
    expect(service.answer("Blue")).toBe(true);
    await flushNotifications();

    // A second answer has to find the open ask instead of falling through and starting a new run.
    expect(service.hasPending()).toBe(true);

    release.resolve();
    expect(await pending).toEqual({ answers: [["Blue"]] });
    expect(service.hasPending()).toBe(false);
  });

  test("a disposed service writes no status for a notification queued before it closed", async () => {
    const calls: string[] = [];
    const service = createQuestionService({
      onAsk: () => {
        calls.push("ask");
      },
      onAnswer: () => {},
    });

    // A harness awaits its own ask, so attach the handler before closing the channel.
    const failure = rejection(service.ask(request("q1", "Red or blue?")));
    service.dispose();
    await flushNotifications();

    expect(calls).toEqual([]);
    expect((await failure).message).toMatch(/session ended/i);
  });

  test("a closed channel rejects a new ask instead of leaving it hanging", async () => {
    const service = createQuestionService(noHooks);
    service.dispose();

    // Nothing disposes the channel a second time, so the ask has to settle itself.
    expect((await rejection(service.ask(request("q1", "Red or blue?")))).message).toMatch(/session ended/i);
    expect(service.hasPending()).toBe(false);
  });

  test("answering with nothing open reports that it did nothing", () => {
    const service = createQuestionService(noHooks);

    expect(service.answer("Blue")).toBe(false);
    expect(service.hasPending()).toBe(false);
  });

  test("dispose rejects the open ask", async () => {
    const service = createQuestionService(noHooks);

    const failure = rejection(service.ask(request("q1", "Red or blue?")));
    service.dispose();

    expect((await failure).message).toMatch(/session ended/i);
    expect(service.hasPending()).toBe(false);
  });
});
