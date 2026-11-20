import { afterEach, expect, mock, test } from "bun:test";
import { DiffEditor, Editor, loader } from "@monaco-editor/react";
import { Activity } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ThemePreferenceProvider } from "../../utils/theme-preference";

// CodeEditor normally loads the real Monaco bundle; the fake below stands in for it.
mock.module("./monaco-browser", () => ({ initializeMonaco: async () => {} }));
const { CodeEditor } = await import("./code-editor");

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

type FakeModel = { uri: string; value: string; disposed: boolean };
type FakeEditor = { kind: string; disposed: boolean; model: FakeModel | null; selections: unknown[] };

// Monaco throws when a disposed editor is used, as the real one does from its instantiation service.
const createFakeMonaco = () => {
  const created: FakeEditor[] = [];
  const models = new Map<string, FakeModel>();
  const guard = (state: { disposed: boolean }) => {
    if (state.disposed) throw new Error("InstantiationService has been disposed");
  };
  const createModel = (value: string, _language?: string, uri?: string) => {
    const model: FakeModel = { uri: uri ?? `inmemory://model/${models.size}`, value, disposed: false };
    models.set(model.uri, model);
    return Object.assign(model, {
      dispose: () => {
        model.disposed = true;
        models.delete(model.uri);
      },
      getLineCount: () => model.value.split("\n").length,
      getLineMaxColumn: (line: number) => (model.value.split("\n")[line - 1]?.length ?? 0) + 1,
      getFullModelRange: () => ({}),
    });
  };
  const codeEditor = (model: FakeModel | null, kind = "editor") => {
    const state: FakeEditor = { kind, disposed: false, model, selections: [] };
    created.push(state);
    return {
      getModel: () => (state.disposed ? null : state.model),
      setModel: (next: FakeModel) => {
        guard(state);
        state.model = next;
      },
      dispose: () => {
        state.disposed = true;
      },
      saveViewState: () => ({ selections: [...state.selections] }),
      restoreViewState: (view?: { selections: unknown[] }) => {
        guard(state);
        if (view) state.selections = [...view.selections];
      },
      setSelection: (selection: unknown) => {
        guard(state);
        state.selections.push(selection);
      },
      revealRangeInCenter: () => guard(state),
      updateOptions: () => guard(state),
      revealLine: () => guard(state),
      addCommand: () => guard(state),
      getAction: () => null,
      getOption: () => false,
      getValue: () => state.model?.value ?? "",
      setValue: () => guard(state),
      onDidChangeModelContent: () => ({ dispose() {} }),
    };
  };
  const monaco = {
    Uri: { parse: (value: string) => value },
    KeyMod: { CtrlCmd: 1 },
    KeyCode: { KeyS: 2 },
    editor: {
      EditorOption: { readOnly: 0 },
      getModel: (uri: string) => models.get(uri) ?? null,
      createModel,
      defineTheme: () => {},
      setTheme: () => {},
      setModelLanguage: () => {},
      onDidChangeMarkers: () => ({ dispose() {} }),
      create: (_container: unknown, options: { model: FakeModel }) => codeEditor(options.model),
      createDiffEditor: () => {
        const state: FakeEditor = { kind: "diff", disposed: false, model: null, selections: [] };
        created.push(state);
        const side = () => ({ ...codeEditor(null, "side"), setModel: () => guard(state) });
        return {
          getModel: () => (state.disposed ? null : state.model),
          setModel: (next: FakeModel) => {
            guard(state);
            state.model = next;
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
  return { monaco, created, models };
};

// The loader initializes once per process, so every test shares one fake and resets its records.
const { monaco, created, models } = createFakeMonaco();
loader.config({ monaco: monaco as never });
const options = { createNodeMock: () => ({}) };
let renderer: ReactTestRenderer | undefined;
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  created.length = 0;
  models.clear();
  environment.IS_REACT_ACT_ENVIRONMENT = undefined;
});

test("code and diff editors are recreated after Activity hides and reveals them", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const view = (visible: boolean, path: string) => (
    <Activity mode={visible ? "visible" : "hidden"}>
      <Editor path={path} defaultValue="const greeting = 'Hello';" language="typescript" />
      <DiffEditor original="a" modified="b" language="typescript" />
    </Activity>
  );
  await act(async () => {
    renderer = create(view(true, "inmemory://editor/one.ts"), options);
  });
  expect(created.map((editor) => editor.kind).sort()).toEqual(["diff", "editor"]);

  await act(async () => renderer!.update(view(false, "inmemory://editor/one.ts")));
  expect(created.every((editor) => editor.disposed)).toBe(true);

  // Revealing re-runs the editors' effects; a disposed editor must not receive the new model.
  await act(async () => renderer!.update(view(true, "inmemory://editor/two.ts")));
  const editors = created.filter((editor) => editor.kind !== "side");
  expect(editors.map((editor) => editor.kind)).toEqual(["editor", "diff", "editor", "diff"]);
  const live = editors.filter((editor) => !editor.disposed);
  expect(live.map((editor) => editor.kind).sort()).toEqual(["diff", "editor"]);
  expect(live.find((editor) => editor.kind === "editor")?.model?.uri).toBe("inmemory://editor/two.ts");
});

test("a hidden code editor keeps its draft, model and cursor when revealed", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const position = { line: 2, column: 3 };
  const view = (visible: boolean) => (
    <ThemePreferenceProvider initialPreference="pstdio-light">
      <Activity mode={visible ? "visible" : "hidden"}>
        <CodeEditor
          language="typescript"
          fileName="draft.ts"
          defaultCode={"const a = 1;\nconst b = 2;\n"}
          isEditable
          position={position}
        />
      </Activity>
    </ThemePreferenceProvider>
  );
  await act(async () => {
    renderer = create(view(true), options);
  });
  // CodeEditor resolves its lazy Monaco component before the first editor exists.
  for (let turn = 0; turn < 20 && !created.length; turn += 1)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  const [first] = created;
  expect(first?.selections).toHaveLength(1);
  const model = first!.model!;
  model.value = "const a = 1;\nconst b = 'unsaved draft';\n";

  await act(async () => renderer!.update(view(false)));
  expect(first?.disposed).toBe(true);
  expect(model.disposed).toBe(false);

  await act(async () => renderer!.update(view(true)));
  const revealed = created.filter((editor) => !editor.disposed);
  expect(revealed).toHaveLength(1);
  // The same model returns with the unsaved draft, and the original link position is not reapplied.
  expect(revealed[0]?.model).toBe(model);
  expect(models.get(model.uri)?.value).toBe("const a = 1;\nconst b = 'unsaved draft';\n");
  expect(revealed[0]?.selections).toEqual(first?.selections);
});
