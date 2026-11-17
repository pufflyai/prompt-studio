import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { apiClientOptions } from "@/lib/api";
import { releaseRuntimeCollections, retainRuntimeCollections } from "@/lib/sync/collections";
import { HarnessParamField } from "./harness-param-field";
import {
  createMemoryRecentHarnessStorage,
  readRecentHarnessSetup,
  saveRecentHarnessSelection,
} from "./recent-harness-param";

test("parameter edits remember the active model even when it came from the catalog or a session", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previousAct = environment.IS_REACT_ACT_ENVIRONMENT;
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = createMemoryRecentHarnessStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const connection = apiClientOptions();
  const owner = retainRuntimeCollections(connection);
  owner.getWriter("projects")!.upsert({ id: "model-memory", name: "Model memory" });
  const workbench = createWorkbench();
  workbench.context.set("dashboard.project.id", "model-memory");
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const schema = {
    effort: {
      type: "select",
      options: [
        { label: "Low", value: "low" },
        { label: "High", value: "high" },
      ],
    },
  };
  client.setQueryData(
    ["agents-info", "model-memory"],
    [{ id: "codex", name: "Codex", supportsModels: true, availability: { type: "INSTALLED" }, params: schema }],
  );
  client.setQueryData(["agent-models", "codex", "model-memory"], [{ id: "catalog" }, { id: "session" }]);
  for (const model of ["catalog", "session"])
    client.setQueryData(["harness-param-defaults", "model-memory", "codex", model], {
      schema,
      defaults: { effort: "low" },
    });
  let field!: ReturnType<typeof HarnessParamField>;
  const Capture = ({ model }: { model: string }) => {
    field = HarnessParamField({
      workbench,
      entry: { key: "harness", type: "harness", label: "Harness" },
      value: JSON.stringify({ harnessId: "codex", model }),
      disabled: false,
      harness: { presentation: "chat" },
      onChange() {},
    });
    // Exercise the real field hooks and event handlers without mounting unrelated menu UI.
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    for (const model of ["catalog", "session"]) {
      if (model === "session")
        saveRecentHarnessSelection("model-memory", { harnessId: "codex", model: "older" }, storage);
      await act(async () => {
        renderer = create(
          <QueryClientProvider client={client}>
            <Capture model={model} />
          </QueryClientProvider>,
        );
      });
      await act(async () => {
        field.props.children[1].props.onOverridesChange({ effort: "high" });
      });
      expect(readRecentHarnessSetup("model-memory", "codex", storage)).toEqual({ model, params: { effort: "high" } });
      await act(async () => renderer?.unmount());
      renderer = undefined;
    }
  } finally {
    await act(async () => renderer?.unmount());
    client.clear();
    await workbench.dispose();
    await releaseRuntimeCollections(connection);
    if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
    environment.IS_REACT_ACT_ENVIRONMENT = previousAct;
  }
});
