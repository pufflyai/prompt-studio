// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./code-editor.stories-D801ZFIi.ts";
import "@pstdio/ui/monaco/monaco.css";
// packages/ui/src/components/diff-viewer/monaco-browser.ts
var t = async () => {
	let { monaco: t } = await import("@pstdio/ui/monaco/monaco.js");
	t.typescript.typescriptDefaults.setCompilerOptions({
		...t.typescript.typescriptDefaults.getCompilerOptions(),
		jsx: t.typescript.JsxEmit.React
	}), e.config({ monaco: t }), await e.init();
};
export { t as initializeMonaco };
