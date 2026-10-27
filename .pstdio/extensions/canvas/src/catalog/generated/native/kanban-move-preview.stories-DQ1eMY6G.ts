// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { n as i, t as a } from "./workbench-core-N58OeDyx.ts";
import { t as o } from "./kanban-view-COShTNns.ts";
import { t as s } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as c } from "react";
import { Box as l, Button as u, HStack as d, Stack as f, Text as p } from "@chakra-ui/react";
import { jsx as m, jsxs as h } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/kanban/kanban-move-preview.stories.tsx
var g = (e) => {
	let { viewMode: t = "board" } = e, [n, r] = c([]), [g] = c(() => {
		let e = a(), n = i(e), o = [{
			id: "task",
			title: "Review ticket filters",
			attributes: { status: "backlog" }
		}];
		return n.registerKanbanRenderer({
			id: "deferred-move",
			title: "Tasks",
			attributes: [{
				id: "status",
				label: "Status",
				groupable: !0,
				displayable: !0,
				editable: !0,
				type: {
					kind: "enum",
					options: [
						{
							value: "backlog",
							label: "Backlog"
						},
						{
							value: "ready",
							label: "Ready"
						},
						{
							value: "done",
							label: "Done"
						}
					]
				}
			}],
			defaultSettings: {
				viewMode: t,
				columnGrouping: "status",
				rowGrouping: "none",
				displayProperties: ["status"]
			},
			executeQuery: () => o,
			getBoardColumnConfig: () => ({ canCreate: !1 }),
			onAttributeChange: (e, t, n) => new Promise((i, a) => {
				let s = (r) => {
					r ? (o = o.map((r) => r.id === e ? {
						...r,
						attributes: {
							...r.attributes,
							[t]: n
						}
					} : r), i()) : a(/* @__PURE__ */ Error("Status save failed"));
				};
				r((e) => [...e, s]);
			})
		}), {
			workbench: e,
			contribution: n.getKanbanRenderer("deferred-move")
		};
	}), _ = (e) => {
		n[0]?.(e), r((e) => e.slice(1));
	};
	return /* @__PURE__ */ m(s, { children: /* @__PURE__ */ h(f, {
		height: "xl",
		children: [/* @__PURE__ */ h(d, { children: [
			/* @__PURE__ */ m(u, {
				onClick: () => _(!0),
				children: "Finish save"
			}),
			/* @__PURE__ */ m(u, {
				onClick: () => _(!1),
				children: "Reject save"
			}),
			/* @__PURE__ */ h(p, { children: [n.length, " saves pending"] })
		] }), /* @__PURE__ */ m(l, {
			flex: "1",
			minH: "0",
			children: /* @__PURE__ */ m(o, {
				workbench: g.workbench,
				contribution: g.contribution,
				placement: {
					instanceId: "deferred-move",
					panelId: "deferred-move",
					closable: !1
				}
			})
		})]
	}) });
}, _ = {
	title: "Renderers/Kanban/Move Preview",
	tags: ["!manifest"]
}, v = async (e) => {
	let i = n(e), a = await i.findByTestId("renderer-card"), o = i.getByTestId("board-column-ready"), s = new DataTransfer(), c = (e) => new DragEvent(e, {
		dataTransfer: s,
		bubbles: !0,
		cancelable: !0
	});
	return a.dispatchEvent(c("dragstart")), o.dispatchEvent(c("dragover")), o.dispatchEvent(c("drop")), a.dispatchEvent(c("dragend")), await i.findByText("1 saves pending"), await t(() => r(n(o).getByText("Review ticket filters")).toBeVisible()), i;
}, y = {
	render: () => /* @__PURE__ */ m(g, {}),
	play: async ({ canvasElement: t }) => {
		let i = await v(t);
		await e.click(i.getByRole("button", { name: "Finish save" })), await i.findByText("0 saves pending"), await r(n(i.getByTestId("board-column-ready")).getByText("Review ticket filters")).toBeVisible();
	}
}, b = {
	render: () => /* @__PURE__ */ m(g, {}),
	play: async ({ canvasElement: i }) => {
		let a = await v(i);
		await e.click(a.getByRole("button", { name: "Reject save" })), await t(() => r(n(a.getByTestId("board-column-backlog")).getByText("Review ticket filters")).toBeVisible());
	}
}, x = async (t) => {
	let r = n(t), i = await r.findByLabelText("Review ticket filters");
	return await e.click(n(i).getByText("Backlog")), await e.click(n(document.body).getByRole("menuitemradio", { name: /^Ready$/ })), await r.findByText("1 saves pending"), r;
}, S = {
	render: () => /* @__PURE__ */ m(g, {}),
	play: async ({ canvasElement: t }) => {
		let i = await x(t), a = i.getByTestId("board-column-ready");
		await r(n(a).getByText("Review ticket filters")).toBeVisible(), await e.click(i.getByRole("button", { name: "Finish save" })), await i.findByText("0 saves pending"), await r(n(a).getByText("Review ticket filters")).toBeVisible();
	}
}, C = {
	render: () => /* @__PURE__ */ m(g, {}),
	play: async ({ canvasElement: i }) => {
		let a = await x(i);
		await r(n(a.getByTestId("board-column-ready")).getByText("Review ticket filters")).toBeVisible(), await e.click(a.getByRole("button", { name: "Reject save" })), await t(() => r(n(a.getByTestId("board-column-backlog")).getByText("Review ticket filters")).toBeVisible());
	}
}, w = {
	render: () => /* @__PURE__ */ m(g, { viewMode: "list" }),
	play: async ({ canvasElement: t }) => {
		let i = await x(t);
		await r(n(i.getByLabelText("Review ticket filters")).getByText("Ready")).toBeVisible(), await e.click(i.getByRole("button", { name: "Finish save" })), await i.findByText("0 saves pending"), await r(n(i.getByLabelText("Review ticket filters")).getByText("Ready")).toBeVisible();
	}
}, T = {
	render: () => /* @__PURE__ */ m(g, {}),
	play: async ({ canvasElement: t }) => {
		let i = await x(t);
		await e.click(n(i.getByLabelText("Review ticket filters")).getByText("Ready")), await e.click(n(document.body).getByRole("menuitemradio", { name: /^Done$/ }));
		let a = i.getByTestId("board-column-done");
		await r(n(a).getByText("Review ticket filters")).toBeVisible(), await e.click(i.getByRole("button", { name: "Reject save" })), await i.findByText("1 saves pending"), await r(n(a).getByText("Review ticket filters")).toBeVisible(), await e.click(i.getByRole("button", { name: "Finish save" })), await i.findByText("0 saves pending"), await r(n(a).getByText("Review ticket filters")).toBeVisible();
	}
};
export { T as LaterPropertySurvivesFailure, w as ListPropertyBeforeSave, y as MoveBeforeSave, S as PropertyBeforeSave, C as PropertyFailure, b as RestoreAfterFailure, _ as default };
