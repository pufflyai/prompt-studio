// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-N58OeDyx.ts";
import { n as a } from "./use-renderer-read-CxbGovUR.ts";
import { t as o } from "./tree-view-DU4i0smO.ts";
import { t as s } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as c } from "react";
import { Button as l, Stack as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
import { PstdioConnectionError as p } from "@pstdio/sdk/client";
// packages/pstdio-workbench/src/react/renderers/tree/tree-connection-loss.stories.tsx
var m = (e) => {
	let t = i(), n = e, r = !1;
	return t.views.registerView({
		id: "connection-navigation",
		title: "Navigation",
		body: {
			kind: "tree",
			getChildren: () => [],
			getBody: (e) => {
				if (r && e?.onProgress?.([]), n) throw n;
				return [{
					id: "tools",
					nodes: [{
						id: "notes",
						label: "Notes"
					}]
				}];
			}
		}
	}), {
		workbench: t,
		refresh(e, i = !1) {
			n = e, r = i, t.views.refreshView("connection-navigation");
		},
		restore() {
			n = void 0;
		}
	};
}, h = {
	title: "pstdio-workbench/Guides/Navigation connection loss",
	component: (e) => {
		let { initialFailure: t, initiallyConnected: n = !0 } = e, [r] = c(() => m(t)), [i, s] = c(n);
		return /* @__PURE__ */ f(u, {
			h: "md",
			gap: "md",
			children: [
				/* @__PURE__ */ d(l, {
					onClick: () => r.refresh(new p(/* @__PURE__ */ TypeError("Failed to fetch"))),
					children: "Drop response"
				}),
				/* @__PURE__ */ d(l, {
					onClick: () => s(!1),
					children: "Disconnect"
				}),
				/* @__PURE__ */ d(l, {
					onClick: () => r.refresh(new p(/* @__PURE__ */ TypeError("Failed to fetch")), !0),
					children: "Drop partial response"
				}),
				/* @__PURE__ */ d(l, {
					onClick: () => r.restore(),
					children: "Restore response"
				}),
				/* @__PURE__ */ d(l, {
					onClick: () => {
						r.refresh(), s(!0);
					},
					children: "Reconnect"
				}),
				/* @__PURE__ */ d(l, {
					onClick: () => r.refresh(/* @__PURE__ */ Error("This view has an invalid query.")),
					children: "Fail view"
				}),
				/* @__PURE__ */ d(a, {
					connected: i,
					children: /* @__PURE__ */ d(o, {
						workbench: r.workbench,
						treeViewId: "connection-navigation"
					})
				})
			]
		});
	},
	decorators: [(e) => /* @__PURE__ */ d(s, { children: /* @__PURE__ */ d(e, {}) })]
}, g = { play: async ({ canvasElement: i }) => {
	let a = n(i);
	await r(await a.findByRole("option", { name: "Notes" })).toBeVisible(), await e.click(a.getByRole("button", { name: "Drop response" })), await r(a.queryByRole("alert")).not.toBeInTheDocument(), await e.click(a.getByRole("button", { name: "Disconnect" })), await t(() => r(a.getByRole("region", { name: "Navigation" })).toHaveAttribute("aria-busy", "false")), await r(a.queryByRole("alert")).not.toBeInTheDocument(), await r(a.getByRole("option", { name: "Notes" })).toBeVisible(), await e.click(a.getByRole("button", { name: "Reconnect" })), await r(a.getByRole("option", { name: "Notes" })).toBeVisible(), await e.click(a.getByRole("button", { name: "Fail view" })), await r(await a.findByText("This view has an invalid query.")).toBeVisible(), await e.click(a.getByRole("button", { name: "Disconnect" })), await r(a.getByText("This view has an invalid query.")).toBeVisible();
} }, _ = {
	args: { initialFailure: new p(/* @__PURE__ */ TypeError("Failed to fetch")) },
	play: async ({ canvasElement: t }) => {
		let i = n(t);
		await r(await i.findByText("Could not connect to the backend.")).toBeVisible(), await r(i.getByRole("button", { name: "Retry" })).toBeVisible(), await e.click(i.getByRole("button", { name: "Restore response" })), await e.click(i.getByRole("button", { name: "Retry" })), await r(await i.findByRole("option", { name: "Notes" })).toBeVisible();
	}
}, v = {
	args: { initiallyConnected: !1 },
	play: async ({ canvasElement: e }) => {
		let t = n(e);
		await r(await t.findByRole("option", { name: "Notes" })).toBeVisible(), await r(t.getByRole("region", { name: "Navigation" })).toHaveAttribute("aria-busy", "false");
	}
}, y = { play: async ({ canvasElement: t }) => {
	let i = n(t);
	await r(await i.findByRole("option", { name: "Notes" })).toBeVisible(), await e.click(i.getByRole("button", { name: "Drop partial response" })), await e.click(i.getByRole("button", { name: "Disconnect" })), await r(i.getByRole("option", { name: "Notes" })).toBeVisible(), await r(i.queryByRole("alert")).not.toBeInTheDocument(), await e.click(i.getByRole("button", { name: "Reconnect" })), await r(i.getByRole("option", { name: "Notes" })).toBeVisible();
} };
export { _ as InitialConnectionFailure, v as LocalReadDuringOutage, y as RetainCompletedNavigation, g as RetainNavigation, h as default };
