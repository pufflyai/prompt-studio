import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { createProjectExtensionCache } from "./project-extension-cache";
import { getProjectExtensionQueries } from "./project-extension-queries";

type Cache = ReturnType<typeof createProjectExtensionCache>;
interface Target {
  projectId: string;
  api: ReturnType<typeof getRuntimeApiClient>;
  owner: ReturnType<typeof getRuntimeCollections>;
}
const ownerKeys = new WeakMap<object, number>();
let nextOwnerKey = 0;
const ownerKey = (owner: object) => {
  let key = ownerKeys.get(owner);
  if (key === undefined) {
    key = ++nextOwnerKey;
    ownerKeys.set(owner, key);
  }
  return key;
};

/** Each invocation keeps its original authority, even when React Query updates observer options. */
export const useExtensionMutation = <Input extends object, Result>(
  projectId: string | undefined,
  operation: string,
  input: {
    run(value: Input, target: Target): Promise<Result>;
    accept?(result: Result, value: Input, cache: Cache, target: Target): Promise<unknown> | unknown;
  },
) => {
  const client = useQueryClient();
  const owner = getRuntimeCollections();
  const queries = getDashboardScopedQueries(owner);
  const scope = getProjectExtensionQueries(projectId, { owner, queries }).metadata;
  // Mounted actions retain their authority marker without starting optional metadata reads.
  useEffect(() => {
    if (!scope.isDisposed()) return scope.subscribe(() => {}, { automatic: false });
  }, [scope]);
  const target = { projectId: projectId!, api: getRuntimeApiClient(owner), owner };
  const assertCurrent = () => {
    if (!projectId) throw new Error("Project id is required for this action.");
    if (scope.isDisposed()) throw new Error("This action belongs to a closed project or account.");
  };
  return useMutation<Result, Error, Input, Cache>({
    // A retired owner never inherits callbacks from the new account's observer.
    mutationKey: [...scope.key, "mutation", operation, ownerKey(scope)],
    onMutate: (value) => {
      assertCurrent();
      const instanceId = "instanceId" in value && typeof value.instanceId === "string" ? value.instanceId : undefined;
      return createProjectExtensionCache(client, projectId, queries, { instanceId });
    },
    mutationFn: (value) => {
      assertCurrent();
      return input.run(value, target);
    },
    onSuccess: (result, value, cache) => {
      if (cache.active) return input.accept?.(result, value, cache, target);
    },
    onSettled: (_result, _error, _value, cache) => cache?.dispose(),
  });
};
