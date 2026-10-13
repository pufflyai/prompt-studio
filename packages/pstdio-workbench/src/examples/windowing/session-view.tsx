import type { ResourceRef } from "@pstdio/sdk/extensions";
import { useSyncExternalStore } from "react";
import type { WindowingLifecycleProbe } from "./lifecycle-probe";
import type { WindowingResources } from "./resources";
import { WindowingDraftView } from "./views";

export const WindowingSessionView = (props: {
  resource?: ResourceRef;
  resources: WindowingResources;
  probe: WindowingLifecycleProbe;
}) => {
  const { resource, resources, probe } = props;
  const read = () => resources.sessions.find((session) => session.id === resource?.id)?.context;
  const context = useSyncExternalStore(resources.subscribeContext, read, read);
  return <WindowingDraftView label="Session" resource={resource && { ...resource, context }} probe={probe} />;
};
