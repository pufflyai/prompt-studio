import { expect, test } from "bun:test";
import type { WebviewHostProps } from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./guest-host";
import { createWebviewClient } from "./webview-client";

test("typed navigation, placement, notices and preferences use the host contract", async () => {
  const calls: { method: string; params: unknown }[] = [];
  const preferences = new Map<string, unknown>();
  const host = {
    extensionId: "notes",
    onEvent: () => () => {},
    call: async (method: string, params: unknown) => {
      calls.push({ method, params });
      const request = params as { name: string; value?: unknown };
      if (method === "preferences.set") {
        preferences.set(request.name, request.value);
        return { name: request.name, value: request.value };
      }
      if (method === "preferences.get") return preferences.get(request.name);
    },
  } as GuestHost;
  const client = createWebviewClient<Record<string, never>>(host);
  const target = { kind: "href", href: "https://example.com" } as const;
  await client.navigation.open(target);
  await client.placement.close();
  await client.notify.toast({ type: "success", message: "Saved" });
  expect(await client.preferences.set("density", "compact")).toEqual({ name: "density", value: "compact" });
  expect(await client.preferences.get("density")).toBe("compact");
  expect(calls.slice(0, 3)).toEqual([
    { method: "navigation.open", params: { target } },
    { method: "placement.close", params: {} },
    { method: "notification.show", params: { type: "success", message: "Saved" } },
  ]);
});

test("the unified page client reads and subscribes to the runtime's props store", async () => {
  const page = { extensionId: "notes", kind: "page", id: "main" } as const;
  let props = {
    projectId: "project",
    themePreference: "system",
    locale: "en",
    pageLocation: { page, params: { tab: "notes" } },
    pageParams: { tab: "notes" },
    translations: { locale: "en", defaultLocale: "en", bundle: {}, defaultBundle: {} },
  };
  const listeners = new Set<(props: WebviewHostProps) => void>();
  const host = {
    extensionId: "notes",
    onEvent: () => () => {},
    propsStore: {
      get: () => props,
      subscribe: (listener: (props: WebviewHostProps) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    call: async (method: string, input: { params: { tab: string } }) => {
      if (method !== "page.params.update") throw new Error("Unexpected capability");
      props = { ...props, pageLocation: { page, params: input.params }, pageParams: input.params };
      for (const listener of listeners) listener(props);
      return { location: props.pageLocation };
    },
  } as GuestHost;
  const client = createWebviewClient<Record<string, never>>(host);
  expect(client.page.params()).toEqual({ tab: "notes" });
  let updates = 0;
  const stop = client.page.subscribe(() => {
    updates++;
  });
  expect(await client.page.updateParams({ tab: "files" })).toEqual({ page, params: { tab: "files" } });
  expect(client.page.location()).toEqual(props.pageLocation);
  expect(client.page.params()).toEqual({ tab: "files" });
  expect(updates).toBe(1);
  stop();
  expect(listeners.size).toBe(0);
});

test("the unified files client retains upload, list and delete behavior", async () => {
  const files = new Map<string, { id: string; name: string; size: number; mimeType: string; url: string }>();
  const host = {
    extensionId: "notes",
    onEvent: () => () => {},
    call: async (method: string, input: { name?: string; data?: Uint8Array; id?: string }) => {
      if (method === "files.upload") {
        const file = {
          id: "file",
          name: input.name!,
          size: input.data!.byteLength,
          mimeType: "text/plain",
          url: "files://file",
        };
        files.set(file.id, file);
        return file;
      }
      if (method === "files.list") return { files: [...files.values()] };
      if (method === "files.delete") files.delete(input.id!);
    },
  } as GuestHost;
  const client = createWebviewClient<Record<string, never>>(host);
  const file = await client.files.upload({ name: "note.txt", data: new Uint8Array([1]) });
  expect(await client.files.list()).toEqual([file]);
  await client.files.delete(file.id);
  expect(await client.files.list()).toEqual([]);
});

test("typed setting writes return the saved value from the host", async () => {
  const settings = { properties: { columns: { type: "number", scope: "project", default: 3 } } } as const;
  const host = {
    extensionId: "notes",
    onEvent: () => () => {},
    call: async () => ({ key: "columns", value: 4 }),
  } as GuestHost;
  const client = createWebviewClient<Record<string, never>, typeof settings>(host);
  expect(await client.settings.set("columns", 5)).toBe(4);
});
