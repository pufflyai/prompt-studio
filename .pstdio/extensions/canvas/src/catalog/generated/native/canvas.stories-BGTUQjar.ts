// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, h as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { t as a } from "./canvas-BXvXw29d.ts";
import { n as o, r as s, t as c } from "./canvas.examples-CmEVODJP.ts";
import { jsx as l } from "react/jsx-runtime";
// packages/ui/src/components/canvas/canvas.stories.tsx
var u = {
	title: "Components/Layout/Canvas",
	component: a,
	args: {
		onPan: e().mockName("Pan"),
		onZoom: e().mockName("Zoom"),
		onFit: e().mockName("Fit all"),
		onReset: e().mockName("Reset camera"),
		onNavigationEnd: e().mockName("Navigation ended")
	},
	argTypes: {
		minZoom: { control: {
			type: "number",
			min: .01,
			step: .1
		} },
		maxZoom: { control: {
			type: "number",
			min: .01,
			step: .1
		} }
	},
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "A dotted viewport with fixed timeline-style zoom controls, pan, anchored zoom, keyboard, and touch. Callers own their camera and pass the controlled zoom. minZoom/maxZoom apply to every zoom input (defaults 0.25 and 1). Mark live content or drag targets with data-canvas-control. Focus the canvas and press F to fit or 0 to reset the example camera; callbacks appear in Storybook Actions." } }
	}
}, d = {
	args: {
		minZoom: .1,
		maxZoom: 4
	},
	render: (e) => /* @__PURE__ */ l(o, { ...e }),
	play: async ({ canvasElement: e }) => {
		let n = t(e), a = n.getByRole("textbox", { name: "Preview draft" });
		await r.type(a, "Keep this draft"), await r.click(n.getByRole("button", { name: "Count 0" })), await r.click(n.getByRole("button", {
			name: "Zoom in",
			exact: !0
		})), await i(a).toHaveValue("Keep this draft"), await i(n.getByRole("button", { name: "Count 1" })).toBeVisible();
	}
}, f = {
	args: {
		minZoom: .5,
		maxZoom: 1.2
	},
	render: (e) => /* @__PURE__ */ l(o, { ...e }),
	play: async ({ canvasElement: e }) => {
		let n = t(e), a = n.getByRole("button", {
			name: "Zoom out",
			exact: !0
		}), o = n.getByRole("button", {
			name: "Zoom in",
			exact: !0
		});
		for (let e = 0; e < 8; e++) await r.click(a);
		await i(a).toBeDisabled(), await r.click(n.getByRole("button", { name: /Reset zoom to/ }));
		for (let e = 0; e < 4; e++) await r.click(o);
		await i(o).toBeDisabled();
	}
}, p = {
	args: { onScroll: e() },
	render: (e) => /* @__PURE__ */ l(s, { onScroll: e.onScroll }),
	play: async ({ canvasElement: e, args: a }) => {
		let o = t(e), s = o.getByRole("region", { name: "Timeline canvas" });
		s.focus(), await r.keyboard("{ArrowDown}"), await i(s.scrollTop).toBeGreaterThan(0), await n(() => i(a.onScroll).toHaveBeenCalled()), await r.click(o.getByRole("button", {
			name: "Ticket 1",
			exact: !0
		})), await i(o.getByRole("button", {
			name: "Ticket 1",
			exact: !0
		})).toHaveAttribute("aria-pressed", "true");
	}
}, m = {
	render: (e) => /* @__PURE__ */ l(o, { ...e }),
	play: async ({ canvasElement: e, args: a }) => {
		let o = t(e), s = e.querySelector("[data-example-stage]");
		o.getByRole("region", { name: "Live designs canvas" }).focus();
		let c = s.style.transform;
		await r.keyboard("{ArrowRight}"), await n(() => i(s.style.transform).not.toBe(c)), await r.keyboard("f"), await i(a.onFit).toHaveBeenCalled(), await r.keyboard("0"), await i(a.onReset).toHaveBeenCalled();
	}
}, h = {
	render: () => /* @__PURE__ */ l(c, {}),
	play: async ({ canvasElement: e }) => {
		let n = t(e);
		await r.type(n.getByRole("textbox", { name: "Flow draft" }), "Editable content"), await r.click(n.getByRole("button", { name: "Click me" })), await i(n.getByRole("button", { name: "Clicked" })).toBeVisible();
	}
};
export { f as CustomZoomLimits, h as FlowContent, m as KeyboardNavigation, d as LivePreviews, p as Timeline, u as default };
