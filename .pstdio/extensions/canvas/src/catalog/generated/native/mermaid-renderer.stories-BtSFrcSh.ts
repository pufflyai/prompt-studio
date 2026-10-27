// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, i as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./mermaid-renderer-DxExU8WG.ts";
import { n as a } from "./theme-preference-Blf4BFb2.ts";
import { t as o } from "./mermaid-fixtures-D9h-mVW_.ts";
import { useState as s } from "react";
import { Box as c, Button as l, Stack as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/ui/src/components/mermaid-renderer/mermaid-renderer.stories.tsx
var p = {
	title: "Patterns/Editors/Mermaid Renderer",
	component: i,
	parameters: { layout: "padded" },
	decorators: [(e) => /* @__PURE__ */ d(c, {
		maxW: "920px",
		children: /* @__PURE__ */ d(e, {})
	})],
	args: {
		code: o.ps81Flowchart,
		isEditable: !0,
		onRequestEdit: () => void 0
	}
}, m = () => {
	let [e, t] = s(o.ps81Flowchart);
	return /* @__PURE__ */ f(u, {
		gap: "sm",
		children: [/* @__PURE__ */ d(l, {
			size: "sm",
			alignSelf: "flex-start",
			onClick: () => t(o.sequence),
			children: "Change diagram source"
		}), /* @__PURE__ */ d(i, {
			code: e,
			isEditable: !0,
			onRequestEdit: () => void 0
		})]
	});
}, h = () => {
	let { themePreference: e, toggleThemePreference: t } = a();
	return /* @__PURE__ */ f(u, {
		gap: "sm",
		children: [/* @__PURE__ */ d(l, {
			size: "sm",
			alignSelf: "flex-start",
			onClick: t,
			children: "Toggle theme"
		}), /* @__PURE__ */ d(c, {
			"data-testid": "mermaid-theme-preference",
			"data-theme-preference": e,
			children: /* @__PURE__ */ d(i, {
				code: o.ps81Flowchart,
				isEditable: !0,
				onRequestEdit: () => void 0
			})
		})]
	});
}, g = {}, _ = { args: {
	isEditable: !1,
	onRequestEdit: void 0
} }, v = { args: { code: o.sequence } }, y = { args: { code: o.state } }, b = { args: { code: o.er } }, x = { args: { code: o.class } }, S = { args: { code: o.gantt } }, C = { globals: { theme: "pstdio-dark" } }, w = { args: { code: o.invalid } }, T = {
	tags: ["!manifest"],
	args: { initialFullscreenOpen: !0 }
}, E = {
	tags: ["!manifest"],
	args: { initialZoom: 1.5 }
}, D = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ d(m, {})
}, O = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ d(h, {})
}, k = {
	tags: ["!manifest"],
	play: async ({ canvasElement: t }) => {
		let i = e(t);
		await i.findByRole("img", { name: "Mermaid diagram" }), await n.click(i.getByRole("button", { name: "Zoom in" })), await r(i.getByTestId("mermaid-diagram-transform")).toHaveAttribute("data-pan-enabled", "true");
	}
}, A = {
	tags: ["!manifest"],
	play: async ({ canvasElement: t }) => {
		let i = e(t);
		await i.findByRole("img", { name: "Mermaid diagram" }), await n.click(i.getByRole("button", { name: "Open diagram" })), await r(e(document.body).getByRole("dialog", { name: "Mermaid diagram" })).toBeVisible();
	}
}, j = {
	tags: ["!manifest"],
	play: async ({ canvasElement: n }) => {
		let i = e(n);
		await i.findByRole("img", { name: "Mermaid diagram" });
		let a = i.getByTestId("mermaid-diagram-transform"), o = getComputedStyle(a).transform;
		t.pointerDown(a, {
			pointerId: 1,
			clientX: 10,
			clientY: 10
		}), t.pointerMove(a, {
			pointerId: 1,
			clientX: 80,
			clientY: 40
		}), t.pointerUp(a, { pointerId: 1 }), await r(a).toHaveAttribute("data-pan-enabled", "false"), r(getComputedStyle(a).transform).toBe(o);
	}
};
export { x as ClassDiagram, C as DarkMode, g as Default, b as EntityRelationshipDiagram, T as FullscreenOpen, A as FullscreenPlay, S as GanttChart, w as InvalidSyntax, j as PanGatePlay, _ as ReadOnly, v as SequenceDiagram, D as SourceChangeReset, y as StateDiagram, O as ThemeToggle, k as ZoomControlPlay, E as ZoomedInPan, p as default };
