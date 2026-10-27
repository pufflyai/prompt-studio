// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, i as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { t as a } from "./plus-CYkLGSPS.ts";
import { n as o, r as s, t as c } from "./kanban-renderer-story-fixtures-DLwkBAvf.ts";
import { n as l, t as u } from "./kanban-renderer-BPXgHTX1.ts";
import { useState as d } from "react";
import { Box as f, Button as p, Stack as m, Text as h } from "@chakra-ui/react";
import { jsx as g, jsxs as _ } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-story-wrappers.tsx
var v = "storybook-kanban-renderer", y = (e, t, n) => {
	let r = e.findIndex((e) => e.id === t);
	if (r === -1) return e;
	let i = [...e], [a] = i.splice(r, 1);
	if (!a) return e;
	if (!n) return i.push(a), i;
	let o = i.findIndex((e) => e.id === n);
	return o === -1 ? (i.push(a), i) : (i.splice(o, 0, a), i);
}, b = (e) => {
	let [t, n] = d(() => (e.defaultViews ?? []).map((e, t) => ({
		...e,
		builtIn: t === 0
	}))), [r, i] = d(e.defaultActiveViewId ?? t[0]?.id ?? "default"), a = e.defaultViews ? {
		views: t,
		defaultViewId: r,
		onCreateView: async (e) => {
			let t = {
				...e,
				id: crypto.randomUUID(),
				builtIn: !1
			};
			return n((e) => [...e, t]), t;
		},
		onUpdateView: async (e, t) => {
			n((n) => n.map((n) => n.id === e ? {
				...n,
				...t
			} : n));
		},
		onDeleteView: async (e) => {
			n((t) => t.filter((t) => t.id !== e));
		},
		onSetDefaultView: async (e) => {
			i(e ?? t[0].id);
		}
	} : void 0, [p, m] = d(null), [h, _] = d(e.rows ?? s), b = e.storageKey ?? v, x = {
		viewMode: e.viewMode ?? "board",
		columnGrouping: e.columnGrouping ?? "status",
		rowGrouping: e.rowGrouping ?? "none",
		displayProperties: e.displayProperties ?? []
	}, S = l(b, (e) => e.reset, { settings: x });
	return d(S), /* @__PURE__ */ g(f, {
		p: "sm",
		height: "560px",
		children: /* @__PURE__ */ g(u, {
			viewsSource: a,
			rows: e.showEmptyState ? [] : h,
			storageKey: b,
			attributes: c,
			defaultSettings: x,
			defaultViews: e.defaultViews,
			defaultActiveViewId: e.defaultActiveViewId,
			selectedRowId: p,
			emptyState: e.emptyState,
			onRowClick: (e) => m(e.id),
			onAttributeChange: (e, t, n) => {
				_((r) => r.map((r) => r.id === e ? {
					...r,
					attributes: {
						...r.attributes,
						[t]: n
					}
				} : r));
			},
			onReorder: (e, t) => _((n) => y(n, e, t)),
			getBoardColumnConfig: (e) => ({
				color: o[e] ?? "gray",
				canCreate: !1
			}),
			getRowContextMenuActions: e.withTicketMenu ? () => [{
				key: "open",
				label: "Open ticket",
				onClick: () => void 0
			}] : void 0
		})
	});
}, x = () => {
	let [e, t] = d(s), n = c.map((e) => [
		"status",
		"component",
		"priority",
		"labels"
	].includes(e.id) ? {
		...e,
		editable: !0
	} : e);
	return /* @__PURE__ */ g(f, {
		p: "sm",
		height: "560px",
		children: /* @__PURE__ */ g(u, {
			rows: e,
			storageKey: "storybook-kanban-renderer-create-form",
			attributes: n,
			defaultSettings: {
				viewMode: "board",
				columnGrouping: "status",
				rowGrouping: "none",
				displayProperties: ["priority", "labels"]
			},
			createRow: {
				title: "New ticket",
				submitLabel: "Create ticket",
				fields: [{
					id: "content",
					label: "Description",
					placeholder: "Describe the ticket...",
					type: "markdown",
					required: !0
				}, {
					id: "files",
					label: "Attach files",
					type: "files",
					multiple: !0
				}],
				labels: {
					cancel: "Cancel",
					properties: "Properties",
					submitError: "Could not create ticket",
					removeFile: "Remove file"
				}
			},
			onCreateRow: (e) => {
				let n = String(e.values.content);
				t((t) => [...t, {
					id: `created-${t.length.toString()}`,
					title: n.split("\n")[0] || "Untitled",
					attributes: {
						status: e.columnId,
						assignee: "",
						component: String(e.attributeValues.component ?? ""),
						priority: String(e.attributeValues.priority ?? ""),
						labels: e.attributeValues.labels,
						updated: (/* @__PURE__ */ new Date()).toISOString()
					}
				}]);
			},
			getBoardColumnConfig: () => ({ canCreate: !0 })
		})
	});
}, S = {
	title: "Patterns/Kanban Renderer/Kanban Renderer",
	component: u,
	parameters: { layout: "fullscreen" }
}, C = "550e8400-e29b-41d4-a716-446655440000", w = s.map((e, t) => t === 0 ? {
	...e,
	id: C,
	attributes: {
		...e.attributes,
		id: "PS-1"
	}
} : t === 1 ? {
	...e,
	title: "PRA-1_A1",
	attributes: {
		...e.attributes,
		id: "PRA-1_A1"
	}
} : e), T = (e) => Array.from(e.classList).find((e) => e !== "lucide" && e.startsWith("lucide-")), E = { render: () => /* @__PURE__ */ g(b, {}) }, D = {
	tags: ["renderer-chrome-regression"],
	render: () => /* @__PURE__ */ g(b, {
		storageKey: "storybook-kanban-renderer-chrome",
		displayProperties: ["id"],
		withTicketMenu: !0,
		rows: w
	}),
	play: async ({ canvasElement: a }) => {
		let o = e(a), s = o.getByTestId("kanban-renderer"), c = o.getByTestId("collection-view-bar"), l = o.getAllByTestId("renderer-card")[0];
		if (!l) throw Error("Expected a ticket card to render");
		await i(getComputedStyle(s).borderTopWidth).toBe("0px"), await i(getComputedStyle(c).backgroundColor).toBe("rgba(0, 0, 0, 0)"), await i(o.getAllByTestId("column-status-icon")[0]).toBeVisible();
		let u = o.getAllByTestId("column-status-icon").map(T), d = o.getByRole("button", { name: "Filter" }), f = o.getByRole("button", { name: "Display settings" }), p = e(document.body);
		await r.hover(d), await i(await p.findByRole("tooltip")).toHaveTextContent("Filter"), await r.unhover(d), await n(() => i(p.queryByRole("tooltip")).not.toBeInTheDocument()), await r.hover(f), await i(await p.findByRole("tooltip")).toHaveTextContent("Display"), await r.unhover(f), await n(() => i(p.queryByRole("tooltip")).not.toBeInTheDocument()), t.contextMenu(l);
		let m = await p.findByRole("menu");
		await i(m.getBoundingClientRect().width).toBe(280), await r.click(e(m).getByRole("menuitem", { name: "Open ticket" })), await n(() => i(p.queryByRole("menu")).not.toBeInTheDocument()), await r.click(d);
		let h = await p.findByRole("dialog"), g = d.getBoundingClientRect(), _ = h.getBoundingClientRect();
		await i(_.left).toBeLessThanOrEqual(g.left + 1), await i(_.right).toBeGreaterThanOrEqual(g.right - 1), await i(_.top).toBeGreaterThanOrEqual(g.bottom), await r.click(d), await n(() => i(p.queryByRole("dialog")).not.toBeInTheDocument()), await r.click(f);
		let v = await p.findByRole("dialog"), y = f.getBoundingClientRect();
		await n(() => {
			let e = v.getBoundingClientRect();
			i(Math.abs(e.right - y.right)).toBeLessThanOrEqual(1), i(e.top).toBeGreaterThanOrEqual(y.bottom);
		}), await r.click(e(v).getByRole("button", { name: "List" }));
		let b = await o.findByRole("option", { name: "Set up API authentication" }), x = e(b).getByTestId("list-row-eyebrow");
		await i(x).toHaveTextContent("PS-1"), await i(o.getAllByText("PS-1")).toHaveLength(1), await i(getComputedStyle(x).fontSize).toBe("10px"), await i(getComputedStyle(x.parentElement).columnGap).toBe("10px"), await i(o.queryByText(C)).not.toBeInTheDocument();
		let S = o.getByRole("option", { name: "PRA-1_A1" });
		await i(e(S).queryByTestId("list-row-eyebrow")).not.toBeInTheDocument(), await i(o.getAllByText("PRA-1_A1")).toHaveLength(1);
		let w = o.getAllByTestId("list-status-icon").map(T);
		await i(w).toEqual(u);
		let E = e(b).getByTestId("row-status-icon");
		await i(T(E)).toBe(u[0]), await i(getComputedStyle(E.parentElement.parentElement).columnGap).toBe("10px");
	}
}, O = { render: () => /* @__PURE__ */ g(b, {
	storageKey: "storybook-kanban-renderer-list-view",
	viewMode: "list"
}) }, k = (e, t = []) => ({
	viewMode: e,
	columnGrouping: "status",
	rowGrouping: "none",
	displayProperties: t
}), A = (e, t) => ({
	conjunction: "and",
	rules: [{
		attributeId: e,
		condition: "is-any-of",
		value: t
	}]
}), j = [
	{
		id: "all",
		title: "All",
		settings: k("board", ["priority"]),
		filter: {
			conjunction: "and",
			rules: []
		},
		sorts: []
	},
	{
		id: "my-work",
		title: "My work",
		settings: k("list", ["assignee", "priority"]),
		filter: A("assignee", ["Alex"]),
		sorts: [{
			attributeId: "priority",
			direction: "asc"
		}]
	},
	{
		id: "design",
		title: "Design board",
		settings: k("board", ["component", "priority"]),
		filter: A("component", ["frontend"]),
		sorts: []
	},
	{
		id: "high-priority",
		title: "High priority",
		settings: k("board", ["assignee", "priority"]),
		filter: A("priority", ["high"]),
		sorts: [{
			attributeId: "updated",
			direction: "desc"
		}]
	}
], M = {
	render: () => /* @__PURE__ */ g(b, {
		storageKey: "storybook-kanban-renderer-saved-views",
		defaultViews: j,
		defaultActiveViewId: "all"
	}),
	play: async ({ canvasElement: t }) => {
		let a = e(t).getByRole("button", { name: "Add view" }), o = e(document.body);
		await r.hover(a), await i(await o.findByRole("tooltip")).toHaveTextContent("Add view"), await r.unhover(a), await n(() => i(o.queryByRole("tooltip")).not.toBeInTheDocument());
	}
}, N = {
	tags: ["saved-filter-row-regression"],
	render: () => /* @__PURE__ */ g(b, {
		storageKey: "storybook-kanban-renderer-saved-filtered-view",
		defaultViews: j,
		defaultActiveViewId: "my-work"
	}),
	play: async ({ canvasElement: t }) => {
		let n = (await e(t).findByRole("button", { name: "Remove Assignee filter" })).parentElement;
		if (!n) throw Error("Expected the saved filter pill to render");
		await i(e(n).getByText("Assignee", { exact: !0 })).toBeVisible(), await i(e(n).getByRole("button", { name: "Condition" })).toHaveTextContent("is"), await i(e(n).getByRole("button", { name: "Values" })).toHaveTextContent("Alex");
	}
}, P = {
	render: () => /* @__PURE__ */ g(x, {}),
	play: async ({ canvasElement: t }) => {
		let n = e(t);
		await r.click(e(n.getByTestId("board-column-todo")).getByRole("button", { name: "Create row" }));
		let a = e(await e(document.body).findByRole("dialog"));
		await i(a.getByText("Todo")).toBeInTheDocument(), await r.type(await a.findByRole("textbox"), "Restore ticket creation"), await r.click(a.getByRole("button", { name: "Create ticket" })), await i(await e(n.getByTestId("board-column-todo")).findByText("Restore ticket creation")).toBeInTheDocument();
	}
}, F = { render: () => /* @__PURE__ */ g(b, { showEmptyState: !0 }) }, I = { render: () => /* @__PURE__ */ g(b, {
	showEmptyState: !0,
	emptyState: /* @__PURE__ */ _(m, {
		height: "100%",
		align: "center",
		justify: "center",
		gap: "md",
		borderWidth: "1px",
		borderRadius: "md",
		children: [/* @__PURE__ */ _(m, {
			gap: "xs",
			textAlign: "center",
			children: [/* @__PURE__ */ g(h, {
				textStyle: "heading/S",
				children: "No work queued"
			}), /* @__PURE__ */ g(h, {
				color: "fg.muted",
				textStyle: "body/S",
				children: "Create a row to start tracking work in this view."
			})]
		}), /* @__PURE__ */ _(p, {
			size: "sm",
			children: [/* @__PURE__ */ g(a, {}), "Create row"]
		})]
	})
}) }, L = async (t) => {
	await r.click(t.getByLabelText("Display settings")), await r.click(e(document.body).getByText("List"));
}, R = {
	render: () => /* @__PURE__ */ g(b, {}),
	play: async ({ canvasElement: t }) => {
		let n = e(t);
		await L(n), await i(n.getByText("Set up API authentication")).toBeInTheDocument();
	}
}, z = (e, t) => {
	let n = new DataTransfer(), r = (e, t) => e.dispatchEvent(new DragEvent(t, {
		bubbles: !0,
		cancelable: !0,
		dataTransfer: n
	}));
	r(e, "dragstart"), r(t, "dragover"), r(t, "drop"), r(e, "dragend");
}, B = {
	render: () => /* @__PURE__ */ g(b, {}),
	play: async ({ canvasElement: t }) => {
		let n = e(t), r = n.getByTestId("board-column-done");
		await i(e(r).getByText("Write docs")).toBeInTheDocument(), z(n.getByText("Write docs").closest("[draggable]"), n.getByTestId("board-column-todo")), await i(await e(n.getByTestId("board-column-todo")).findByText("Write docs")).toBeInTheDocument(), await i(e(n.getByTestId("board-column-done")).queryByText("Write docs")).not.toBeInTheDocument();
	}
}, V = {
	render: () => /* @__PURE__ */ g(b, {}),
	play: async ({ canvasElement: t }) => {
		let n = e(t);
		for (let t of ["Write docs", "Set up CI pipeline"]) z(n.getByText(t).closest("[draggable]"), n.getByTestId("board-column-todo")), await i(await e(n.getByTestId("board-column-todo")).findByText(t)).toBeInTheDocument();
		await i(n.getByTestId("board-column-done")).toBeInTheDocument();
	}
}, H = { render: () => /* @__PURE__ */ g(b, {}) };
export { E as BoardView, I as CustomEmptyState, B as DragAndDrop, V as EmptyColumnPersists, F as EmptyState, O as ListView, H as MultiValuedLabels, D as RendererChromeAndTicketMenu, P as RendererOwnedCreateForm, N as SavedFilteredView, M as SavedViews, R as SwitchView, S as default };
