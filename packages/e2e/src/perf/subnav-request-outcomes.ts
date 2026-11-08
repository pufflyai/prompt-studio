import { isDeepStrictEqual } from "node:util";
import type { SubnavClientAbort } from "./subnav-request-signals";

export interface SubnavObservedRequest {
  path: string;
  url: string;
  method: string;
  startedMs: number;
  durationMs: number;
  completedMs: number;
  postData?: unknown;
  status?: number;
  outcomeOk?: boolean;
  sessionRows?: number;
  failure?: string;
  clientAbort?: SubnavClientAbort;
}

const record = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const resourceIdentity = (value: unknown) => {
  const resource = record(value);
  if (
    typeof resource?.type !== "string" ||
    !resource.type ||
    typeof resource.id !== "string" ||
    !resource.id ||
    (resource.extensionId !== undefined && typeof resource.extensionId !== "string") ||
    (resource.projectId !== undefined && typeof resource.projectId !== "string")
  )
    return;
  return [resource.extensionId ?? "", resource.projectId ?? "", resource.type, resource.id];
};

const treeRead = (request: SubnavObservedRequest) => {
  const path = request.path.match(
    /^\/v1\/projects\/([^/]+)\/extensions\/commands\/[^/]+\.tree\.(body|children)\/execute$/,
  );
  if (!path) return;
  const body = record(request.postData);
  const params = record(body?.params);
  const renderer = record(params?.renderer);
  const slot = record(body?.slot);
  const slotContext = record(slot?.context);
  const resource = record(renderer?.resource);
  const identity = resourceIdentity(resource);
  if (
    !body ||
    request.method !== "POST" ||
    (body?.projectId !== undefined && body.projectId !== path[1]) ||
    renderer?.projectId !== path[1] ||
    typeof renderer?.rendererId !== "string" ||
    !renderer.rendererId ||
    slot?.kind !== "renderer" ||
    slot.id !== renderer.rendererId ||
    slotContext?.projectId !== path[1] ||
    slotContext.treeId !== renderer.rendererId ||
    (renderer.resource !== undefined && !identity) ||
    (body.resource !== undefined && !resourceIdentity(body.resource)) ||
    !isDeepStrictEqual(identity, resourceIdentity(body.resource))
  )
    return;
  // Resource identity follows resourceKey; labels/metadata can replace the tree's getReadKey.
  return {
    owner: {
      path: request.path,
      body: {
        ...body,
        resource: identity ?? null,
        params: { ...params, renderer: { ...renderer, resource: identity ?? null } },
      },
    },
  };
};

const validClock = (request: SubnavObservedRequest) =>
  Number.isFinite(request.startedMs) &&
  Number.isFinite(request.completedMs) &&
  Number.isFinite(request.durationMs) &&
  request.startedMs >= 0 &&
  request.durationMs >= 0 &&
  request.completedMs >= request.startedMs;

export const classifySubnavRequests = (requests: SubnavObservedRequest[]) => {
  const contexts = requests.map(treeRead);
  const annotated: (SubnavObservedRequest & { supersededBy?: number })[] = requests.map((request, index) => {
    const context = contexts[index];
    const abort = request.clientAbort;
    if (
      !context ||
      request.failure !== "net::ERR_ABORTED" ||
      request.status !== undefined ||
      request.outcomeOk !== undefined ||
      !validClock(request) ||
      !abort ||
      abort.preAborted ||
      !abort.signalAborted ||
      abort.name !== "AbortError" ||
      !Number.isFinite(abort.atMs) ||
      !Number.isFinite(abort.fetchStartedMs) ||
      abort.fetchStartedMs < 0 ||
      abort.fetchStartedMs > request.startedMs ||
      abort.atMs < request.startedMs ||
      abort.atMs > request.completedMs ||
      abort.url !== request.url ||
      abort.method !== request.method ||
      !isDeepStrictEqual(abort.postData, request.postData)
    )
      return { ...request, supersededBy: undefined };
    const nextIndex = requests.findIndex(
      (_, candidate) => candidate > index && isDeepStrictEqual(context.owner, contexts[candidate]?.owner),
    );
    const next = requests[nextIndex];
    if (!next || !validClock(next) || next.startedMs <= request.startedMs || next.startedMs < abort.atMs)
      return { ...request, supersededBy: undefined };
    const replacementIndex = requests.findLastIndex(
      (_, candidate) => candidate > index && isDeepStrictEqual(context.owner, contexts[candidate]?.owner),
    );
    const replacement = requests[replacementIndex];
    const replacementContext = contexts[replacementIndex];
    if (
      replacement &&
      replacementContext &&
      validClock(replacement) &&
      replacement.startedMs > request.startedMs &&
      !replacement.failure &&
      replacement.status !== undefined &&
      replacement.status >= 200 &&
      replacement.status < 300 &&
      replacement.outcomeOk === true
    )
      return { ...request, supersededBy: replacementIndex };
    return { ...request, supersededBy: undefined };
  });
  return {
    requests: annotated,
    errors: annotated.filter(
      (request) =>
        request.supersededBy === undefined &&
        (request.failure || !request.status || request.status >= 400 || request.outcomeOk === false),
    ),
  };
};
