import { randomUUID } from "node:crypto";
import type { ExecutionRecord, InputObjectReference, WorkspaceRequest } from "@pstdio/pocketcoder-sdk";
import type {
  HarnessAttachment,
  HarnessContext,
  HarnessReattachInput,
  HarnessSession,
  HarnessStartInput,
  SessionMessage,
} from "@pstdio/sdk/extensions";
import { type createInstances, PocketCoderHttpError } from "./instances";
import { readSessionMessages } from "./session-messages";

type Instances = ReturnType<typeof createInstances>;
type Target = {
  instanceId: string;
  machineId: string;
  sessionId: string;
  instances: Instances;
  conversationId?: string;
};
type InputReference = InputObjectReference;
type Receipt = ExecutionRecord;
type Request = WorkspaceRequest;
type Pending = { target: string; request: Request; cancelId?: string };
const path = (ref: Target) => `/v1/workspaces/${ref.machineId}/requests`;
const key = (sessionId: string) => `file-turn:${sessionId}`;
type FilePresentation = Pick<HarnessAttachment, "fileId" | "fileName" | "mimeType" | "sizeBytes" | "url">;

export async function supportsFileTurns(ref: Target, signal?: AbortSignal) {
  try {
    return await ref.instances.request<{ requests: boolean; attachments: boolean }>(
      ref.instanceId,
      `/v1/workspaces/${ref.machineId}/requests/capabilities`,
      { signal },
    );
  } catch (error) {
    if (error instanceof PocketCoderHttpError && error.status === 422 && error.code === "relay.route_not_allowed")
      return { requests: false, attachments: false };
    throw error;
  }
}

async function upload(ref: Target, input: HarnessStartInput) {
  const files: InputReference[] = [];
  for (const attachment of input.attachments ?? []) {
    input.signal?.throwIfAborted();
    const file = Bun.file(attachment.localPath);
    if (file.size !== attachment.sizeBytes) throw new Error(`Attachment changed: ${attachment.fileName}`);
    const hash = new Bun.CryptoHasher("sha256");
    for await (const chunk of file.stream()) {
      input.signal?.throwIfAborted();
      hash.update(chunk);
    }
    const reference = await ref.instances.request<InputReference>(
      ref.instanceId,
      `/v1/workspaces/${ref.machineId}/attachments/${attachment.fileId}`,
      {
        method: "PUT",
        signal: input.signal,
        headers: {
          "content-type": attachment.mimeType ?? "application/octet-stream",
          "content-length": String(file.size),
          "x-content-sha256": hash.digest("hex"),
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        },
        body: file,
      },
    );
    files.push(reference);
  }
  return files;
}

async function read(ref: Target, request: Pick<Request, "requestId" | "conversationId">, signal?: AbortSignal) {
  return ref.instances.request<Receipt>(
    ref.instanceId,
    `${path(ref)}/${request.requestId}?conversationId=${request.conversationId}`,
    { signal },
  );
}

export async function fileTurnMessages(
  ctx: HarnessContext,
  ref: Target,
  sessionId: string,
  signal?: AbortSignal,
): Promise<SessionMessage[]> {
  if (!sessionId) return [];
  return readSessionMessages(
    <T>(path: string) => ref.instances.request<T>(ref.instanceId, path, { signal }),
    ref.machineId,
    sessionId,
    async (id) => (await ctx.state.get<FilePresentation>(`file-presentation:${sessionId}:${id}`))?.url,
  );
}

export async function startFileTurn(
  ctx: HarnessContext,
  input: HarnessStartInput & { agentSessionId?: string },
  ref: Target,
): Promise<HarnessSession> {
  if (await ctx.state.get(key(input.sessionId)))
    throw new Error("Reconnect to the pending request before sending another message.");
  const conversationKey = `file-conversation:${input.sessionId}`;
  let conversationId = await ctx.state.get<string>(conversationKey);
  conversationId = input.agentSessionId?.split(":")[2] ?? conversationId ?? ref.conversationId ?? randomUUID();
  await ctx.state.set(conversationKey, conversationId);
  if (!input.prompt.trim() && !input.attachments?.length) {
    input.events.push({
      op: "replace",
      path: "/messages",
      value: await fileTurnMessages(ctx, ref, conversationId, input.signal),
    });
    return {
      agentSessionId: `${ref.sessionId}:${conversationId}`,
      done: Promise.resolve({ status: "completed" }),
      stop() {},
    };
  }
  const files = await upload(ref, input);
  for (const { fileId, fileName, mimeType, sizeBytes, url } of input.attachments ?? [])
    await ctx.state.set(`file-presentation:${conversationId}:${fileId}`, {
      fileId,
      fileName,
      mimeType,
      sizeBytes,
      url,
    });
  const request: Request = {
    requestId: randomUUID(),
    conversationId,
    message: input.prompt || "Read the attached files.",
    files,
  };
  await ctx.state.set(key(input.sessionId), { target: ref.sessionId, request });
  return observeFileTurn(ctx, input, ref, { target: ref.sessionId, request }, true);
}

export async function reconnectFileTurn(ctx: HarnessContext, input: HarnessReattachInput, ref: Target) {
  const pending = await ctx.state.get<Pending>(key(input.sessionId));
  if (!pending) return null;
  if (pending.target !== ref.sessionId) {
    const [instanceId, machineId] = pending.target.split(":");
    if (!instanceId || !machineId) throw new Error("Invalid saved machine target.");
    const receipt = await read(
      { ...ref, instanceId, machineId, sessionId: pending.target },
      pending.request,
      input.signal,
    );
    if (!receipt.finalizedAt) throw new Error("The previous machine request has not finished finalization.");
    input.events.push({
      op: "replace",
      path: "/messages",
      value: await fileTurnMessages(ctx, ref, pending.request.conversationId, input.signal),
    });
    await ctx.state.set(`file-conversation:${input.sessionId}`, pending.request.conversationId);
    await ctx.state.delete(key(input.sessionId));
    return {
      agentSessionId: `${ref.sessionId}:${pending.request.conversationId}`,
      done: Promise.resolve(completedStatus(receipt)),
      stop() {},
    };
  }
  return observeFileTurn(ctx, input, ref, pending, false);
}

async function observeFileTurn(
  ctx: HarnessContext,
  input: HarnessStartInput | HarnessReattachInput,
  ref: Target,
  pending: Pending,
  firstSubmission: boolean,
): Promise<HarnessSession> {
  const controller = new AbortController();
  const signal = input.signal ? AbortSignal.any([input.signal, controller.signal]) : controller.signal;
  const done = (async () => {
    // Replaying this exact saved body is safe even when the first response was lost.
    try {
      await ref.instances.request(ref.instanceId, path(ref), {
        method: "POST",
        body: JSON.stringify(pending.request),
        signal,
      });
    } catch (error) {
      // A replay can follow a lost acceptance response. Only a rejected first
      // submission proves that this saved request never reached execution.
      if (firstSubmission && error instanceof PocketCoderHttpError && [400, 413, 422].includes(error.status)) {
        await ctx.state.delete(key(input.sessionId));
        ctx.logger.warn(error.message);
        return { status: "failed" as const };
      }
      throw error;
    }
    while (!signal.aborted) {
      const receipt = await read(ref, pending.request, signal);
      input.events.push({
        op: "replace",
        path: "/messages",
        value: await fileTurnMessages(ctx, ref, pending.request.conversationId, signal),
      });
      if (receipt.finalizedAt) {
        await ctx.state.delete(key(input.sessionId));
        return completedStatus(receipt);
      }
      if (["unknown", "lost"].includes(receipt.phase)) return { status: "disconnected" as const };
      await Bun.sleep(250);
    }
    return { status: "disconnected" as const };
  })().catch((error: unknown) => {
    if (!signal.aborted) ctx.logger.warn(`PocketCoder request connection ended: ${String(error)}`);
    return { status: "disconnected" as const };
  });
  return {
    agentSessionId: `${ref.sessionId}:${pending.request.conversationId}`,
    timeoutStrategy: "provider",
    async stop() {
      const receipt = await ref.instances.request<Receipt>(ref.instanceId, path(ref), {
        method: "POST",
        body: JSON.stringify(pending.request),
      });
      if (receipt.finalizedAt) return;
      pending.cancelId ??= randomUUID();
      await ctx.state.set(key(input.sessionId), pending);
      const execution = receipt.acceptance.execution;
      await ref.instances.request(
        ref.instanceId,
        `/v1/workspaces/${ref.machineId}/executions/${execution.requestId}/cancel`,
        { method: "POST", body: JSON.stringify({ execution, cancelId: pending.cancelId, scope: "operation" }) },
      );
    },
    done,
  };
}

export async function resumeFileTurn(
  ctx: HarnessContext,
  input: HarnessStartInput & { agentSessionId: string },
  ref: Target,
): Promise<HarnessSession> {
  const pending = await ctx.state.get<Pending>(key(input.sessionId));
  if (!pending) return startFileTurn(ctx, input, ref);
  let current = await reconnectFileTurn(ctx, input, ref);
  if (!current) throw new Error("Pending request disappeared");
  // Reattachment recovers work; a resume with content is a distinct submission.
  if (!input.prompt.trim() && !input.attachments?.length) return current;
  const recovered = current;
  let stopped = false;
  return {
    ...recovered,
    async stop() {
      stopped = true;
      await current!.stop();
    },
    done: (async () => {
      const result = await recovered.done;
      if (stopped || result.status === "disconnected") return result;
      current = await startFileTurn(ctx, input, ref);
      if (stopped) await current.stop();
      return current.done;
    })(),
  };
}

function completedStatus(receipt: Receipt) {
  if (receipt.phase === "canceled") return { status: "cancelled" as const };
  if (
    receipt.outcome &&
    typeof receipt.outcome === "object" &&
    "status" in receipt.outcome &&
    receipt.outcome.status === "completed"
  )
    return { status: "completed" as const };
  return { status: "failed" as const };
}
