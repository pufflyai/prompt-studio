// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, n as t, o as n, s as r, t as i } from "./test-CYwQ_LKY.ts";
import { t as a } from "./workbench-core-N58OeDyx.ts";
import { t as o } from "./workbench-story-B6F8bQqu.ts";
// packages/pstdio-workbench/src/examples/data-table-renderer/data-table-scrolling.stories.tsx
var s = a();
s.registerModule({
	id: "table-scrolling",
	activate(e) {
		e.views.registerView({
			id: "table-scrolling.rows",
			title: "Workspaces",
			body: {
				kind: "dataTable",
				columns: [{
					id: "name",
					label: "Workspace",
					type: "string"
				}],
				initialPageSize: 50,
				defaultFilter: {
					conjunction: "and",
					rules: [{
						attributeId: "name",
						condition: "contains",
						value: "Workspace"
					}]
				},
				executeQuery: () => ({ rows: Array.from({ length: 53 }, (e, t) => ({
					id: `workspace-${t + 1}`,
					values: { name: `Workspace ${t + 1}` }
				})) })
			}
		}), e.shellPlacements.registerPlacement({
			id: "table-scrolling.rows",
			region: "main",
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: "table-scrolling.rows"
				}
			}
		});
	}
});
var c = {
	title: "pstdio-workbench/Reference/Core API/Native data table scrolling",
	component: o,
	args: { workbench: s },
	parameters: {
		layout: "fullscreen",
		controls: { disable: !0 }
	},
	tags: ["!manifest"]
}, l = { play: async ({ canvasElement: a }) => {
	let o = r(a);
	await o.findByRole("cell", { name: "Workspace 1" });
	let s = await o.findByRole("table"), c = s.closest("[data-part='viewport']"), l = o.getByTestId("collection-view-bar"), u = o.getByTestId("collection-view-criteria"), d = o.getByRole("button", { name: "Go to next page" }).parentElement.parentElement, f = l.getBoundingClientRect().top, p = u.getBoundingClientRect().top, m = d.getBoundingClientRect().bottom, h = o.getByRole("region", { name: "Main" });
	await i(m).toBeLessThanOrEqual(h.getBoundingClientRect().bottom), await i(c.scrollHeight).toBeGreaterThan(c.clientHeight), c.scrollTop = c.scrollHeight, await t.scroll(c), await n(() => i(c.scrollTop).toBeGreaterThan(0)), await i(l.getBoundingClientRect().top).toBe(f), await i(u.getBoundingClientRect().top).toBe(p), await i(d.getBoundingClientRect().bottom).toBe(m), await i(s.querySelector("thead tr").getBoundingClientRect().top).toBeGreaterThanOrEqual(c.getBoundingClientRect().top), await e.click(o.getByRole("button", { name: "Go to last page" })), await i(await o.findByRole("cell", { name: "Workspace 53" })).toBeVisible(), await i(d.getBoundingClientRect().bottom).toBe(m), await e.click(o.getByRole("button", { name: "Search this view" })), await e.type(o.getByRole("textbox", { name: "Search this view" }), "missing workspace"), await i(await o.findByRole("button", { name: "Clear search" })).toBeVisible(), await i(l.getBoundingClientRect().top).toBe(f), await e.click(o.getByRole("button", { name: "Clear search" })), await i(await o.findByRole("cell", { name: "Workspace 53" })).toBeVisible();
	let g = o.getByRole("button", { name: "Go to next page" }).parentElement.parentElement;
	await i(g.getBoundingClientRect().bottom).toBe(m);
} };
export { l as PinnedChrome, c as default };
