// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-N58OeDyx.ts";
import { t as a } from "./workbench-BYYWgWSr.ts";
import { t as o } from "./workbench-theme-provider-CQSyY8qK.ts";
import { n as s, t as c } from "./workbench-panel-toggles-BmSTzznX.ts";
import { t as l } from "./panel-policy.fixture-D8ijqHtt.ts";
import { Box as u, Text as d } from "@chakra-ui/react";
import { WindowTitleBar as f } from "@pstdio/ui";
import { Fragment as p, jsx as m, jsxs as h } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/workbench/workbench-title-bar.stories.tsx
var g = {
	title: "pstdio-workbench/Reference/Core API/Title bar",
	component: a,
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "The host can place title-bar content above every workbench region. The slot shares the active workbench theme and remains visible across modes." } }
	},
	decorators: [(e) => /* @__PURE__ */ m(o, { children: /* @__PURE__ */ m(u, {
		height: "100vh",
		children: /* @__PURE__ */ m(e, {})
	}) })]
}, _ = { args: {
	workbench: i(),
	titleBar: /* @__PURE__ */ m(f, {
		platform: "darwin",
		children: /* @__PURE__ */ m(d, {
			textStyle: "label/S/medium",
			children: "Prompt Studio"
		})
	})
} }, v = {
	args: (() => {
		let e = l();
		return {
			workbench: e,
			panelControlsPlacement: "host",
			titleBar: /* @__PURE__ */ m(f, {
				platform: "darwin",
				actions: /* @__PURE__ */ h(p, { children: [/* @__PURE__ */ m(c, { workbench: e }), /* @__PURE__ */ m(s, { workbench: e })] }),
				children: /* @__PURE__ */ m(d, {
					textStyle: "label/S/medium",
					children: "Project tabs"
				})
			})
		};
	})(),
	play: async ({ canvasElement: i }) => {
		let a = n(i), o = i.querySelector("[data-window-title-bar]"), s = n(o), c = a.getByRole("button", { name: "Enter Main fullscreen" });
		await r(s.getByRole("button", { name: "Enter Main fullscreen" })).toBe(c);
		let l = s.getByRole("group", { name: "Panel controls" });
		await r(l.getBoundingClientRect().right).toBeLessThanOrEqual(c.getBoundingClientRect().left), await r(o.getBoundingClientRect().right - c.getBoundingClientRect().right).toBeLessThanOrEqual(10), await e.click(a.getByRole("button", { name: "Hide Side Panel" })), await r(a.getByRole("button", { name: "Show Side Panel" })).toBeVisible(), await e.click(c), await r(o).not.toBeVisible(), await e.click(a.getByRole("button", { name: "Exit Main fullscreen" })), await r(o).toBeVisible(), await t(() => r(c).toHaveFocus()), await e.click(c), await e.keyboard("{Escape}"), await t(() => r(c).toHaveFocus());
	}
};
export { v as HostPanelControls, _ as HostTitle, g as default };
