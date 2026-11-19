import { afterEach, expect, test } from "bun:test";
import { DiffEditor, Editor, loader } from "@monaco-editor/react";
import { Activity } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

// Monaco throws when a disposed editor is used, as the real one does from its instantiation service.
const createFakeMonaco = () => {
  const created: { kind: string; disposed: boolean }[] = [];
  const models = new Map<string, { uri: string; value: string; dispose: () => void }>();
  const guard = (state: { disposed: boolean }) => {
    if (state.disposed) throw new Error("InstantiationService has been disposed");
  };
  const createModel = (value: string, _language?: string, uri?: string) => {
    const key = uri ?? `inmemory://model/${models.size}`;
    const model = { uri: key, value, dispose: () => models.delete(key) };
    models.set(key, model);
    return model;
  };
  const codeEditor = (model: unknown) => {
    const state = { kind: "editor", disposed: false };
    created.push(state);
    let current = model;
    return {
      getModel: () => (state.disposed ? null : current),
      setModel: (next: unknown) => {
        guard(state);
        current = next;
      },
      dispose: () => {
        state.disposed = true;
      },
      saveViewState: () => null,
      restoreViewState: () => guard(state),
      updateOptions: () => guard(state),
      revealLine: () => guard(state),
      getOption: () => false,
      getValue: () => "",
      setValue: () => guard(state),
      onDidChangeModelContent: () => ({ dispose() {} }),
    };
  };
  const monaco = {
    Uri: { parse: (value: string) => value },
    editor: {
      EditorOption: { readOnly: 0 },
      getModel: (uri: string) => models.get(uri) ?? null,
      createModel,
      setTheme: () => {},
      setModelLanguage: () => {},
      onDidChangeMarkers: () => ({ dispose() {} }),
      create: (_container: unknown, options: { model: unknown }) => codeEditor(options.model),
      createDiffEditor: () => {
        const state = { kind: "diff", disposed: false };
        created.push(state);
        let current: unknown = null;
        const side = () => ({ ...codeEditor(null), setModel: () => guard(state) });
        return {
          getModel: () => (state.disposed ? null : current),
          setModel: (next: unknown) => {
            guard(state);
            current = next;
          },
          getOriginalEditor: side,
          getModifiedEditor: side,
          updateOptions: () => guard(state),
          dispose: () => {
            state.disposed = true;
          },
        };
      },
    },
  };
  return { monaco, created };
};

let renderer: ReactTestRenderer | undefined;
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  environment.IS_REACT_ACT_ENVIRONMENT = undefined;
});

test("code and diff editors are recreated after Activity hides and reveals them", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const { monaco, created } = createFakeMonaco();
  loader.config({ monaco: monaco as never });
  const view = (visible: boolean, path: string) => (
    <Activity mode={visible ? "visible" : "hidden"}>
      <Editor path={path} defaultValue="const greeting = 'Hello';" language="typescript" />
      <DiffEditor original="a" modified="b" language="typescript" />
    </Activity>
  );
  const options = { createNodeMock: () => ({}) };
  await act(async () => {
    renderer = create(view(true, "inmemory://editor/one.ts"), options);
  });
  expect(created.map((editor) => editor.kind).sort()).toEqual(["diff", "editor"]);

  await act(async () => renderer!.update(view(false, "inmemory://editor/one.ts")));
  expect(created.every((editor) => editor.disposed)).toBe(true);

  // Revealing re-runs the editors' effects; a disposed editor must not receive the new model.
  await act(async () => renderer!.update(view(true, "inmemory://editor/two.ts")));
  expect(
    created
      .filter((editor) => !editor.disposed)
      .map((editor) => editor.kind)
      .sort(),
  ).toEqual(["diff", "editor"]);
});
