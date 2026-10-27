// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./lazy-diff-BWp6ftx2.ts";
import { Box as t } from "@chakra-ui/react";
import { jsx as n } from "react/jsx-runtime";
// packages/ui/src/components/diff-viewer/diff-drawer-loading.stories.tsx
var r = () => new Promise(() => void 0), i = [{
	change: "modified",
	oldPath: "src/lazy-file.ts",
	newPath: "src/lazy-file.ts",
	additions: 4,
	deletions: 2
}], a = {
	title: "Patterns/Diff/Diff Panel/Loading",
	component: e,
	parameters: { layout: "fullscreen" },
	decorators: [(e) => /* @__PURE__ */ n(t, {
		height: "100vh",
		width: "100vw",
		border: "1px solid",
		borderColor: "border.subtle",
		overflow: "hidden",
		children: /* @__PURE__ */ n(e, {})
	})]
}, o = {
	render: (t) => /* @__PURE__ */ n(e, { ...t }),
	args: {
		diffs: i,
		onLoadDiff: r
	}
};
export { o as DeferredContent, a as default };
