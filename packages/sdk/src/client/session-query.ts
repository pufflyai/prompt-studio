import type { ExtensionSessionPage, ExtensionSessionQuery } from "pstdio-api-contracts/extension-kernel";
import type { RequestFn, RequestOptions } from "./request";

const encodeQuery = (input: ExtensionSessionQuery) => {
  const params = new URLSearchParams();
  if (input.status !== undefined) params.set("status", input.status.join(","));
  for (const key of [
    "agent",
    "workspaceId",
    "createdFrom",
    "createdTo",
    "updatedFrom",
    "cursor",
    "limit",
    "includeArchived",
  ] as const) {
    if (input[key] !== undefined) params.set(key, String(input[key]));
  }
  if (input.anchor) {
    params.set("anchorType", input.anchor.type);
    params.set("anchorId", input.anchor.id);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const createSessionQueryClient = (request: RequestFn) => {
  const query = async (
    projectId: string,
    input: ExtensionSessionQuery = {},
    options?: Pick<RequestOptions, "signal">,
  ) => {
    options?.signal?.throwIfAborted();
    return request<ExtensionSessionPage>(
      `/v1/projects/${encodeURIComponent(projectId)}/sessions${encodeQuery(input)}`,
      options,
    );
  };
  const iterate = async function* (
    projectId: string,
    input: ExtensionSessionQuery = {},
    options?: Pick<RequestOptions, "signal">,
  ) {
    let cursor = input.cursor;
    do {
      const page = await query(projectId, { ...input, cursor }, options);
      for (const item of page.items) {
        options?.signal?.throwIfAborted();
        yield item;
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  };
  return { query, iterate };
};
