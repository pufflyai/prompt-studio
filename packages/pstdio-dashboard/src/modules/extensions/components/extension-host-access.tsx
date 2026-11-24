import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { ExtensionConnectionsCard } from "./extension-connections-card";
import { ExtensionEnvironmentAccessSection } from "./extension-environment-access-section";

type ConnectionDefinition = NonNullable<WorkbenchExtensionMetadata["connections"]>[number];

interface ExtensionHostAccessProps {
  projectId: string | undefined;
  extensionId: string;
  connections: ConnectionDefinition[];
  /** The current source requests names, or an older grant is still revocable. */
  showEnvironment: boolean;
}

/** Host-held credentials and environment values a project grants an extension. Both are per project. */
export const hasExtensionHostAccess = (props: ExtensionHostAccessProps) =>
  Boolean(props.projectId) && (props.connections.length > 0 || props.showEnvironment);

export const ExtensionHostAccess = (props: ExtensionHostAccessProps) => {
  const { projectId, extensionId, connections, showEnvironment } = props;
  if (!projectId) return null;

  return (
    <>
      {connections.length > 0 ? <ExtensionConnectionsCard projectId={projectId} definitions={connections} /> : null}
      {showEnvironment ? <ExtensionEnvironmentAccessSection projectId={projectId} extensionId={extensionId} /> : null}
    </>
  );
};
