// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-kaLFKJEn.ts";
import { t as a } from "./use-workbench-store-BMaFgEbb.ts";
import { n as o, t as s } from "./use-tab-context-menu-DObEI0YB.ts";
import { t as c } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useId as l, useState as u } from "react";
import { Button as d, Stack as f, Text as p } from "@chakra-ui/react";
import { ResourceActionMenu as m } from "@pstdio/ui";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
var _ = {
	title: "pstdio-workbench/Guides/Static tab actions",
	component: () => {
		let e = l(), { menu: t, show: n, onContextMenu: r } = s(e), [c, _] = u(!1), [v] = u(() => {
			let e = i();
			e.modes.registerMode({
				id: "project",
				activate() {}
			}), e.views.registerView({
				id: "tool",
				title: "Tool",
				body: {
					kind: "react",
					render: () => null
				}
			});
			let t = {
				kind: "page",
				extensionId: "example",
				id: "tools"
			};
			return e.pages.registerPage({
				id: "tools",
				ref: t,
				path: "tools",
				modeId: "project",
				main: { kind: "panels" },
				slots: [{
					id: "tool",
					region: "main",
					item: {
						kind: "view",
						view: {
							kind: "view",
							id: "tool"
						},
						presence: "open"
					}
				}]
			}), e.pageLocations.setProject("example"), e.pageLocations.navigate({
				kind: "page",
				page: t
			}), e;
		}), y = a(v.layout.store, (e) => e.layout.regions.main.widgets[0]);
		return /* @__PURE__ */ g(f, { children: [
			/* @__PURE__ */ h(d, {
				id: e,
				onClick: (e) => n(e.currentTarget),
				onContextMenu: r,
				children: "Tool actions"
			}),
			/* @__PURE__ */ h(p, {
				role: "status",
				children: y.tabRetention
			}),
			/* @__PURE__ */ h(m, {
				actions: [{
					key: "new",
					label: "New tool",
					onClick: () => _(!0)
				}],
				children: /* @__PURE__ */ h(d, { children: "Add tool" })
			}),
			c ? /* @__PURE__ */ h(p, { children: "Tool created" }) : null,
			/* @__PURE__ */ h(o, {
				menu: t,
				label: "Tool",
				groups: [],
				placement: y,
				workbench: v
			})
		] });
	},
	tags: ["!manifest"],
	decorators: [(e) => /* @__PURE__ */ h(c, { children: /* @__PURE__ */ h(e, {}) })]
}, v = { play: async ({ canvasElement: t }) => {
	let i = n(t), a = n(document.body);
	await e.click(i.getByRole("button", { name: "Tool actions" })), await e.click(await a.findByRole("menuitem", { name: "Unpin tab" })), await r(i.getByRole("status")).toHaveTextContent("preview"), await e.click(i.getByRole("button", { name: "Tool actions" })), await e.click(await a.findByRole("menuitem", { name: "Pin tab" })), await r(i.getByRole("status")).toHaveTextContent("persistent");
} }, y = {
	tags: ["tab-menu-next-action"],
	play: async ({ canvasElement: i }) => {
		let a = n(i), o = n(document.body);
		await e.click(a.getByRole("button", { name: "Tool actions" }));
		let s = await o.findByRole("menu", { name: "Tool context menu" });
		await e.click(await o.findByRole("menuitem", { name: "Unpin tab" })), await r(a.getByRole("status")).toHaveTextContent("preview"), await e.click(a.getByRole("button", { name: "Add tool" })), await t(() => r(s).not.toBeInTheDocument()), await e.click(await o.findByRole("menuitem", { name: "New tool" })), await t(() => r(a.getByText("Tool created")).toBeVisible());
	}
};
export { y as AddAfterPin, v as PinAndUnpin, _ as default };
