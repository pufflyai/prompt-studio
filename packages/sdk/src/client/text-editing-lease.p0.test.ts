import { expect, test } from "bun:test";
import type { TextEditingRequest } from "pstdio-api-contracts/extension-kernel";
import type { RequestFn } from "./request";
import { createTextTransportClient } from "./text-editing";

const gate = () => ({ entered: Promise.withResolvers<void>(), resume: Promise.withResolvers<void>() });
const fixture = async () => {
  let lease = 0;
  let connections = 0;
  let loseInactive = false;
  let refuseInactive = false;
  const inactiveApplied = Promise.withResolvers<void>();
  const releases: string[] = [];
  const participationErrors: string[] = [];
  let watchSignal: AbortSignal | undefined;
  const watchStarted = Promise.withResolvers<void>();
  let active = true;
  let openGate: ReturnType<typeof gate> | undefined;
  let currentGate: typeof openGate;
  let declinedSubmitGate: typeof openGate;
  let inactiveGate: typeof openGate;
  const calls: { lease: number; operation: string; active: boolean }[] = [];
  const answer = async (input: TextEditingRequest | undefined) => {
    if (!input) return { ok: true };
    calls.push({ lease, operation: input.operation, active });
    if (input.operation === "submit" && declinedSubmitGate) {
      const held = declinedSubmitGate;
      declinedSubmitGate = undefined;
      held.entered.resolve();
      await held.resume.promise;
      return { ok: false, error: { code: "source_read_only", message: "Read only", retryable: false } };
    }
    if (input.operation === "current") {
      const grant = { token: `selected-${lease}` };
      if (currentGate) {
        const held = currentGate;
        currentGate = undefined;
        held.entered.resolve();
        await held.resume.promise;
      }
      return { ok: true, value: grant };
    }
    if (input.operation === "open") {
      const opened = {
        handle: `${lease}:${input.memberId}`,
        grant: { token: `grant-${lease}` },
        sourceIdentity: "a".repeat(64),
      };
      if (openGate) {
        const held = openGate;
        openGate = undefined;
        held.entered.resolve();
        await held.resume.promise;
      }
      return { ok: true, value: opened };
    }
    return { ok: true };
  };
  const applyParticipation = async (next: boolean) => {
    if (!next && refuseInactive) {
      refuseInactive = false;
      return { ok: false, error: { code: "source_unavailable", message: "Participation refused", retryable: true } };
    }
    if (!next && inactiveGate) {
      const held = inactiveGate;
      inactiveGate = undefined;
      held.entered.resolve();
      await held.resume.promise;
    }
    active = next;
    if (!active) inactiveApplied.resolve();
    if (!active && loseInactive) {
      loseInactive = false;
      participationErrors.push("Participation acknowledgement lost");
      throw new Error("Participation acknowledgement lost");
    }
    return { ok: true };
  };
  const request = (async (path, options) => {
    if (path.endsWith("/text-editing")) {
      connections++;
      active = true;
      return { ok: true, value: { token: `lease-${lease}` } };
    }
    if (options?.response === "stream") {
      watchSignal = options.signal;
      watchStarted.resolve();
      return new ReadableStream({
        start(controller) {
          options.signal?.addEventListener("abort", () => controller.close(), { once: true });
        },
      });
    }
    const body = options?.body as { token: string; active: boolean; request: TextEditingRequest };
    if (path.endsWith("/disconnect")) releases.push(body.token);
    if (body.token !== `lease-${lease}`)
      return { ok: false, error: { code: "connection_expired", message: "Lease expired", retryable: true } };
    if (path.endsWith("/active")) return applyParticipation(body.active);
    return answer(body.request);
  }) as RequestFn;
  const connection = await createTextTransportClient(request).connect({
    projectId: "project",
    scope: { kind: "placement", viewId: "owner.view.editor" },
  });
  const guest = connection.guest();
  return {
    connection,
    guest,
    connections: () => connections,
    participating: () => active,
    participationErrors,
    inactiveApplied: inactiveApplied.promise,
    refuseInactive: () => {
      refuseInactive = true;
    },
    releases,
    watched: async () => {
      await watchStarted.promise;
      return watchSignal!;
    },
    loseInactiveAck: () => {
      loseInactive = true;
    },
    calls,
    expire: () => {
      lease++;
    },
    holdOpen: () => (openGate = gate()),
    holdCurrent: () => (currentGate = gate()),
    holdDeclinedSubmit: () => (declinedSubmitGate = gate()),
    holdInactive: () => (inactiveGate = gate()),
  };
};

test("a refused participation change reenters live watch recovery and applies the desired state", async () => {
  const f = await fixture();
  try {
    const original = await f.watched();
    f.refuseInactive();
    await expect(f.connection.setActive(false)).rejects.toThrow("Participation refused");
    expect(original.aborted).toBe(true);
    await f.inactiveApplied;
    expect(f.participating()).toBe(false);
  } finally {
    await f.connection.disconnect();
  }
});

test.each([
  false,
  true,
])("the latest requested participation wins after a held older call (lost acknowledgement: %s)", async (lost) => {
  const f = await fixture();
  const held = f.holdInactive();
  if (lost) f.loseInactiveAck();
  const inactive = f.connection.setActive(false);
  try {
    await held.entered.promise;
    const active = f.connection.setActive(true);
    // An independent request advances the controlled peer without waiting on activity serialization.
    await f.connection.request({ operation: "current" });
    held.resume.resolve();
    const [, latest] = await Promise.allSettled([inactive, active]);
    expect(latest.status).toBe("fulfilled");
    expect(f.participationErrors).toHaveLength(lost ? 1 : 0);
    expect(f.participating()).toBe(true);
  } finally {
    held.resume.resolve();
    await f.connection.disconnect();
  }
});

test("a held opening reply cannot install a handle from a replaced transport lease", async () => {
  const f = await fixture();
  const memberId = crypto.randomUUID();
  await f.guest.host.call("editing.text", { operation: "register", memberId });
  const held = f.holdOpen();
  const opening = f.guest.host
    .call("editing.text", { operation: "open", memberId, input: { sourceId: "body", params: {} } })
    .catch((error: unknown) => error);
  try {
    await held.entered.promise;
    f.expire();
    await expect(f.connection.request({ operation: "current" })).rejects.toMatchObject({ code: "connection_reset" });
    held.resume.resolve();
    expect(await opening).toMatchObject({ code: "connection_reset" });
  } finally {
    held.resume.resolve();
    await f.guest.close();
  }
});

test("a held selected-source reply cannot publish a grant from a replaced transport lease", async () => {
  const f = await fixture();
  const held = f.holdCurrent();
  const current = f.guest.host.call("editing.text", { operation: "current" }).catch((error: unknown) => error);
  try {
    await held.entered.promise;
    f.expire();
    await expect(f.connection.request({ operation: "current" })).rejects.toMatchObject({ code: "connection_reset" });
    held.resume.resolve();
    expect(await current).toMatchObject({ code: "connection_reset" });
  } finally {
    held.resume.resolve();
    await f.guest.close();
  }
});

test("an inactive connection restores participation before publishing its renewed lease", async () => {
  const f = await fixture();
  await f.connection.setActive(false);
  f.expire();
  const held = f.holdInactive();
  const first = f.connection.request({ operation: "current" }).catch((error: unknown) => error);
  await held.entered.promise;
  const second = f.connection
    .request({ operation: "register", memberId: crypto.randomUUID() })
    .catch((error: unknown) => error);
  try {
    expect(f.calls.some((call) => call.lease === 1 && call.active)).toBe(false);
  } finally {
    held.resume.resolve();
    await Promise.all([first, second]);
    await f.guest.close();
  }
});

test("explicit guest disposal is terminal for retained hosts and transport references", async () => {
  const f = await fixture();
  try {
    await f.guest.close();
    f.expire();
    await expect(f.guest.host.call("editing.text", { operation: "current" })).rejects.toMatchObject({
      code: "session_closed",
    });
    await expect(f.connection.request({ operation: "current" })).rejects.toMatchObject({ code: "session_closed" });
    await f.guest.close();
    expect(f.connections()).toBe(1);
  } finally {
    await f.connection.disconnect();
  }
});

test("terminal cleanup retains a private renewed lease after its participation acknowledgement is lost", async () => {
  const f = await fixture();
  try {
    await f.connection.setActive(false);
    f.expire();
    f.loseInactiveAck();
    await expect(f.connection.request({ operation: "current" })).rejects.toThrow("Participation acknowledgement lost");
    await f.connection.disconnect();
    expect(f.releases).toContain("lease-1");
  } finally {
    await f.guest.close();
  }
});

test("publishing a renewed lease stops the previous lease event stream", async () => {
  const f = await fixture();
  try {
    const previous = await f.watched();
    f.expire();
    await expect(f.connection.request({ operation: "current" })).rejects.toMatchObject({ code: "connection_reset" });
    expect(previous.aborted).toBe(true);
  } finally {
    await f.guest.close();
  }
});

test("a definitively expired private lease cannot pin later renewal to an obsolete host", async () => {
  const f = await fixture();
  try {
    await f.connection.setActive(false);
    f.expire();
    f.loseInactiveAck();
    await expect(f.connection.request({ operation: "current" })).rejects.toThrow("Participation acknowledgement lost");
    f.expire();
    await expect(f.connection.request({ operation: "current" })).rejects.toMatchObject({ code: "connection_expired" });
    await expect(f.connection.request({ operation: "current" })).rejects.toMatchObject({ code: "connection_reset" });
    await expect(f.connection.request({ operation: "current" })).resolves.toEqual({ token: "selected-2" });
    expect(f.connections()).toBe(3);
  } finally {
    await f.connection.disconnect();
    await f.guest.close();
  }
});

test("a refused reply from an earlier lease cannot replace current source permissions", async () => {
  const f = await fixture();
  const held = f.holdDeclinedSubmit();
  const submitting = f.connection
    .request({ operation: "submit", handle: "old-handle", sequence: 1, update: "" })
    .catch((error: unknown) => error);
  try {
    await held.entered.promise;
    f.expire();
    await expect(f.connection.request({ operation: "current" })).rejects.toMatchObject({ code: "connection_reset" });
    held.resume.resolve();
    expect(await submitting).toMatchObject({ code: "connection_reset" });
  } finally {
    held.resume.resolve();
    await f.guest.close();
  }
});
