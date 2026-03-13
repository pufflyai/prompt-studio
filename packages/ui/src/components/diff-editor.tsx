import { DiffEditor as MonacoDiffEditor } from "@monaco-editor/react";
import { customTheme } from "./code-editor";

interface DiffEditorProps {
  original: string;
  modified: string;
  language?: string;
  sideBySide?: boolean;
  disableScroll?: boolean;
}

export function DiffEditor(props: DiffEditorProps) {
  const { original, modified, language = "plaintext", sideBySide = false, disableScroll = true } = props;

  const options = {
    renderSideBySide: sideBySide,
    readOnly: true,
    fontSize: 11,
    minimap: { enabled: false },
    wordWrap: "on" as const,
    scrollBeyondLastLine: false,
    ...(disableScroll
      ? {
          scrollbar: {
            vertical: "hidden" as const,
            horizontal: "hidden" as const,
            useShadows: false,
            alwaysConsumeMouseWheel: false,
          },
          overviewRulerLanes: 0,
        }
      : {}),
  } as const;

  return (
    <MonacoDiffEditor
      width="100%"
      height="100%"
      original={original}
      modified={modified}
      language={language}
      theme="ps-theme"
      options={options}
      beforeMount={(monaco) => {
        monaco.editor.defineTheme("ps-theme", customTheme);
      }}
      onMount={(_editor, monaco) => {
        monaco.editor.setTheme("ps-theme");
      }}
    />
  );
}
