import { createLiveConnection, createRelayAccess, type LiveConnection } from "pstdio-sync/relay";
import { canonicalJson } from "pstdio-sync-contracts";
import { resourceActivityOwnerId } from "../../features/activity/resource-activity-store";
import { publishedExtensionsId } from "../../features/extensions/publication/catalog";
import { apiLogger } from "../../lib/logger";
import { AccountRequestError } from "../account/native-account";
import { isRecoveryCatalogOwner } from "../project-recovery/catalog";
import { startAutomationSync } from "./automations";
import { startCoreDocumentSync } from "./core-documents";
import { startCoreRecordSync } from "./core-records";
import type { RelayDeps } from "./deps";
import { createDeviceCommandCaller } from "./device-command-call";
import { startDeviceCommands } from "./device-commands";
import { extensionOwnerContextKey, startRelayExtension } from "./extension-owner";
import { startFolderRecovery } from "./folder-recovery";
import { startRelayPersonalHistory } from "./personal";
import { projectOwnerProgress, readOwnerStatus } from "./project-owner-progress";
import { createProjectSyncRetry } from "./project-sync-retry";
import { startPublishedExtensions } from "./publications";
import { createStorageChangeAnnouncer } from "./storage-changes";
import { createWorkbenchConnections } from "./workbench-connections";

export type RelayWorkbench = {
  accountId: string;
  workbenchId: string;
  environmentId: string;
  relayOrigin: string;
  managerOrigin: string;
  renewalGrant: string;
};

const assertLiveAvailable = (channel?: LiveConnection) => {
  if (channel?.status().protocolUnsupported)
    throw new AccountRequestError(
      "Update Prompt Studio or the relay to continue Cloud sync: the live channel version is unsupported.",
    );
  if (channel?.status().controlRefused)
    throw new AccountRequestError(
      "The relay's rate limits prevent Cloud subscriptions. Ask its operator to enable live requests, then reconnect Cloud.",
    );
};

const watchNativeSources = (
  deps: RelayDeps,
  connections: Map<string, Awaited<ReturnType<typeof startRelayExtension>>>,
) =>
  deps.nativeDocuments.sources.watch((owner, name) => {
    connections.get(JSON.stringify([owner.workbenchId, owner.extensionId]))?.wakeDocument(name);
  });

const watchRuntimeChanges = (deps: RelayDeps, refresh: () => Promise<void>) =>
  deps.eventBus.subscribe((event) => {
    if (["extension_instances", "installed_extension_sources", "projects", "workspaces"].includes(event.table))
      void refresh();
  });

