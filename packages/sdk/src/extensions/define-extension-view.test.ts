import { afterEach, describe, expect, test } from "bun:test";
import { defineExtensionView, type WebviewFilesClient } from "./define-extension-view";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class FakeFileInput {
  type = "";
  accept = "";
  multiple = false;
  files: FileList | null = null;
  style = { display: "" };
  removed = false;
  onchange: (() => void) | null = null;
  onerror: (() => void) | null = null;

  private listeners = new Map<string, Array<() => void>>();

  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  click() {}

  remove() {
    this.removed = true;
  }

  dispatch(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

const originalDocument = globalThis.document;

afterEach(() => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: originalDocument,
  });
});

describe("defineExtensionView", () => {
  test("exposes locale and translates from live webview props", async () => {
    let props: {
      translations: {
        bundle: Record<string, string>;
        defaultBundle: Record<string, string>;
        locale: string;
      };
    } = {
      translations: {
        locale: "fr",
        bundle: { save: "Enregistrer", greeting: "Bonjour {{name}}" },
        defaultBundle: { save: "Save" },
      },
    };
    let locale = "";
    let save = "";
    let greeting = "";
    let fallback = "";

    const view = defineExtensionView({
      render: (context) => {
        locale = context.locale;
        save = context.t("save", "Save");
        greeting = context.t("greeting", "Hello {{name}}", { name: "Ari" });
        fallback = context.t("missing", "Missing");
        props = { translations: { locale: "en", bundle: {}, defaultBundle: { save: "Save" } } };
        locale = context.locale;
      },
    });

    await view.mount(
      {} as HTMLElement,
      { call: async <TResult = unknown>() => undefined as TResult },
      { get: () => props, subscribe: () => () => undefined },
    );

    expect(save).toBe("Enregistrer");
    expect(greeting).toBe("Bonjour Ari");
    expect(fallback).toBe("Missing");
    expect(locale).toBe("en");
  });

  test("resolves an empty file list when the picker is cancelled", async () => {
    const inputs: FakeFileInput[] = [];
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        body: { appendChild: () => undefined },
        createElement: () => {
          const input = new FakeFileInput();
          inputs.push(input);
          return input;
        },
      },
    });

    let filesClient: WebviewFilesClient | undefined;
    const view = defineExtensionView({
      render: ({ files }) => {
        filesClient = files;
      },
    });

    await view.mount(
      {} as HTMLElement,
      { call: async <TResult = unknown>() => undefined as TResult },
      { get: () => undefined, subscribe: () => () => undefined },
    );

    const picked = filesClient!.pick();
    inputs[0].dispatch("cancel");

    await expect(Promise.race([picked, wait(10).then(() => "pending")])).resolves.toEqual([]);
    expect(inputs[0].removed).toBe(true);
  });
});
