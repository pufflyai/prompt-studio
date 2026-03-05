import { describe, expect, test } from "bun:test";
import type { ApprovalRequest } from "../types";
import { createApprovalService } from "./approval-service";

const SHORT_TIMEOUT = 20;

const noop = () => {};

describe("createApprovalService", () => {
  test("requestApproval calls send with the request", async () => {
    const sent: ApprovalRequest[] = [];
    const service = createApprovalService((req) => sent.push(req), { timeoutMs: SHORT_TIMEOUT });

    const request: ApprovalRequest = {
      id: "req-1",
      toolName: "Bash",
      toolInput: { command: "npm install" },
      toolUseId: "toolu_01",
    };

    const promise = service.requestApproval(request);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ id: "req-1", toolName: "Bash" });

    service.handleResponse({ id: "req-1", decision: "approve" });
    const result = await promise;
    expect(result.decision).toBe("approve");
  });

  test("handleResponse resolves the pending promise", async () => {
    const service = createApprovalService(noop, { timeoutMs: SHORT_TIMEOUT });

    const promise = service.requestApproval({
      id: "req-2",
      toolName: "Write",
      toolInput: { path: "/foo.txt" },
      toolUseId: "toolu_02",
    });

    service.handleResponse({ id: "req-2", decision: "deny" });

    const result = await promise;
    expect(result).toMatchObject({ id: "req-2", decision: "deny" });
  });

  test("timeout resolves with timeout decision", async () => {
    const service = createApprovalService(noop, { timeoutMs: SHORT_TIMEOUT });

    const result = await service.requestApproval({
      id: "req-3",
      toolName: "Bash",
      toolInput: {},
      toolUseId: "toolu_03",
    });

    expect(result).toMatchObject({ id: "req-3", decision: "timeout" });
  });

  test("handleResponse before timeout prevents timeout", async () => {
    const service = createApprovalService(noop, { timeoutMs: SHORT_TIMEOUT });

    const promise = service.requestApproval({
      id: "req-4",
      toolName: "Bash",
      toolInput: {},
      toolUseId: "toolu_04",
    });

    service.handleResponse({ id: "req-4", decision: "approve" });

    const result = await promise;
    expect(result.decision).toBe("approve");
  });

  test("unknown response ID is ignored", () => {
    const service = createApprovalService(noop, { timeoutMs: SHORT_TIMEOUT });

    service.handleResponse({ id: "unknown-id", decision: "approve" });
  });

  test("multiple concurrent requests are tracked independently", async () => {
    const service = createApprovalService(noop, { timeoutMs: SHORT_TIMEOUT });

    const p1 = service.requestApproval({ id: "a", toolName: "Read", toolInput: {}, toolUseId: "t1" });
    const p2 = service.requestApproval({ id: "b", toolName: "Write", toolInput: {}, toolUseId: "t2" });

    service.handleResponse({ id: "b", decision: "deny" });
    service.handleResponse({ id: "a", decision: "approve" });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.decision).toBe("approve");
    expect(r2.decision).toBe("deny");
  });

  test("responding to same ID twice is a no-op", async () => {
    const service = createApprovalService(noop, { timeoutMs: SHORT_TIMEOUT });

    const promise = service.requestApproval({ id: "dup", toolName: "Bash", toolInput: {}, toolUseId: "t" });

    service.handleResponse({ id: "dup", decision: "approve" });
    service.handleResponse({ id: "dup", decision: "deny" });

    const result = await promise;
    expect(result.decision).toBe("approve");
  });

  test("dispose clears all pending requests with timeout", async () => {
    const service = createApprovalService(noop, { timeoutMs: SHORT_TIMEOUT });

    const p1 = service.requestApproval({ id: "x", toolName: "Bash", toolInput: {}, toolUseId: "t1" });
    const p2 = service.requestApproval({ id: "y", toolName: "Read", toolInput: {}, toolUseId: "t2" });

    service.dispose();

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.decision).toBe("timeout");
    expect(r2.decision).toBe("timeout");
  });
});
