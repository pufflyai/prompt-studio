import { CommandOutcomeError } from "@pstdio/sdk/extensions";
import { validatedCommandOutcomeSchema } from "pstdio-api-contracts";
import type {
  MaybePromise,
  WebviewHostCapability,
  WebviewHostCapabilityParams,
} from "pstdio-api-contracts/extension-kernel";
import type { HostCapability } from "pstdio-extensions/bridge/contract";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import { z } from "zod";
import { createAccountCapability } from "./account-capability";
import type { ExtensionWebviewHostAdapters } from "./extension-webview-host-adapters";
import { createTerminalSessionCapability } from "./terminal-session-capability";
import { parseWebviewCapabilityParams, WebviewHostCapabilityError } from "./webview-capability-params";
import { createWebviewCommandStreamHandler, withFrameSignal } from "./webview-command-streams";

const commandResponse = z.object({ outcome: validatedCommandOutcomeSchema }).passthrough();
const streamHandlers = new WeakMap<HostEventPublisher, ReturnType<typeof createWebviewCommandStreamHandler>>();
const streamHandler = (events: HostEventPublisher) => {
  let handler = streamHandlers.get(events);
  if (!handler) {
    handler = createWebviewCommandStreamHandler(events);
    streamHandlers.set(events, handler);
  }
  return handler;
};
const after = <T>(result: MaybePromise<T>, done: () => unknown) =>
  result instanceof Promise ? result.then(done) : done();

const capability =
  <Name extends WebviewHostCapability>(
    name: Name,
    run: ((params: WebviewHostCapabilityParams[Name]) => unknown) | undefined,
  ) =>
  (input: unknown) => {
    if (!run)
      throw new WebviewHostCapabilityError("unsupported", `The host does not support ${name}.`, { capability: name });
    return run(parseWebviewCapabilityParams(name, input));
  };

const commandExecution = (adapters: ExtensionWebviewHostAdapters) => {
  const { executeCommand, hostEvents } = adapters;
  if (!executeCommand) return undefined;
  return async (request: WebviewHostCapabilityParams["commands.execute"]) => {
    try {
      const response = hostEvents
        ? await withFrameSignal(hostEvents, (signal) => Promise.resolve(executeCommand(request, signal)))
        : await executeCommand(request);
      return commandResponse.parse(response);
    } catch (error) {
      if (error instanceof CommandOutcomeError) return commandResponse.parse({ outcome: error.outcome });
      throw error;
    }
  };
};
const commandStreaming = (adapters: ExtensionWebviewHostAdapters) => {
  const { streamCommand, hostEvents } = adapters;
  if (!streamCommand || !hostEvents) return undefined;
  return (request: WebviewHostCapabilityParams["commands.stream"]) =>
    streamHandler(hostEvents)(request, { stream: streamCommand, publish: adapters.commandCompleted });
};

export const createExtensionWebviewHostCapabilities = (adapters: ExtensionWebviewHostAdapters) => {
  const {
    hostEvents,
    navigation,
    pageParams,
    placement,
    notifications,
    settings,
    preferences,
    files,
    artifacts,
    terminal,
  } = adapters;
  const terminalCapability =
    terminal && hostEvents ? createTerminalSessionCapability({ terminal, hostEvents }) : undefined;
  const readHarnesses = adapters.harnesses?.read.bind(adapters.harnesses);
  const account = createAccountCapability(adapters.account);
  return {
    "harnesses.read": capability("harnesses.read", readHarnesses),
    "resources.actions": capability("resources.actions", adapters.resourceActions),
    "commands.execute": capability("commands.execute", commandExecution(adapters)),
    "commands.stream": capability("commands.stream", commandStreaming(adapters)),
    "navigation.open": capability(
      "navigation.open",
      navigation && ((request) => after(navigation.open(request.target), () => undefined)),
    ),
    "page.params.update": capability(
      "page.params.update",
      pageParams &&
        ((request) => {
          const location = pageParams.update(request.params);
          return location instanceof Promise ? location.then((value) => ({ location: value })) : { location };
        }),
    ),
    "placement.close": capability("placement.close", placement && (() => placement.close())),
    "notification.show": capability(
      "notification.show",
      notifications?.show &&
        ((request) =>
          after(
            notifications.show!(
              "type" in request
                ? request
                : {
                    type: request.level,
                    ...(request.title === undefined ? {} : { title: request.title }),
                    message: request.message ?? "",
                  },
            ),
            () => undefined,
          )),
    ),
    "notification.action": capability(
      "notification.action",
      notifications?.create && ((request) => notifications.create!(request)),
    ),
    "notification.resolve": capability(
      "notification.resolve",
      notifications?.resolve && ((request) => notifications.resolve!({ ...request, status: request.status ?? "done" })),
    ),
    "notification.dismiss": capability(
      "notification.dismiss",
      notifications?.resolve && ((request) => notifications.resolve!({ ...request, status: "dismissed" })),
    ),
    "preferences.get": capability(
      "preferences.get",
      preferences && ((request) => preferences.get(request.name, request.scope)),
    ),
    "preferences.set": capability(
      "preferences.set",
      preferences &&
        ((request) => {
          const scope = request.scope ?? { scope: "user" };
          if (scope.scope === "default")
            throw new WebviewHostCapabilityError(
              "preference_scope_read_only",
              "Default preferences are read-only.",
              {},
            );
          return after(preferences.set(request.name, request.value, scope), () => ({
            name: request.name,
            value: request.value,
          }));
        }),
    ),
    "extension.settings.all": capability("extension.settings.all", settings && (() => settings.all())),
    "extension.settings.get": capability(
      "extension.settings.get",
      settings && ((request) => settings.get(request.key)),
    ),
    "extension.settings.set": capability(
      "extension.settings.set",
      settings &&
        (async (request) => ({ key: request.key, value: (await settings.set(request.key, request.value)).value })),
    ),
    "extension.settings.delete": capability(
      "extension.settings.delete",
      settings && ((request) => settings.delete(request.key)),
    ),
    "terminal.session": capability(
      "terminal.session",
      terminalCapability && ((request) => terminalCapability(request)),
    ),
    "files.upload": capability("files.upload", files && ((request) => files.upload(request))),
    "files.list": capability("files.list", files && ((request) => files.list(request))),
    "files.delete": capability("files.delete", files && ((request) => files.delete(request))),
    "artifacts.read": capability("artifacts.read", artifacts && ((request) => artifacts.read(request))),
    "account.read": capability("account.read", account),
    "account.manage": capability("account.manage", account),
  } satisfies Record<WebviewHostCapability, HostCapability>;
};
