/// <reference types="vite/client" />

// Entry of the one-time Monaco build (`build:monaco`). Apps load its output from
// `@pstdio/ui/monaco/*` instead of bundling Monaco and its workers again on every build.
import * as monaco from "monaco-editor";
import editorWorkerUrl from "monaco-editor/esm/vs/editor/editor.worker?worker&url";
import cssWorkerUrl from "monaco-editor/esm/vs/language/css/css.worker?worker&url";
import htmlWorkerUrl from "monaco-editor/esm/vs/language/html/html.worker?worker&url";
import jsonWorkerUrl from "monaco-editor/esm/vs/language/json/json.worker?worker&url";
import tsWorkerUrl from "monaco-editor/esm/vs/language/typescript/ts.worker?worker&url";

const workerUrlFor = (label: string) => {
  if (label === "json") return jsonWorkerUrl;
  if (["css", "scss", "less"].includes(label)) return cssWorkerUrl;
  if (["html", "handlebars", "razor"].includes(label)) return htmlWorkerUrl;
  if (["typescript", "javascript"].includes(label)) return tsWorkerUrl;
  return editorWorkerUrl;
};

// Monaco creates the workers from these URLs. A literal `new Worker(new URL(...))` in this bundle
// would make every consuming app bundle the prebuilt workers again instead of copying them.
self.MonacoEnvironment = { getWorkerUrl: (_, label) => workerUrlFor(label) };

export { monaco };
