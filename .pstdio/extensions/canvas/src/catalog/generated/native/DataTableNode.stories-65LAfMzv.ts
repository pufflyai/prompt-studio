// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./markdown-editor-CsmXwmxe.ts";
import { t as i } from "./rich-message-Cb2R7n2r.ts";
import { Fragment as a, jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/ui/src/components/rich-text/shared/nodes/DataTableNode.stories.tsx
var c = {
	title: "Patterns/Chat/Data Table Node",
	component: i,
	parameters: {
		layout: "padded",
		docs: { description: { component: "Chat tables wrap cells and hide row numbers by default. Display settings can change wrapping for each table independently." } }
	}
}, l = "# DataTableNode Demo\n\nThis demonstrates how markdown tables are rendered using the new DataTableNode instead of editable table nodes.\n\n## Simple Table\n\n| Name | Age | Department |\n|------|-----|------------|\n| Alice| 28  | Engineering|\n| Bob  | 34  | Design     |\n| Carol| 31  | Marketing  |\n\n## Data Types Table\n\n| Field | Value | Type | Active |\n|-------|-------|------|--------|\n| Temperature | 23.5 | number | true |\n| Status | Running | string | true |\n| Count | 42 | number | false |\n| Mode | Auto | string | true |\n\nThis table shows different data types that are properly handled by the DataTable component with appropriate icons and formatting.\n", u = { args: {
	defaultState: l,
	debug: !1
} }, d = {
	args: {
		defaultState: "| Task | Details |\n| --- | --- |\n| Review | Read the proposed changes and confirm that the shared tools work together for people who never read the code. |",
		fullWidth: !0
	},
	parameters: { viewport: { defaultViewport: "mobile1" } },
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = e(r.ownerDocument.body), o = await i.findByRole("cell", { name: /Read the proposed changes/ });
		await n(r.querySelector("[data-column-id=\"rowIndex\"]")).toBeNull(), await n(getComputedStyle(o).whiteSpace).toBe("normal"), await t.click(i.getByRole("button", { name: "Display settings" }));
		let s = await a.findByRole("switch", { name: "Wrap rows" });
		await n(s).toBeChecked(), await t.click(a.getByText("Wrap rows", { exact: !0 })), await n(getComputedStyle(o).whiteSpace).toBe("nowrap"), await t.click(a.getByText("Wrap rows", { exact: !0 })), await t.keyboard("{Escape}");
	}
}, f = {
	render: () => /* @__PURE__ */ s(a, { children: [
		/* @__PURE__ */ o(r, {
			defaultState: "| Task | Details |\n| --- | --- |\n| Review | Editor table |",
			isEditable: !0
		}),
		/* @__PURE__ */ o(i, {
			defaultState: "| Task | Details |\n| --- | --- |\n| Review | First chat table |",
			fullWidth: !0
		}),
		/* @__PURE__ */ o(i, {
			defaultState: "| Task | Details |\n| --- | --- |\n| Review | Second chat table |",
			fullWidth: !0
		})
	] }),
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = e(r.ownerDocument.body);
		await i.findByRole("cell", { name: "Second chat table" });
		let o = r.querySelectorAll("table[data-edit-mode=\"true\"]");
		await n(o[0]?.querySelector("[data-column-id=\"rowIndex\"]")).not.toBeNull(), await n(o[1]?.querySelector("[data-column-id=\"rowIndex\"]")).toBeNull(), await n(o[2]?.querySelector("[data-column-id=\"rowIndex\"]")).toBeNull();
		let s = i.getByRole("cell", { name: "First chat table" }), c = i.getByRole("cell", { name: "Second chat table" });
		await n(getComputedStyle(s).whiteSpace).toBe("normal"), await n(getComputedStyle(c).whiteSpace).toBe("normal"), await t.click(i.getAllByRole("button", { name: "Display settings" })[1]);
		let l = e(await a.findByRole("dialog"));
		await t.click(l.getByText("Wrap rows", { exact: !0 })), await n(getComputedStyle(s).whiteSpace).toBe("nowrap"), await n(getComputedStyle(c).whiteSpace).toBe("normal"), await t.keyboard("{Escape}");
	}
}, p = { args: {
	defaultState: l,
	debug: !0
} };
export { p as DebugMode, f as IndependentTableViews, u as TableInRichText, d as WrappedChatTable, c as default };
