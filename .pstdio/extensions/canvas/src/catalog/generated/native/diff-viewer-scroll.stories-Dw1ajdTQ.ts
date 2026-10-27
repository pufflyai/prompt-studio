// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./lazy-diff-BWp6ftx2.ts";
import { Box as t } from "@chakra-ui/react";
import { jsx as n } from "react/jsx-runtime";
// packages/ui/src/components/diff-viewer/diff-viewer-scroll.stories.tsx
var r = (e, t) => {
	let n = `packages/app/src/feature-${e % 8}/module-${e}.ts`, r = (n) => Array.from({ length: t }, (t, r) => `export const value_${e}_${r} = "${n}-${r}";`).join("\n");
	return {
		change: "modified",
		oldPath: n,
		newPath: n,
		oldContent: r("original"),
		newContent: r("updated"),
		additions: Math.ceil(t / 3),
		deletions: Math.ceil(t / 3)
	};
}, i = [...Array.from({ length: 12 }, (e, t) => r(t, 60 + t % 4 * 12)), ...Array.from({ length: 60 }, (e, t) => r(t + 12, 4 + t % 5))], a = i.map((e) => e.newPath ?? e.oldPath ?? "unknown"), o = {
	title: "Patterns/Diff/Diff Viewer Scroll",
	component: e,
	parameters: { layout: "fullscreen" },
	render: () => /* @__PURE__ */ n(t, {
		h: "100vh",
		w: "100vw",
		minH: "0",
		display: "flex",
		overflow: "hidden",
		children: /* @__PURE__ */ n(t, {
			flex: "1",
			minH: "0",
			minW: "0",
			display: "flex",
			children: /* @__PURE__ */ n(e, {
				diffs: i,
				changedFilePaths: a,
				defaultSelectedPath: a[0]
			})
		})
	})
}, s = {};
export { s as MidListNavigation, o as default };
