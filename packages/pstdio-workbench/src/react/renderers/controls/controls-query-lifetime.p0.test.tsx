import { afterEach, beforeEach, expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { ParamEditor } from "@pstdio/ui/param-editor";
import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, getWorkbenchRenderers, type WorkbenchCore } from "../../../core";
import { SettingsPageContext } from "../../settings/settings-page-context";
import { useRendererRead } from "../use-renderer-read";
import { WorkbenchControlsView } from "./controls-view";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previous = environment.IS_REACT_ACT_ENVIRONMENT;
const previousFrame = globalThis.requestAnimationFrame,
  previousCancelFrame = globalThis.cancelAnimationFrame;
const frames = new Map<number, FrameRequestCallback>();
beforeEach(() => {
  let next = 0;
  globalThis.requestAnimationFrame = (callback) => {
    frames.set(++next, callback);
    return next;
  };
  globalThis.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
});
let tree: ReactTestRenderer | undefined;
const cores: WorkbenchCore[] = [],
  releases: (() => void)[] = [];
afterEach(async () => {
  for (const release of releases.splice(0)) release();
  await act(async () => tree?.unmount());
  tree = undefined;
  for (const core of cores.splice(0)) await core.dispose();
  frames.clear();
  globalThis.requestAnimationFrame = previousFrame;
  globalThis.cancelAnimationFrame = previousCancelFrame;
  environment.IS_REACT_ACT_ENVIRONMENT = previous;
});

test("production controls preserve FIFO writes through a failure and unmount, then reconcile accepted values", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const core = createWorkbench();
  cores.push(core);
  const first = Promise.withResolvers<void>(),
    second = Promise.withResolvers<void>(),
    entered = Promise.withResolvers<void>();
  releases.push(() => {
    first.resolve();
    second.resolve();
  });
  let calls = 0,
    server = "before";
  const writes: string[] = [];
  const registry = getWorkbenchRenderers(core);
  registry.registerControlsRenderer({
    id: "controls",
    title: "Controls",
    executeQuery: () => {
      calls++;
      return {
        params: [{ id: "name", type: "text", name: "Name", singleLine: true, defaultValue: "" }],
        values: { name: server },
      };
    },
    updateValue: async ({ value }) => {
      writes.push(String(value));
      if (value === "first") await first.promise;
      else {
        entered.resolve();
        await second.promise;
        server = String(value);
      }
    },
  });
  const content = () => (
    <ChakraProvider value={psTheme}>
      <SettingsPageContext value={{ workbench: core, title: "Controls" }}>
        <WorkbenchControlsView
          workbench={core}
          contribution={registry.getControlsRenderer("controls")!}
          placement={{ instanceId: "one", panelId: "controls", closable: false }}
        />
      </SettingsPageContext>
    </ChakraProvider>
  );
  const editor = () => tree!.root.findByType(ParamEditor).props as ComponentProps<typeof ParamEditor>;
  await act(async () => {
    tree = create(content());
  });
  expect(calls).toBe(1);
  await act(async () => {
    editor().onChange?.("name", "first");
  });
  await act(async () => {
    editor().onChange?.("name", "second");
  });
  expect(writes).toEqual(["first"]);
  await act(async () => tree!.unmount());
  tree = undefined;
  await act(async () => {
    first.reject(new Error("First save failed"));
    await entered.promise;
  });
  expect(writes).toEqual(["first", "second"]);
  expect(calls).toBe(1);
  await act(async () => {
    second.resolve();
  });
  await act(async () => {
    tree = create(content());
  });
  expect(calls).toBe(2);
  expect(editor().defaultValues).toEqual({ name: "second" });
});

test("native mutation admission spans peer cores and parameter variants for one source resource", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const queries = createScopedQueryClient({ runtimeId: "runtime", projectId: "project", extensionId: "notes" });
  const a = createWorkbench({ queries }),
    b = createWorkbench({ queries });
  cores.push(a, b);
  const saved = Promise.withResolvers<void>();
  releases.push(saved.resolve);
  let server = "before";
  const values: Record<string, ReturnType<typeof useRendererRead<string>>> = {};
  const calls = { a: 0, b: 0 };
  const Capture = ({ name, core }: { name: "a" | "b"; core: WorkbenchCore }) => {
    values[name] = useRendererRead({
      workbench: core,
      ownerKey: name,
      queryKey: name,
      sourceId: "same",
      queryScope: { projectId: "project", extensionId: "notes" },
      dependency: { resourceKey: "same-resource" },
      load: () => {
        calls[name]++;
        return server;
      },
    });
    return null;
  };
  try {
    await act(async () => {
      tree = create(
        <>
          <Capture name="a" core={a} />
          <Capture name="b" core={b} />
        </>,
      );
    });
    let writing: Promise<void>;
    await act(async () => {
      writing = values.a!.mutate(
        () => "preview",
        () => saved.promise,
      );
    });
    server = "after";
    await act(async () => {
      saved.resolve();
      await writing;
    });
    expect(calls).toEqual({ a: 2, b: 2 });
    expect([values.a!.value, values.b!.value]).toEqual([server, server]);
  } finally {
    await act(async () => tree?.unmount());
    tree = undefined;
    queries.dispose();
  }
});
