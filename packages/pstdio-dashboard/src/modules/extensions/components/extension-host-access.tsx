import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { ExtensionConnectionsCard } from "./extension-connections-card";
import { ExtensionEnvironmentAccessSection } from "./extension-environment-access-section";

type ConnectionDefinition = NonNullable<WorkbenchExtensionMetadata["connections"]>[number];

interface ExtensionHostAccessProps {
  projectId: string | undefined;
  extensionId: string;
  connections: ConnectionDefinition[];
  /** Names from the source's `pstdio.processEnvironment`. */
  requestedEnvironment: string[] | undefined;
}

/** Host-held credentials and environment values a project grants an extension. Both are per project. */
export const hasExtensionHostAccess = (props: ExtensionHostAccessProps) =>
  Boolean(props.projectId) && (props.connections.length > 0 || (props.requestedEnvironment?.length ?? 0) > 0);

export const ExtensionHostAccess = (props: ExtensionHostAccessProps) => {
  const { projectId, extensionId, connections, requestedEnvironment = [] } = props;
  if (!projectId) return null;

  return (
    <>
      {connections.length > 0 ? <ExtensionConnectionsCard projectId={projectId} definitions={connections} /> : null}
      {requestedEnvironment.length > 0 ? (
        <ExtensionEnvironmentAccessSection projectId={projectId} extensionId={extensionId} />
      ) : null}
    </>
  );
};
