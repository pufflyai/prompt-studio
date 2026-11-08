import { isDeepStrictEqual } from "node:util";

export interface SubnavObservedRequest {
  path: string;
  startedMs: number;
  durationMs: number;
  completedMs: number;
  postData?: unknown;
  status?: number;
  outcomeOk?: boolean;
  sessionRows?: number;
  failure?: string;
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
  const resource = record(renderer?.resource);
  const identity = resourceIdentity(resource);
  if (
    typeof body?.projectId !== "string" ||
    !body.projectId ||
    body.projectId !== path[1] ||
    renderer?.projectId !== body.projectId ||
    typeof renderer?.rendererId !== "string" ||
    !renderer.rendererId ||
    !identity ||
    !isDeepStrictEqual(identity, resourceIdentity(body.resource))
  )
    return;
  // Resource identity follows resourceKey; labels/metadata can replace the tree's getReadKey.
  return {
    resource,
    owner: {
      path: request.path,
      body: {
        ...body,
        resource: identity,
        params: { ...params, renderer: { ...renderer, resource: identity } },
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
    if (
      !context ||
      request.failure !== "net::ERR_ABORTED" ||
      request.status !== undefined ||
      request.outcomeOk !== undefined ||
      !validClock(request)
    )
      return { ...request, supersededBy: undefined };
    const nextIndex = requests.findIndex(
      (_, candidate) => candidate > index && isDeepStrictEqual(context.owner, contexts[candidate]?.owner),
    );
    const next = requests[nextIndex];
    const nextContext = contexts[nextIndex];
    if (
      !next ||
      !nextContext ||
      !validClock(next) ||
      next.startedMs <= request.startedMs ||
      isDeepStrictEqual(context.resource, nextContext.resource)
    )
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
