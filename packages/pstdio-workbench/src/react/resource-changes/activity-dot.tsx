import { Box } from "@chakra-ui/react";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import { Tooltip } from "@pstdio/ui";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { WorkbenchModuleContext } from "../../core";
import { resourceChangesFor, subscribeResourceChanges } from "./change-store";

const emptySubscription = () => () => {};
const useChangeStore = (workbench?: WorkbenchModuleContext) => {
  const owner = workbench?.resources.store;
  const subscribe = useCallback(
    (listener: () => void) => (owner ? subscribeResourceChanges(owner, listener) : emptySubscription()),
    [owner],
  );
  return useSyncExternalStore(
    subscribe,
    () => workbench && resourceChangesFor(workbench),
    () => undefined,
  );
};
export const ActivityDot = ({
  workbench,
  resource,
  id: descriptionId,
}: {
  workbench: WorkbenchModuleContext;
  resource: ResourceRef;
  id?: string;
}) => {
  const store = useChangeStore(workbench);
  const { id, type, extensionId, projectId, device } = resource;
  const subscription = useCallback(
    (listener: () => void) => {
      const ref = { id, type, extensionId, projectId, device };
      return store?.tracks(ref) ? store.subscribe(ref, listener) : emptySubscription();
    },
    [store, id, type, extensionId, projectId, device],
  );
  const changed = useSyncExternalStore(
    subscription,
    () => store?.changed(resource) ?? false,
    () => false,
  );
  return changed ? <ResourceActivityDot id={descriptionId} /> : null;
};

export const ResourceActivityDot = ({ id }: { id?: string }) => (
  <Tooltip content="New activity">
    <Box
      as="span"
      id={id}
      role="img"
      aria-label="New activity"
      boxSize="1.5"
      bg="fg.info"
      borderRadius="full"
      flexShrink="0"
    />
  </Tooltip>
);

export const useObservedResource = (
  workbench: WorkbenchModuleContext | undefined,
  resource: ResourceRef | undefined,
  receipt: string | null | undefined,
  visible: boolean,
) => {
  const store = useChangeStore(workbench);
  const { id, type, projectId, extensionId, device } = resource ?? {};
  useEffect(() => {
    if (!store || !id || !type || !visible || !receipt) return;
    const ref = { id, type, projectId, extensionId, device };
    if (!store.tracks(ref)) return;
    let pending: AbortController | undefined;
    let done = false;
    const check = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) {
        pending?.abort();
        pending = undefined;
        return;
      }
      if (done || pending) return;
      const request = new AbortController();
      pending = request;
      void store
        .observe(ref, receipt, request.signal)
        .then(() => {
          if (!request.signal.aborted) done = true;
        })
        .catch(() => {})
        .finally(() => {
          if (pending === request) pending = undefined;
        });
    };
    check();
    window.addEventListener("focus", check);
    window.addEventListener("blur", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      pending?.abort();
      window.removeEventListener("focus", check);
      window.removeEventListener("blur", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [store, id, type, projectId, extensionId, device, receipt, visible]);
};
