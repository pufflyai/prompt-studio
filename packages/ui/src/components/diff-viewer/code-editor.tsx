import { DiffEditor, Editor } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import type { MonacoThemeData } from "../../theme";
import { useThemePreference } from "../../utils/theme-preference";

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

export const customTheme = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#0a0d15",
    "editor.foreground": "#f5f5f5",
    "editor.lineHighlightBackground": "#22252C",
    "editorCursor.foreground": "#A7A7A7",
    "editorWhitespace.foreground": "#3B3B3B",
    "editorIndentGuide.background": "#404040",
    "editorIndentGuide.activeBackground": "#707070",
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

interface CodeEditorProps {
  language: string;
  defaultCode?: string;
  code?: string;
  isEditable: boolean;
  showLineNumbers?: boolean;
  onChange?: (code: string) => void;
  disableScroll?: boolean;
}

export const CodeEditor = (props: CodeEditorProps) => {
  const { defaultCode, code, showLineNumbers, isEditable, language = "javascript", onChange, disableScroll } = props;
  const editorTheme = useEditorTheme();
  const applyEditorTheme = useApplyEditorTheme(editorTheme);

  const options = {
    tabSize: 2,
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
    <Editor
      width="100%"
      height="100%"
      language={language}
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
      onMount={async (editor, monaco) => {
        applyEditorTheme(monaco);

        // Add JSX support
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          jsx: monaco.languages.typescript.JsxEmit.React,
        });

        // Format on cmd+s
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
          await editor.getAction("editor.action.formatDocument")?.run();
        });

        // Run format on the initial value
        await editor.getAction("editor.action.formatDocument")?.run();
      }}
    />
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
    <DiffEditor
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

        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          jsx: monaco.languages.typescript.JsxEmit.React,
        });
      }}
    />
  );
};
