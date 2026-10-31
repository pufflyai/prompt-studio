import { type AccountClient, createAccountClient } from "./account";
import { type AgentClient, createAgentClient } from "./agents";
import { type AssetsClient, createAssetsClient } from "./assets";
import { type AutomationClient, createAutomationClient } from "./automation";
import { type BoardViewsClient, createBoardViewsClient } from "./board-views";
import { createExtensionClient, type ExtensionClient } from "./extensions";
import { createFilesystemClient, type FilesystemClient } from "./filesystem";
import { createLinkIconsClient, type LinkIconsClient } from "./link-icons";
import { createNativeDocumentsClient, type NativeDocumentsClient } from "./native-documents";
import { createNotificationsClient, type NotificationsClient } from "./notifications";
import { createProjectClient, type ProjectClient } from "./projects";
import type { ClientOptions } from "./request";
import { createRequest } from "./request";
import { createResourceAnchorsClient, type ResourceAnchorsClient } from "./resource-anchors";
import { createRuntimeClient, type RuntimeClient } from "./runtime";
import { createSessionStreamTransport } from "./session-stream";
import { createSessionClient, type SessionClient } from "./sessions";
import { createSettingsClient, type SettingsClient } from "./settings";
import { createSkillClient, type SkillClient } from "./skills";
import { createSyncClient, type SyncClient } from "./sync";
import { createTextTransportClient, type TextEditingTransportClient } from "./text-editing";
import { createWorkspaceClient, type WorkspaceClient } from "./workspaces";

export type PstdioClient = {
  account: AccountClient;
  assets: AssetsClient;
  resources: ResourceAnchorsClient;
  views: BoardViewsClient;
  projects: ProjectClient;
  filesystem: FilesystemClient;
  workspaces: WorkspaceClient;
  sessions: SessionClient;
  skills: SkillClient;
  agents: AgentClient;
  automation: AutomationClient;
  notifications: NotificationsClient;
  nativeDocuments: NativeDocumentsClient;
  textEditing: TextEditingTransportClient;
  extensions: ExtensionClient;
  settings: SettingsClient;
  linkIcons: LinkIconsClient;
  sync: SyncClient;
  runtime: RuntimeClient;
};

export const createClient = (options: ClientOptions = {}): PstdioClient => {
  const request = createRequest(options);
  const streams = createSessionStreamTransport(request, options);
  return {
    account: createAccountClient(request),
    assets: createAssetsClient(request),
    resources: createResourceAnchorsClient(request),
    views: createBoardViewsClient(request),
    projects: createProjectClient(request),
    filesystem: createFilesystemClient(request),
    workspaces: createWorkspaceClient(request),
    sessions: createSessionClient(request, options, streams),
    skills: createSkillClient(request),
    agents: createAgentClient(request, options),
    automation: createAutomationClient(request),
    notifications: createNotificationsClient(request),
    nativeDocuments: createNativeDocumentsClient(request),
    textEditing: createTextTransportClient(request),
    extensions: createExtensionClient(request, streams),
    settings: createSettingsClient(request),
    linkIcons: createLinkIconsClient(request),
    sync: createSyncClient(options),
    runtime: createRuntimeClient(request),
  };
};
