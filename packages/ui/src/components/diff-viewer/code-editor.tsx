import { DiffEditor, Editor } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { lazy, Suspense, useEffect, useId, useRef } from "react";
import type { MonacoThemeData } from "../../theme";
import psTheme from "../../theme/theme";
import { useThemePreference } from "../../utils/theme-preference";
import { type CodeSourcePosition, sourcePositionSelection } from "./source-position";

export const createCodeEditorPreloader = (initialize: () => Promise<unknown>) => {
  let initialization: Promise<unknown> | undefined;

  return () => {
    initialization ??= initialize();
    return initialization;
  };
};

export const preloadCodeEditor = createCodeEditorPreloader(() =>
  import("./monaco-browser").then((module) => module.initializeMonaco()),
);

const MonacoEditor = lazy(async () => {
  await preloadCodeEditor();
  return { default: Editor };
});

const MonacoDiffEditor = lazy(async () => {
  await preloadCodeEditor();
  return { default: DiffEditor };
});

export const customTheme = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [],
  // Monaco parses color strings itself, so resolve raw token values instead of CSS variables.
  colors: {
    "editor.background": psTheme.token("colors.codeEditor.background"),
    "editor.foreground": psTheme.token("colors.codeEditor.foreground"),
    "editor.lineHighlightBackground": psTheme.token("colors.codeEditor.lineHighlightBackground"),
    "editorCursor.foreground": psTheme.token("colors.codeEditor.cursor"),
    "editorWhitespace.foreground": psTheme.token("colors.codeEditor.whitespace"),
    "editorIndentGuide.background": psTheme.token("colors.codeEditor.indentGuide"),
    "editorIndentGuide.activeBackground": psTheme.token("colors.codeEditor.indentGuideActive"),
  },
} satisfies MonacoThemeData;

const isMonacoTheme = (value: unknown): value is MonacoThemeData =>
  typeof value === "object" && value !== null && "base" in value && "colors" in value;

type MonacoApi = {
  editor: {
    defineTheme: (name: string, data: MonacoThemeData) => void;
    setTheme: (name: string) => void;
  };
};

const EDITOR_THEME_NAME = "ps-theme";

const useEditorTheme = () => {
  const { themePreference, themePreferences } = useThemePreference();
  const preference = themePreferences.find((theme) => theme.id === themePreference);
  return isMonacoTheme(preference?.monacoTheme) ? preference.monacoTheme : customTheme;
};

const useApplyEditorTheme = (editorTheme: MonacoThemeData) => {
  const monacoRef = useRef<MonacoApi | null>(null);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;

    monaco.editor.defineTheme(EDITOR_THEME_NAME, editorTheme);
    monaco.editor.setTheme(EDITOR_THEME_NAME);
  }, [editorTheme]);

  return (monaco: MonacoApi) => {
    monacoRef.current = monaco;
    monaco.editor.defineTheme(EDITOR_THEME_NAME, editorTheme);
    monaco.editor.setTheme(EDITOR_THEME_NAME);
  };
};

export const configureCodeEditor = (
  editor: {
    addCommand: (key: number, handler: () => Promise<void>) => unknown;
    getAction: (id: string) => Pick<Monaco.editor.IEditorAction, "run"> | null;
  },
  monaco: { KeyMod: Pick<typeof Monaco.KeyMod, "CtrlCmd">; KeyCode: Pick<typeof Monaco.KeyCode, "KeyS"> },
) => {
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
    await editor.getAction("editor.action.formatDocument")?.run();
  });
};

const reveal = (editor: Monaco.editor.IStandaloneCodeEditor, target?: CodeSourcePosition) => {
  const model = editor.getModel();
  if (!model || !target) return;
  const selection = sourcePositionSelection(target, model);
  editor.setSelection(selection);
  editor.revealRangeInCenter(selection);
};

interface CodeEditorProps {
  language: string;
  /** File name, including its extension, used to parse the editor model. */
  fileName?: string;
  defaultCode?: string;
  code?: string;
  isEditable: boolean;
  showLineNumbers?: boolean;
  onChange?: (code: string) => void;
  disableScroll?: boolean;
  position?: CodeSourcePosition;
}

export const CodeEditor = (props: CodeEditorProps) => {
  const {
    defaultCode,
    code,
    showLineNumbers,
    isEditable,
    language = "javascript",
    fileName,
    onChange,
    disableScroll,
    position,
  } = props;
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const positionRef = useRef(position);
  positionRef.current = position;
  useEffect(() => {
    if (editorRef.current) reveal(editorRef.current, position);
  }, [position]);
  const editorId = useId();
  // Preserve the extension for JSX parsing while keeping each editor's model independent.
  const modelPath = fileName
    ? `inmemory://editor/${encodeURIComponent(editorId)}/${encodeURIComponent(fileName)}`
    : undefined;
  const editorTheme = useEditorTheme();
  const applyEditorTheme = useApplyEditorTheme(editorTheme);

  const options = {
    tabSize: 2,
    fixedOverflowWidgets: true,
    minimap: {
      enabled: false,
    },
    fontSize: 12,
    readOnly: !isEditable,
    lineNumbers: showLineNumbers ? "on" : "off",
    ...(disableScroll
      ? {
          scrollbar: {
            vertical: "hidden" as const,
            horizontal: "hidden" as const,
            useShadows: false,
            alwaysConsumeMouseWheel: false,
          },
          scrollBeyondLastLine: false,
          mouseWheelScrollSensitivity: 0,
          overviewRulerLanes: 0,
        }
      : {}),
  } as const;

  return (
    <Suspense fallback={null}>
      <MonacoEditor
        width="100%"
        height="100%"
        language={language}
        path={modelPath}
        defaultValue={defaultCode}
        value={code}
        theme={EDITOR_THEME_NAME}
        options={options}
        onChange={(value) => {
          onChange?.(value || "");
        }}
        beforeMount={(monaco) => {
          applyEditorTheme(monaco);
        }}
        onMount={(editor, monaco) => {
          applyEditorTheme(monaco);
          configureCodeEditor(editor, monaco);
          editorRef.current = editor;
          reveal(editor, positionRef.current);
        }}
      />
    </Suspense>
  );
};

interface CodeDiffEditorProps {
  language: string;
  original: string;
  modified: string;
  showLineNumbers?: boolean;
  disableScroll?: boolean;
}

export const CodeDiffEditor = (props: CodeDiffEditorProps) => {
  const { original, modified, showLineNumbers, language = "javascript", disableScroll } = props;
  const editorTheme = useEditorTheme();
  const applyEditorTheme = useApplyEditorTheme(editorTheme);

  const options = {
    tabSize: 2,
    minimap: {
      enabled: false,
    },
    fontSize: 12,
    readOnly: true,
    originalEditable: false,
    renderSideBySide: true,
    useInlineViewWhenSpaceIsTooSmall: true,
    lineNumbers: showLineNumbers ? "on" : "off",
    ...(disableScroll
      ? {
          scrollbar: {
            vertical: "hidden" as const,
            horizontal: "hidden" as const,
            useShadows: false,
            alwaysConsumeMouseWheel: false,
          },
          scrollBeyondLastLine: false,
          mouseWheelScrollSensitivity: 0,
          overviewRulerLanes: 0,
        }
      : {}),
  } as const;

  return (
    <Suspense fallback={null}>
      <MonacoDiffEditor
        width="100%"
        height="100%"
        language={language}
        original={original}
        modified={modified}
        theme={EDITOR_THEME_NAME}
        options={options}
        beforeMount={(monaco) => {
          applyEditorTheme(monaco);
        }}
        onMount={(_, monaco) => {
          applyEditorTheme(monaco);
        }}
      />
    </Suspense>
  );
};
