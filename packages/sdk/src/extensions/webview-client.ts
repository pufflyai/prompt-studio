import type {
  CommandDefinition,
  CommandNotice,
  JsonObject,
  NavigationTarget,
  ParamObjectSchema,
  ParamsOf,
  WebviewArtifactFile,
  WebviewPreferencesGetParams,
  WebviewPreferencesSetParams,
} from "pstdio-api-contracts/extension-kernel";
import { getCommandValue } from "./command-outcome";
import type { SettingsMap } from "./define-extension";
import type { GuestHost } from "./define-extension-view";
import { createWebviewAccountClient, type WebviewAccountClient } from "./webview-account-client";
import { type ArtifactMountKey, artifactMountId } from "./webview-capabilities";
import { createWebviewEditingClient, type WebviewEditingClient } from "./webview-editing";
import { createWebviewEventsClient, type WebviewEventsClient } from "./webview-events";
import { createWebviewFilesClient, type WebviewFilesClient } from "./webview-files-client";
import { createWebviewPageClient, type WebviewPageClient } from "./webview-page-client";
import { type CommandStreamOptions, openWebviewCommandStream, type WebviewStreamsClient } from "./webview-streams";

// Command types derive from a record of `defineCommand` values (the extension's
// exported commands map), not from `typeof extension`: `defineExtension` cannot keep
// per-command result types (see ADR 0012-temporary-webview-client-type-source).
type CommandFn<TDefinition> =
  TDefinition extends CommandDefinition<infer TSchema, infer TResult, infer _TSettings, infer _TChunk>
    ? TSchema extends ParamObjectSchema
      ? Partial<ParamsOf<TSchema>> extends ParamsOf<TSchema>
        ? (params?: ParamsOf<TSchema>) => Promise<TResult>
        : (params: ParamsOf<TSchema>) => Promise<TResult>
      : () => Promise<TResult>
    : never;

export type WebviewCommandsClient<TCommands> = {
  [K in keyof TCommands & string]: CommandFn<TCommands[K]>;
};

export type WebviewSettingsClient<TSettings> = {
  all: () => Promise<Partial<TSettings>>;
  get: <K extends keyof TSettings & string>(key: K) => Promise<TSettings[K] | undefined>;
  set: <K extends keyof TSettings & string>(key: K, value: TSettings[K]) => Promise<TSettings[K]>;
  /** Remove the stored value and restore the declared fallback. */
  delete: <K extends keyof TSettings & string>(key: K) => Promise<void>;
};

// Without a settings source the client rejects every key, instead of degrading to
// string keys the way the server-side empty settings map does.
type ClientSettingsMap<TSettings> = TSettings extends { properties: unknown }
  ? SettingsMap<TSettings>
  : Record<never, never>;

// Reads go to mounts the webview declared with `artifactsRead(...)`; the host
// enforces mount confinement, media types, and size limits.
export type WebviewArtifactsClient = {
  list: (mount: ArtifactMountKey, prefix?: string) => Promise<WebviewArtifactFile[]>;
  readText: (mount: ArtifactMountKey, path: string) => Promise<string>;
  /** Short-lived URL for an allowlisted raster image, usable in `<img src>`. */
  imageUrl: (mount: ArtifactMountKey, path: string) => Promise<string>;
};

export type WebviewClient<TCommands, TSettings = undefined> = {
  editing: WebviewEditingClient;
  files: WebviewFilesClient;
  page: WebviewPageClient;
  navigation: { open(target: NavigationTarget): Promise<void> };
  placement: { close(): Promise<void> };
  notify: { toast(notice: CommandNotice): Promise<void> };
  preferences: {
    get(
      name: string,
      scope?: WebviewPreferencesGetParams["scope"],
    ): Promise<WebviewPreferencesSetParams["value"] | undefined>;
    set(
      name: string,
      value: WebviewPreferencesSetParams["value"],
      scope?: WebviewPreferencesGetParams["scope"],
    ): Promise<{ name: string; value: WebviewPreferencesSetParams["value"] }>;
  };
  artifacts: WebviewArtifactsClient;
  commands: WebviewCommandsClient<TCommands>;
  streams: WebviewStreamsClient<TCommands>;
  events: WebviewEventsClient;
  settings: WebviewSettingsClient<ClientSettingsMap<TSettings>>;
  account: WebviewAccountClient;
};

export interface WebviewClientOptions {
  /** Overrides the extension id provided by the host bridge (e.g. in tests). */
  extensionId?: string;
  /** Runs commands in this workspace; omitted commands use the project's default workspace. */
  workspaceId?: string;
}

/**
 * Typed guest-side client over the host bridge. Command params and results come from
 * the extension's exported commands record (`defineCommand` values); settings come
 * from its exported settings contribution. Command outcomes are unwrapped, so
 * failures throw.
 *
 * Import both as types only, so no server code enters the webview bundle:
 *
 * @example
 *   import type { commands } from "../commands";
 *   import type { settings } from "../settings";
 *
 *   const client = createWebviewClient<typeof commands, typeof settings>(host);
 *   const { statuses } = await client.commands["ticket-status.read"]();
 *   const enabled = await client.settings.get("counter.enabled");
 */
export const createWebviewClient = <TCommands extends object, TSettings = undefined>(
  host: GuestHost,
  options?: WebviewClientOptions,
): WebviewClient<TCommands, TSettings> => {
  const extensionId = options?.extensionId ?? host.extensionId;
  if (!extensionId) {
    throw new Error("The host bridge did not provide an extension id. Pass { extensionId } to createWebviewClient.");
  }

  const runCommand = async (commandKey: string, params?: JsonObject) => {
    const response = await host.call("commands.execute", {
      commandId: `${extensionId}.command.${commandKey}`,
      params,
      ...(options?.workspaceId ? { workspaceId: options.workspaceId } : {}),
    });
    return getCommandValue(response.outcome);
  };

  // Command keys only exist at the type level, so property access builds the calls.
  const commands = new Proxy(
    {},
    {
      get: (_target, commandKey) => {
        if (typeof commandKey !== "string") return undefined;
        return (params?: JsonObject) => runCommand(commandKey, params);
      },
    },
  );

  const streams = new Proxy(
    {},
    {
      get: (_target, key) =>
        typeof key !== "string"
          ? undefined
          : (params?: JsonObject, streamOptions?: CommandStreamOptions) =>
              openWebviewCommandStream(
                host,
                { commandId: `${extensionId}.command.${key}`, params, workspaceId: options?.workspaceId },
                streamOptions,
              ),
    },
  );

  const settings = {
    all: async () => (await host.call("extension.settings.all", {})) ?? {},
    get: (key: string) => host.call("extension.settings.get", { key }),
    set: async (key: string, value: unknown) => {
      return (await host.call("extension.settings.set", { key, value })).value;
    },
    delete: async (key: string) => {
      await host.call("extension.settings.delete", { key });
    },
  };

  const artifacts: WebviewArtifactsClient = {
    list: (mount, prefix) =>
      host.call("artifacts.read", {
        op: "list",
        mount: artifactMountId(mount),
        ...(prefix === undefined ? {} : { prefix }),
      }),
    readText: (mount, path) => host.call("artifacts.read", { op: "readText", mount: artifactMountId(mount), path }),
    imageUrl: (mount, path) => host.call("artifacts.read", { op: "imageUrl", mount: artifactMountId(mount), path }),
  };

  const events = createWebviewEventsClient(host, extensionId);
  const hostClient: Pick<WebviewClient<TCommands, TSettings>, "navigation" | "placement" | "notify" | "preferences"> = {
    navigation: { open: (target) => host.call("navigation.open", { target }) },
    placement: { close: () => host.call("placement.close", {}) },
    notify: { toast: (notice) => host.call("notification.show", notice) },
    preferences: {
      get: (name, scope) => host.call("preferences.get", { name, scope }),
      set: (name, value, scope) => host.call("preferences.set", { name, value, scope }),
    },
  };
  return {
    ...hostClient,
    editing: createWebviewEditingClient(host),
    files: createWebviewFilesClient(host),
    page: createWebviewPageClient(host),
    artifacts,
    commands,
    streams,
    events,
    settings,
    account: createWebviewAccountClient(host),
  } as WebviewClient<TCommands, TSettings>;
};
