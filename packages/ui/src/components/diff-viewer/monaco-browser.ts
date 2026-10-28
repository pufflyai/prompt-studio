/// <reference types="vite/client" />

import { loader } from "@monaco-editor/react";
import { monaco } from "@pstdio/ui/monaco/monaco.js";
import "@pstdio/ui/monaco/monaco.css";

export const initializeMonaco = async () => {
  monaco.typescript.typescriptDefaults.setCompilerOptions({
    ...monaco.typescript.typescriptDefaults.getCompilerOptions(),
    jsx: monaco.typescript.JsxEmit.React,
  });

  loader.config({ monaco });
  await loader.init();
};
