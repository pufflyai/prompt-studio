// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { o as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-kaLFKJEn.ts";
import { t as i } from "./workbench-BbqJVWhj.ts";
import { t as a } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as o } from "react";
import { Box as s, Text as c } from "@chakra-ui/react";
import { jsx as l } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/panel-menu/page-menu-header.stories.tsx
var u = (e) => {
	let t = {
		extensionId: "storybook",
		kind: "page",
		id: "board"
	}, n = r({ startPage: t });
	n.modes.registerMode({
		id: "board",
		activate: () => void 0
	}), n.views.registerView({
		id: "board",
		title: "Board",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ l(c, {
				p: "md",
				children: "Board content"
			})
		}
	}), e && (n.views.registerView({
		id: "properties",
		title: "Properties",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ l(c, {
				p: "sm",
				children: "Board properties"
			})
		}
	}), n.viewMenus.registerViewMenu({
		id: "properties",
		ownerViewId: "board",
		viewId: "properties",
		side: "right"
	})), n.pages.registerPage({
		id: "board",
		ref: t,
		title: "Board",
		path: "board",
		modeId: "board",
		slots: [],
		main: {
			kind: "view",
			presentation: "page",
			view: {
				kind: "view",
				id: "board"
			},
			cardinality: "one"
		}
	}), n.pageLocations.switchProject("page-menu-header-stories");
	let i = n.layout.getLayout().regions["main-right-menu"].widgets[0];
	return i && n.panelMenuState.setOpen(`panel-menu:${i.widgetId}`, !1), n;
}, d = {
	title: "pstdio-workbench/Reference/Core API/Page menu header",
	component: (e) => {
		let { withMenu: t } = e, [n] = o(() => u(t));
		return /* @__PURE__ */ l(a, { children: /* @__PURE__ */ l(s, {
			w: "full",
			h: "100dvh",
			children: /* @__PURE__ */ l(i, { workbench: n })
		}) });
	},
	parameters: { layout: "fullscreen" }
}, f = {
	args: { withMenu: !0 },
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await n(await i.findByText("Board content")).toBeVisible();
		let a = await e(() => {
			let e = r.querySelector("[data-workbench-page-menu-header=\"main\"]");
			return n(e).toBeVisible(), e;
		});
		await n(t(a).queryAllByRole("tab")).toHaveLength(0), await n(r.querySelector("[data-workbench-panel-header=\"main\"]")).toBeNull(), await n(t(a).getByRole("button", { name: "Open Main right menu" })).toBeVisible();
	}
}, p = {
	args: { withMenu: !1 },
	play: async ({ canvasElement: e }) => {
		let r = t(e);
		await n(await r.findByText("Board content")).toBeVisible(), await n(e.querySelector("[data-workbench-page-menu-header=\"main\"]")).toBeNull(), await n(e.querySelector("[data-workbench-panel-header=\"main\"]")).toBeNull();
	}
};
export { f as WithClosedViewMenu, p as WithoutViewMenus, d as default };
