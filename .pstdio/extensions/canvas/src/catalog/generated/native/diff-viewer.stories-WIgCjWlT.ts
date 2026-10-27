// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { i as r, n as i, r as a, t as o } from "./performance-panel-svo9U_q5.ts";
import { n as s } from "./lazy-diff-BWp6ftx2.ts";
import { Profiler as c, useEffect as l, useRef as u, useState as d } from "react";
import { Box as f } from "@chakra-ui/react";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
// packages/ui/src/components/diff-viewer/diff-viewer.stories.tsx
var h = [
	{
		change: "modified",
		oldPath: "packages/ui/src/components/button.tsx",
		newPath: "packages/ui/src/components/button.tsx",
		oldContent: "export const Button = () => null;\n",
		newContent: "export const Button = () => <button />;\n",
		additions: 1,
		deletions: 1
	},
	{
		change: "added",
		newPath: "packages/ui/src/components/diff-viewer.tsx",
		oldContent: "",
		newContent: "export const DiffViewer = () => null;\n",
		additions: 1,
		deletions: 0
	},
	{
		change: "deleted",
		oldPath: "packages/ui/src/components/legacy-diff-panel.tsx",
		oldContent: "export const LegacyDiffPanel = () => null;\n",
		newContent: "",
		additions: 0,
		deletions: 1
	},
	{
		change: "renamed",
		oldPath: "packages/ui/src/components/outline.tsx",
		newPath: "packages/ui/src/components/file-tree.tsx",
		oldContent: "export const Outline = () => null;\n",
		newContent: "export const FileTree = () => null;\n",
		additions: 1,
		deletions: 1
	}
], g = [
	{
		change: "modified",
		oldPath: "public/assets/logo.png",
		newPath: "public/assets/logo.png",
		oldContent: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lhm0LgAAAABJRU5ErkJggg==",
		newContent: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAFAgJ/pX6lZQAAAABJRU5ErkJggg==",
		additions: 0,
		deletions: 0
	},
	{
		change: "added",
		newPath: "public/assets/hero.jpg",
		oldContent: "",
		newContent: "",
		additions: 0,
		deletions: 0
	},
	{
		change: "deleted",
		oldPath: "public/fonts/inter.woff2",
		oldContent: "",
		newContent: "",
		additions: 0,
		deletions: 0
	},
	{
		change: "modified",
		oldPath: "docs/spec.pdf",
		newPath: "docs/spec.pdf",
		oldContent: "",
		newContent: "",
		additions: 0,
		deletions: 0
	}
], _ = [
	"modified",
	"added",
	"deleted",
	"renamed"
], v = [
	2,
	8,
	24,
	60,
	140,
	1200
], y = (e, t, n) => Array.from({ length: t }, (t, r) => `// file ${e} ${n} line ${r + 1}`).join("\n"), b = Array.from({ length: 200 }, (e, t) => {
	let n = v[t % v.length], r = _[t % _.length], i = `packages/app/src/features/feature-${t % 12}/file-${t}.ts`;
	return {
		change: r,
		oldPath: i,
		newPath: r === "renamed" ? `packages/app/src/features/feature-${t % 12}/renamed-${t}.ts` : i,
		oldContent: r === "added" ? "" : y(t, n, "original"),
		newContent: r === "deleted" ? "" : y(t, n, "updated"),
		additions: r === "deleted" ? 0 : n,
		deletions: r === "added" ? 0 : n
	};
}), x = (e) => {
	let { diffCount: t, samples: n, mountedAtMs: r, frameRate: a } = e, s = n.find((e) => e.phase === "mount") ?? null, c = n.filter((e) => e.phase !== "mount");
	return /* @__PURE__ */ p(o, {
		title: "Diff viewer performance",
		subtitle: "Stress test render metrics",
		badgeLabel: `${t} diffs`,
		metrics: [
			{
				label: "Ready after paint",
				value: i(r)
			},
			{
				label: "Mount render",
				value: i(s?.actualDuration ?? null)
			},
			{
				label: "Render updates",
				value: c.length.toString()
			}
		],
		framesPerSecond: a.framesPerSecond,
		averageFramesPerSecond: a.averageFramesPerSecond,
		frameRateSamples: a.frameRateSamples,
		rootProps: {
			position: "absolute",
			top: "sm",
			right: "sm",
			zIndex: "overlay"
		},
		testId: "diff-viewer-perf-panel"
	});
}, S = () => {
	let e = u(performance.now()), [t, n] = d(null), [i, o] = d([]), [h, g] = d(() => r());
	return l(() => {
		a();
		let t = requestAnimationFrame(() => n(performance.now() - e.current)), i = window.setInterval(() => g(r()), 250);
		return () => {
			cancelAnimationFrame(t), window.clearInterval(i);
		};
	}, []), /* @__PURE__ */ m(f, {
		h: "full",
		w: "full",
		minH: "0",
		position: "relative",
		display: "flex",
		children: [/* @__PURE__ */ p(x, {
			diffCount: b.length,
			samples: i,
			mountedAtMs: t,
			frameRate: h
		}), /* @__PURE__ */ p(f, {
			flex: "1",
			minH: "0",
			minW: "0",
			display: "flex",
			children: /* @__PURE__ */ p(c, {
				id: "diff-viewer-stress",
				onRender: (e, t, n, r, i, a) => {
					o((e) => [...e.slice(-9), {
						phase: t,
						actualDuration: n,
						commitTime: a
					}]);
				},
				children: /* @__PURE__ */ p(s, { diffs: b })
			})
		})]
	});
}, C = {
	title: "Patterns/Diff/Diff Viewer",
	component: s,
	parameters: { layout: "fullscreen" },
	decorators: [(e) => /* @__PURE__ */ p(f, {
		height: "100vh",
		width: "100vw",
		border: "1px solid",
		borderColor: "border.subtle",
		overflow: "hidden",
		children: /* @__PURE__ */ p(e, {})
	})],
	args: { diffs: h }
}, w = {}, T = { args: { diffs: [] } }, E = { args: {
	diffs: [],
	changedFilePaths: ["packages/ui/src/components/diff-viewer/diff-viewer.tsx", "packages/ui/src/components/diff-viewer/diff-card-load-state.tsx"],
	loading: !0
} }, D = { args: { diffs: g } }, O = {
	args: { diffs: [h[0]] },
	play: async ({ canvasElement: r }) => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: !0,
			value: { writeText: async () => void 0 }
		});
		let i = e(r);
		e(await i.findByTestId("diff-card-header")).getByRole("button", {
			name: "Collapse",
			exact: !0
		}).focus(), await t.tab(), await t.keyboard("{Enter}"), await n(i.getByLabelText("Copied")).toBeVisible();
	}
}, k = { render: () => /* @__PURE__ */ p(S, {}) };
export { D as BinaryAndImage, O as CopiedFilePath, w as Default, T as Empty, E as Loading, k as StressTest, C as default };
