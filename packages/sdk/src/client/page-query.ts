import type { PageQuery } from "pstdio-api-contracts";
export const pageQuery = (input: PageQuery = {}) => {
  const params = new URLSearchParams();
  if (input.cursor !== undefined) params.set("cursor", input.cursor);
  if (input.limit !== undefined) params.set("limit", String(input.limit));
  return params.size ? `?${params}` : "";
};

export const projectPageQuery = (projectId: string | undefined, input: PageQuery = {}) => {
  const query = new URLSearchParams();
  if (projectId !== undefined) query.set("projectId", projectId);
  for (const [key, value] of new URLSearchParams(pageQuery(input))) query.set(key, value);
  return query.size ? `?${query}` : "";
};
