import { mock } from "bun:test";
import assert from "node:assert/strict";
import type { ParamEditorProps } from "@pstdio/ui/param-editor";
import { type ComponentProps, createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { PreferenceRegistry } from "../../../core/registries/preferences/preference-registry";

type ValueHook = (
  params: NonNullable<ParamEditorProps["params"]>,
  groups: NonNullable<ParamEditorProps["groups"]>,
  defaults: NonNullable<ParamEditorProps["defaultValues"]>,
  changed?: ParamEditorProps["onChange"],
) => { values: NonNullable<ParamEditorProps["defaultValues"]>; onChange: NonNullable<ParamEditorProps["onChange"]> };
// Load the real private control hook at runtime without pulling UI source into this package's declaration root.
const { useParamEditorValues } = (await import(
  new URL("../../../../../ui/src/components/param-editor/param-editor-values.ts", import.meta.url).href
)) as { useParamEditorValues: ValueHook };

// This fixture runs in a separate Bun process: primitive mocks cannot affect other tests.
const chakra = await import("@chakra-ui/react");
mock.module("@chakra-ui/react", () => ({
  ...chakra,
  ...Object.fromEntries(
    ["Button", "HStack", "Stack", "Text"].map((name) => [
      name,
      (props: Record<string, unknown>) => createElement(name === "Button" ? "button" : "div", props),
    ]),
  ),
}));
let editor: ReturnType<typeof useParamEditorValues>;
const paramEditor = await import("@pstdio/ui/param-editor");
mock.module("@pstdio/ui/param-editor", () => ({
  ...paramEditor,
  ParamEditor: (props: ParamEditorProps) => {
    editor = useParamEditorValues(props.params ?? [], props.groups ?? [], props.defaultValues ?? {}, props.onChange);
    return null;
  },
}));
const { SettingsActions } = await import("@pstdio/ui");
const { WorkbenchPreferencesForm } = await import("./preferences-form");
const { createPreferenceRegistry } = await import("../../../core/registries/preferences/preference-registry");
const { SettingsPageContext } = await import("../../settings/settings-page-context");
const { settingsLeaveGuard } = await import("../../settings/settings-leave-guard");
const { createWorkbench } = await import("../../../core");
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const schema = { properties: { size: { type: "number", scope: "user", default: 0 } } } as const;
const render = (preferences: PreferenceRegistry, mode: "apply" | "live" = "apply") => (
  <WorkbenchPreferencesForm preferences={preferences} names={["size"]} mode={mode} />
);
const save = (tree: ReactTestRenderer): ComponentProps<typeof SettingsActions> => {
  return tree.root.findByType(SettingsActions).props as ComponentProps<typeof SettingsActions>;
};

const failedSave = async () => {
  let persisted = 0;
  const gate = Promise.withResolvers<void>();
  const registry = createPreferenceRegistry({
    persistence: {
      getValue: () => persisted,
      async setValue(_name, value) {
        await gate.promise;
        persisted = Number(value);
      },
    },
  });
  registry.registerSchema(schema);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(render(registry));
  });
  try {
    await act(async () => editor.onChange("size", 7));
    let pending: Promise<unknown> | undefined;
    await act(async () => {
      pending = Promise.resolve(save(tree).onSave()).catch((error) => error);
    });
    assert.equal(save(tree).dirty, true);
    assert.equal(save(tree).saving, true);
    assert.equal(persisted, 0);
    assert.equal(editor.values.size, 7);
    await act(async () => {
      gate.reject(new Error("disk full"));
      await pending;
    });
    assert.equal(save(tree).dirty, true);
    assert.equal(save(tree).saving, false);
    assert.equal(editor.values.size, 7);
    assert.equal(persisted, 0);
  } finally {
    gate.resolve();
    await act(async () => tree.unmount());
    await registry.dispose?.();
  }
};
const ownerSwitch = async () => {
  const first = createPreferenceRegistry();
  const second = createPreferenceRegistry();
  first.registerSchema(schema);
  second.registerSchema(schema);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(render(first));
  });
  try {
    await act(async () => editor.onChange("size", 7));
    await act(async () => tree.update(render(second)));
    assert.equal(save(tree).dirty, false);
    assert.equal(editor.values.size, 0);
    await act(async () => editor.onChange("size", 2));
    await act(async () => save(tree).onSave());
    assert.equal(second.getValue("size"), 2);
    assert.equal(first.getValue("size"), 0);
  } finally {
    await act(async () => tree.unmount());
    await first.dispose?.();
    await second.dispose?.();
  }
};
const externalChange = async () => {
  const registry = createPreferenceRegistry();
  registry.registerSchema(schema);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(render(registry));
  });
  try {
    await act(async () => editor.onChange("size", 7));
    await act(async () => registry.setValue("size", 2, { scope: "user" }));
    assert.equal(editor.values.size, 7);
    await act(async () => save(tree).onSave());
    assert.equal(registry.getValue("size"), 7);
  } finally {
    await act(async () => tree.unmount());
    await registry.dispose?.();
  }
};
const pendingLeave = async () => {
  const gate = Promise.withResolvers<void>();
  const core = createWorkbench({ preferencePersistence: { getValue: () => 0, setValue: () => gate.promise } });
  core.preferences.registerSchema(schema);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SettingsPageContext value={{ workbench: core, title: "Preferences" }}>
        {render(core.preferences)}
      </SettingsPageContext>,
    );
  });
  try {
    await act(async () => editor.onChange("size", 7));
    const guard = settingsLeaveGuard(core);
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = Promise.resolve(guard.getActions()!.save());
    });
    assert.equal(guard.getActions()?.saving, true);
    assert.equal(await guard.request(), false);
    await act(async () => {
      gate.resolve();
      await pending;
    });
    assert.equal(guard.getActions()?.dirty, false);
  } finally {
    gate.resolve();
    await act(async () => tree.unmount());
    await core.dispose();
  }
};

const pendingOwnerSwitch = async () => {
  const gate = Promise.withResolvers<void>();
  let accepted = 0;
  const first = createPreferenceRegistry({
    persistence: {
      getValue: () => accepted,
      async setValue(_name, value) {
        await gate.promise;
        accepted = Number(value);
      },
    },
  });
  const second = createPreferenceRegistry();
  first.registerSchema(schema);
  second.registerSchema(schema);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(render(first));
  });
  try {
    await act(async () => editor.onChange("size", 7));
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = Promise.resolve(save(tree).onSave());
    });
    await act(async () => tree.update(render(second)));
    await act(async () => editor.onChange("size", 3));
    await act(async () => {
      gate.resolve();
      await pending;
    });
    assert.equal(accepted, 7);
    assert.equal(second.getValue("size"), 0);
    assert.equal(editor.values.size, 3);
    assert.equal(save(tree).dirty, true);
  } finally {
    gate.resolve();
    await act(async () => tree.unmount());
    await first.dispose?.();
    await second.dispose?.();
  }
};
const buttonRetry = async (mode: "apply" | "live") => {
  let accepted = 0;
  let fail = true;
  const registry = createPreferenceRegistry({
    persistence: {
      getValue: () => accepted,
      async setValue(_name, value) {
        if (fail) throw new Error("disk full");
        accepted = Number(value);
      },
    },
  });
  registry.registerSchema(schema);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(render(registry, mode));
  });
  const clickSave = () =>
    tree.root
      .findAllByType("button")
      .find((node) => node.children.includes("Save"))!
      .props.onClick();
  try {
    await act(async () => editor.onChange("size", 7));
    if (mode === "apply")
      await act(async () => {
        clickSave();
        await Bun.sleep(0);
      });
    assert.equal(editor.values.size, 7);
    assert.equal(accepted, 0);
    assert.equal(tree.root.findAllByProps({ role: "alert" }).filter((node) => typeof node.type === "string").length, 1);
    fail = false;
    await act(async () => {
      clickSave();
      await Bun.sleep(0);
    });
    assert.equal(accepted, 7);
    assert.equal(tree.root.findAllByProps({ role: "alert" }).filter((node) => typeof node.type === "string").length, 0);
  } finally {
    await act(async () => tree.unmount());
    await registry.dispose?.();
  }
};

await failedSave();
await ownerSwitch();
await externalChange();
await pendingLeave();
await pendingOwnerSwitch();
await buttonRetry("apply");
await buttonRetry("live");
process.stdout.write("preference form scenarios passed\n");
