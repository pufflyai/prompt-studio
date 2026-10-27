// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-N58OeDyx.ts";
import { t as i } from "./workbench-BYYWgWSr.ts";
import { t as a } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as o } from "react";
import { Box as s, Button as c, Stack as l, Text as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/paged-collections.stories.tsx
var p = (e) => e.sorts[0]?.direction === "desc" ? -1 : 1, m = (e) => e.cursor === void 0 ? e.offset : Number(e.cursor), h = (e, t) => {
	let n = r(), i = e, a = Promise.withResolvers(), o = 0, s = !1, c = /* @__PURE__ */ new Set(), l = Array.from({ length: 250 }, (e, t) => ({
		id: `row-${t}`,
		values: {
			title: `Row ${String(t).padStart(3, "0")}`,
			rank: t,
			status: t % 2 ? "Done" : "Todo"
		}
	})), u = () => {
		o++;
		for (let e of c) e();
	};
	return n.registerModule({
		id: "paged-story",
		activate(e) {
			e.views.registerView({
				id: "paged-table",
				title: "Paged rows",
				body: {
					kind: "dataTable",
					queryMode: "paged",
					initialPageSize: 100,
					columns: [
						{
							id: "title",
							label: "Title",
							type: "string"
						},
						{
							id: "rank",
							label: "Rank",
							type: "number"
						},
						{
							id: "status",
							label: "Status",
							type: "string",
							groupable: !0
						}
					],
					defaultSettings: { showStats: !1 },
					defaultSorts: [{
						attributeId: "rank",
						direction: "asc"
					}],
					selectionMode: "multiple",
					selectionActions: [{
						id: "selected",
						label: "Use selected rows",
						run: () => {}
					}],
					subscribe: (e) => (c.add(e), () => c.delete(e)),
					executeQuery: async (e, t) => {
						i && await a.promise, t.throwIfAborted();
						let n = e.page;
						if (n.revision !== void 0 && n.revision !== String(o)) throw Error("Stale revision");
						let r = s ? [] : l.filter((e) => e.values.title.toLowerCase().includes(n.search.toLowerCase()));
						for (let t of e.filter.rules) r = r.filter((e) => String(e.values[t.attributeId]).includes(String(t.value ?? "")));
						let c = p(e);
						r.sort((e, t) => c * (e.values.rank - t.values.rank));
						let u = m(n);
						return {
							rows: r.slice(u, u + n.limit),
							page: {
								revision: String(o),
								cursor: u + n.limit < r.length ? String(u + n.limit) : null,
								total: s ? 0 : l.length,
								filteredTotal: r.length,
								groups: ["Done", "Todo"].map((e) => ({
									field: "status",
									value: e,
									count: r.filter((t) => t.values.status === e).length
								}))
							}
						};
					}
				}
			}), e.shellPlacements.registerPlacement({
				id: "paged-table",
				region: "main",
				item: {
					kind: "view",
					presence: "fixed",
					view: {
						kind: "view",
						id: "paged-table"
					}
				}
			}), t && (e.views.registerView({
				id: "other-table",
				title: "Other table",
				body: {
					kind: "dataTable",
					columns: [{
						id: "title",
						label: "Title"
					}],
					defaultSettings: { showStats: !1 },
					executeQuery: () => ({ rows: [{
						id: "other",
						values: { title: "Another collection" }
					}] })
				}
			}), e.shellPlacements.registerPlacement({
				id: "other-table",
				region: "main",
				item: {
					kind: "view",
					presence: "fixed",
					view: {
						kind: "view",
						id: "other-table"
					}
				}
			}));
		}
	}), {
		workbench: n,
		hold: () => {
			i = !0, a = Promise.withResolvers();
		},
		release: () => {
			i = !1, a.resolve();
		},
		refresh: () => u(),
		move: () => {
			l[0].values.rank = 300, u();
		},
		empty: () => {
			s = !s, u();
		}
	};
}, g = {
	title: "pstdio-workbench/Guides/Paged collections",
	component: (e) => {
		let [t] = o(() => h(!!e.initiallyHeld, !!e.withOtherTable));
		return /* @__PURE__ */ d(a, { children: /* @__PURE__ */ f(l, {
			h: "100dvh",
			gap: "sm",
			children: [
				/* @__PURE__ */ f(l, {
					direction: "row",
					p: "sm",
					children: [
						/* @__PURE__ */ d(c, {
							onClick: t.hold,
							children: "Hold next read"
						}),
						/* @__PURE__ */ d(c, {
							onClick: t.release,
							children: "Finish read"
						}),
						/* @__PURE__ */ d(c, {
							onClick: t.refresh,
							children: "Refresh rows"
						}),
						/* @__PURE__ */ d(c, {
							onClick: t.move,
							children: "Move first row"
						}),
						/* @__PURE__ */ d(c, {
							onClick: t.empty,
							children: "Toggle empty results"
						})
					]
				}),
				/* @__PURE__ */ d(u, {
					px: "sm",
					children: "Only the requested 100 rows reach the table. Existing rows stay visible while refreshing."
				}),
				/* @__PURE__ */ d(s, {
					flex: "1",
					minH: "0",
					children: /* @__PURE__ */ d(i, { workbench: t.workbench })
				})
			]
		}) });
	},
	tags: ["!manifest"],
	parameters: { layout: "fullscreen" }
}, _ = {
	args: { withOtherTable: !0 },
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await i.findByText("Row 000"), await e.click(i.getByRole("button", { name: "Go to next page" }));
		let a = (await i.findByText("Row 100")).closest("tr");
		await e.click(t(a).getByRole("checkbox", { name: "Select row" })), await e.click(i.getByRole("tab", { name: /^Other table$/ })), await n(await i.findByText("Another collection")).toBeVisible(), await e.click(i.getByRole("tab", { name: /^Paged rows$/ }));
		let o = await i.findByText("Row 100");
		await n(o).toBeVisible(), await n(t(o.closest("tr")).getByRole("checkbox", { name: "Select row" })).toBeChecked(), await n(i.getByRole("spinbutton")).toHaveValue("2");
	}
}, v = {
	args: { initiallyHeld: !0 },
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await e.click(i.getByRole("button", { name: "Finish read" })), await n(await i.findByText("Row 000")).toBeVisible();
	}
}, y = { play: async ({ canvasElement: r }) => {
	let i = t(r);
	await i.findByText("Row 000"), await e.click(i.getByRole("button", { name: "Go to next page" })), await i.findByText("Row 100"), await e.click(i.getByRole("button", { name: "Hold next read" })), await e.click(i.getByRole("button", { name: "Move first row" })), await n(i.getByText("Row 100")).toBeVisible(), await e.click(i.getByRole("button", { name: "Finish read" })), await n(await i.findByText("Row 001")).toBeVisible(), await n(i.queryByText("Row 000")).not.toBeInTheDocument();
} }, b = { play: async ({ canvasElement: r }) => {
	let i = t(r);
	await i.findByText("Row 000"), await e.click(i.getByRole("button", { name: "Toggle empty results" })), await n(await i.findByText("No rows")).toBeVisible();
} }, x = { play: async ({ canvasElement: r }) => {
	let i = t(r);
	await i.findByText("Row 000"), await e.click(i.getByRole("button", { name: "Search this view" })), await e.type(i.getByRole("textbox", { name: "Search this view" }), "Row 24"), await n(await i.findByText("Row 240")).toBeVisible(), await n(i.queryByText("Row 000")).not.toBeInTheDocument();
	let a = i.getByRole("columnheader", { name: /Rank/ });
	await e.click(t(a).getByRole("button", { name: "Sorted asc" })), await e.click(t(document.body).getByText("Sort descending", { exact: !0 })), await n(await i.findByText("Row 249")).toBeVisible();
} }, S = { play: async ({ canvasElement: r }) => {
	let i = t(r);
	await i.findByText("Row 000"), await e.click(i.getByRole("button", { name: "Hold next read" })), await e.click(i.getByRole("button", { name: "Go to next page" })), await n(i.getByRole("spinbutton")).toHaveValue("1"), await n(i.getByRole("status")).toHaveTextContent("Loading page 2"), await n(i.getByText("Row 000")).toBeVisible(), await e.click(i.getByRole("button", { name: "Go to next page" })), await e.click(i.getByRole("button", { name: "Finish read" })), await n(await i.findByText("Row 200")).toBeVisible(), await n(i.queryByText("Row 100")).not.toBeInTheDocument(), await e.click(i.getByRole("button", { name: "Go to first page" })), await n(await i.findByText("Row 000")).toBeVisible();
} }, C = { play: async ({ canvasElement: r }) => {
	let i = t(r);
	await i.findByText("Row 000"), await e.click(i.getByRole("button", { name: "Go to next page" })), await i.findByText("Row 100"), await e.click(i.getByRole("button", { name: "Search this view" })), await e.type(i.getByRole("textbox", { name: "Search this view" }), "Row 24"), await i.findByText("Row 240"), await e.click(i.getByRole("button", { name: "Close search" })), await n(await i.findByText("Row 000")).toBeVisible(), await n(i.getByRole("spinbutton")).toHaveValue("1");
} };
export { b as EmptyResults, x as FiltersAndSorts, _ as HiddenPageState, v as Loading, S as RapidNavigation, y as RefreshAndPageBoundary, C as SearchStartsFromFirstPage, g as default };
