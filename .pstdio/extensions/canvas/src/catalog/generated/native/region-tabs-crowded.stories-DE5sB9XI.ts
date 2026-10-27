// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-kaLFKJEn.ts";
import { t as a } from "./workbench-story-BezxAS71.ts";
import { Box as o, Text as s } from "@chakra-ui/react";
import { ChakraProvider as c, psTheme as l } from "@pstdio/ui";
import { jsx as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/region/region-tabs-crowded.stories.tsx
var d = () => {
	let e = {
		extensionId: "storybook",
		kind: "page",
		id: "crowded-tabs"
	}, t = i({
		startPage: e,
		defaultPanelOpenByRegionId: { secondary: !0 }
	});
	t.modes.registerMode({
		id: "crowded",
		label: "Crowded tabs",
		activate: () => void 0
	});
	let n = [
		"Diff",
		"Preview",
		"a-very-long-resource-name-component.tsx",
		"Terminal",
		"Session notes for review",
		"Docs",
		"Research findings",
		"Design"
	];
	for (let [e, r] of n.entries()) t.views.registerView({
		id: `tab-${e}`,
		title: r,
		icon: "file",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ u(s, {
				p: "md",
				children: r
			})
		}
	});
	return t.pages.registerPage({
		id: "crowded-tabs",
		ref: e,
		title: "Crowded tabs",
		path: "crowded-tabs",
		modeId: "crowded",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "tab-0"
			},
			cardinality: "one"
		},
		slots: n.map((e, t) => ({
			id: `slot-${t}`,
			region: "secondary",
			item: {
				kind: "view",
				view: {
					kind: "view",
					id: `tab-${t}`
				},
				presence: "open"
			}
		}))
	}), t.pageLocations.switchProject("crowded-tabs"), t;
}, f = {
	title: "pstdio-workbench/Reference/Core API/Crowded panel tabs",
	component: a,
	parameters: { layout: "fullscreen" }
}, p = {
	args: { workbench: d() },
	render: (e) => /* @__PURE__ */ u(c, {
		value: l,
		children: /* @__PURE__ */ u(o, {
			width: "3xl",
			children: /* @__PURE__ */ u(a, { ...e })
		})
	})
}, m = {
	args: { workbench: d() },
	render: (e) => /* @__PURE__ */ u(c, {
		value: l,
		children: /* @__PURE__ */ u(o, {
			width: "sm",
			children: /* @__PURE__ */ u(a, { ...e })
		})
	})
}, h = {
	tags: ["!manifest", "tab-strip-scroll"],
	args: { workbench: d() },
	render: (e) => /* @__PURE__ */ u(c, {
		value: l,
		children: /* @__PURE__ */ u(o, {
			"data-testid": "outer-viewport",
			width: "xs",
			overflow: "hidden",
			children: /* @__PURE__ */ u(o, {
				width: "sm",
				children: /* @__PURE__ */ u(a, { ...e })
			})
		})
	}),
	play: async ({ canvasElement: e, args: i }) => {
		let a = n(e), o = await a.findByRole("tab", { name: "Design" }), s = o.closest("[data-part=\"viewport\"]");
		r(s).not.toBeNull();
		let c = i.workbench.layout.getLayout().regions.secondary.widgets.find((e) => e.viewId === "tab-7");
		i.workbench.layout.activatePanel(c.widgetId), await t(() => r(o).toHaveAttribute("aria-selected", "true")), await t(() => r(s.scrollLeft).toBeGreaterThan(0)), r(a.getByTestId("outer-viewport").scrollLeft).toBe(0);
	}
}, g = {
	...p,
	args: { workbench: d() },
	play: async ({ canvasElement: i }) => {
		let a = await n(i).findByRole("tab", { name: "a-very-long-resource-name-component.tsx" }), o = n(i.ownerDocument.body), s = n(i).getByRole("tab", { name: "Diff" });
		await new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(() => e()))), await e.hover(a), await r(await o.findByRole("tooltip")).toHaveTextContent("a-very-long-resource-name-component.tsx"), await e.unhover(a), await e.hover(s), await t(() => r(o.queryByRole("tooltip")).toBeNull()), await e.unhover(s), await e.hover(a), await r(await o.findByRole("tooltip")).toHaveTextContent("a-very-long-resource-name-component.tsx"), await e.unhover(a), await e.keyboard("{Escape}"), await t(() => r(o.queryByRole("tooltip")).toBeNull()), a.focus(), await r(await o.findByRole("tooltip")).toHaveTextContent("a-very-long-resource-name-component.tsx"), await e.keyboard("{Escape}"), s.focus(), await e.hover(s), await t(() => r(o.queryByRole("tooltip")).toBeNull());
	}
};
export { g as FullTitle, m as MinimumWidth, h as ScrollingStaysInPanel, p as SharedWidth, f as default };
