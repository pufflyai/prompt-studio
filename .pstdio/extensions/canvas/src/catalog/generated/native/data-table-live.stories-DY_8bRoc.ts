// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./data-table-BI2_ziSb.ts";
import { useEffect as a, useState as o } from "react";
import { Box as s, Text as c } from "@chakra-ui/react";
import { jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/ui/src/components/data-table/data-table-live.stories.tsx
var d = () => {
	let [e, t] = o(0), [n, r] = o();
	return a(() => {
		let e = setInterval(() => t((e) => e + 1), 1e3);
		return () => clearInterval(e);
	}, []), /* @__PURE__ */ u(s, {
		height: "full",
		padding: "md",
		children: [
			/* @__PURE__ */ u(c, {
				"data-testid": "data-revision",
				children: ["Latest revision: ", e]
			}),
			/* @__PURE__ */ u(c, {
				"data-testid": "opened-revision",
				children: ["Opened revision: ", n ?? "None"]
			}),
			/* @__PURE__ */ l(i, {
				data: [{
					id: "invoice",
					Invoice: "INV-001",
					Revision: e
				}],
				hiddenColumns: ["id"],
				selectionMode: "multiple",
				getRowId: (e) => String(e.id),
				getRowActions: () => [{
					label: "Open invoice",
					onSelect: (e) => r(Number(e.Revision))
				}],
				toolbarStorageKey: "storybook-live-row-actions"
			})
		]
	});
}, f = {
	title: "Components/Data Display/Data Table/Live updates",
	component: d
}, p = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ l(d, {}),
	play: async ({ canvasElement: i }) => {
		let a = e(i);
		await n.click(a.getByLabelText("Select row"));
		let o = a.getByRole("button", { name: "Row actions" });
		await n.click(o);
		let s = a.getByTestId("data-revision").textContent;
		await t(() => r(a.getByTestId("data-revision").textContent).not.toBe(s), { timeout: 2e3 }), await r(e(a.getByLabelText("Select row")).getByRole("checkbox")).toBeChecked();
		let c = e(document.body).getByRole("menuitem", { name: "Open invoice" });
		await r(c).toBeVisible(), await n.click(c);
		let l = Number(a.getByTestId("opened-revision").textContent?.split(": ")[1]);
		await r(l).toBeGreaterThan(Number(s?.split(": ")[1]));
	}
}, m = () => {
	let [e, t] = o(!1);
	return /* @__PURE__ */ u(s, {
		height: "full",
		padding: "md",
		children: [/* @__PURE__ */ l(c, { children: e ? "Opened invoice" : "Select an invoice" }), /* @__PURE__ */ l(i, {
			data: Array.from({ length: 5 }, (e, t) => ({
				Invoice: `INV-00${t + 1}`,
				Amount: t + 1
			})),
			columnStats: {
				Invoice: {
					type: "top-values",
					limit: 5
				},
				Amount: { type: "histogram" }
			},
			defaultSettings: { showStats: !0 },
			onRowClick: () => t(!0),
			toolbarStorageKey: "storybook-statistics-row-activation"
		})]
	});
}, h = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ l(m, {}),
	play: async ({ canvasElement: t }) => {
		let i = e(t);
		await n.click(await i.findByRole("cell", { name: "INV-001" })), await r(i.getByText("Opened invoice", { exact: !0 })).toBeVisible();
	}
};
export { p as RowActionsDuringRefresh, h as RowActivationWithStatistics, f as default };
