import type {
  CommandDefinition,
  ParamObjectSchema,
  ParamsOf,
  WebviewArtifactFile,
} from "pstdio-api-contracts/extension-kernel";
import { type CommandResponse, unwrapCommandOutcome } from "./command-outcome";
import type { SettingsMap } from "./define-extension";
import type { GuestHost } from "./define-extension-view";
import { type ArtifactMountKey, artifactMountId } from "./webview-capabilities";

// Command types derive from a record of `defineCommand` values (the extension's
// exported commands map), not from `typeof extension`: `defineExtension` cannot keep
// per-command result types (see ADR 0012-webview-client-type-source).
type CommandFn<TDefinition> =
  TDefinition extends CommandDefinition<infer TSchema, infer TResult, infer _TSettings>
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
  set: <K extends keyof TSettings & string>(key: K, value: TSettings[K]) => Promise<void>;
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
  artifacts: WebviewArtifactsClient;
  commands: WebviewCommandsClient<TCommands>;
  settings: WebviewSettingsClient<ClientSettingsMap<TSettings>>;
};

export interface WebviewClientOptions {
  /** Overrides the extension id provided by the host bridge (e.g. in tests). */
  extensionId?: string;
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

  const runCommand = async (commandKey: string, params?: unknown) => {
    const response = await host.call<CommandResponse<unknown>>("commands.execute", {
      commandId: `${extensionId}.command.${commandKey}`,
      params,
    });
    return unwrapCommandOutcome(response);
  };

  // Command keys only exist at the type level, so property access builds the calls.
  const commands = new Proxy(
    {},
    {
      get: (_target, commandKey) => {
        if (typeof commandKey !== "string") return undefined;
        return (params?: unknown) => runCommand(commandKey, params);
      },
    },
  );

  const settings = {
    all: async () => (await host.call<Record<string, unknown>>("extension.settings.all", {})) ?? {},
    get: (key: string) => host.call("extension.settings.get", { key }),
    set: async (key: string, value: unknown) => {
      await host.call("extension.settings.set", { key, value });
    },
  };

  const artifacts: WebviewArtifactsClient = {
    list: (mount, prefix) =>
      host.call<WebviewArtifactFile[]>("artifacts.read", {
        op: "list",
        mount: artifactMountId(mount),
        ...(prefix === undefined ? {} : { prefix }),
      }),
    readText: (mount, path) =>
      host.call<string>("artifacts.read", { op: "readText", mount: artifactMountId(mount), path }),
    imageUrl: (mount, path) =>
      host.call<string>("artifacts.read", { op: "imageUrl", mount: artifactMountId(mount), path }),
  };

  return { artifacts, commands, settings } as WebviewClient<TCommands, TSettings>;
};
