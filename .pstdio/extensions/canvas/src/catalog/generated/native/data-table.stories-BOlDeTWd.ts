// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { c as i, d as a, f as o, u as s, v as c } from "./lucide-react-DrMf1u5h.ts";
import { _ as l } from "./zap-Dajcy3HI.ts";
import { t as u } from "./archive-DozS7A-I.ts";
import { t as d } from "./building-2-B0wTT9lj.ts";
import { t as f } from "./circle-check-QpR5K4qp.ts";
import { t as p } from "./file-text-B9-uT4dU.ts";
import { t as m } from "./info-D1px5mME.ts";
import { t as h } from "./trash-2-C03vrbuo.ts";
import { S as g } from "./list-marker-width-plugin-BDROuhXk.ts";
import { t as _ } from "./collection-view-types-69xG6kJd.ts";
import { t as v } from "./data-table-BI2_ziSb.ts";
import { t as y } from "./markdown-editor-CsmXwmxe.ts";
import { a as b, i as x, r as S, t as C } from "./data-table.story-fixtures-Da0Sif93.ts";
import { useState as w } from "react";
import { Box as T, Button as E, Flex as ee, Icon as D } from "@chakra-ui/react";
import { jsx as O, jsxs as k } from "react/jsx-runtime";
import { DEFAULT_DATA_TABLE_SETTINGS as A } from "@pstdio/sdk/extensions";
// packages/ui/src/components/data-table/data-table.story-descriptions.ts
var j = {
	Invoice: "Unique invoice identifier assigned when the invoice is created.",
	Amount: "Total invoice amount before payment adjustments.",
	Status: "Current payment status reported by accounts payable.",
	Region: "Operational region responsible for this vendor relationship."
}, M = { boxSize: "14px" }, N = {
	Invoice: /* @__PURE__ */ O(D, {
		as: p,
		...M
	}),
	Vendor: /* @__PURE__ */ O(D, {
		as: i,
		...M
	}),
	"Due Date": /* @__PURE__ */ O(D, {
		as: c,
		...M
	}),
	Amount: /* @__PURE__ */ O(D, {
		as: a,
		...M
	}),
	Approved: /* @__PURE__ */ O(D, {
		as: f,
		...M
	}),
	Status: /* @__PURE__ */ O(D, {
		as: m,
		...M
	}),
	Region: /* @__PURE__ */ O(D, {
		as: s,
		...M
	}),
	Department: /* @__PURE__ */ O(D, {
		as: d,
		...M
	}),
	Priority: /* @__PURE__ */ O(D, {
		as: l,
		...M
	}),
	"Payment Method": /* @__PURE__ */ O(D, {
		as: o,
		...M
	})
}, P = {
	Invoice: "Inv",
	Vendor: "Vendor",
	"Due Date": "Due",
	"Payment Method": "Pay"
}, F = [{
	label: "Archive",
	icon: /* @__PURE__ */ O(D, {
		as: u,
		boxSize: "16px"
	}),
	onSelect: (e) => console.log("Archive rows", e)
}, {
	label: "Delete",
	destructive: !0,
	icon: /* @__PURE__ */ O(D, {
		as: h,
		boxSize: "16px"
	}),
	onSelect: (e) => console.log("Delete rows", e)
}], I = [{
	label: "Archive invoice",
	icon: /* @__PURE__ */ O(D, {
		as: u,
		boxSize: "16px"
	}),
	onSelect: (e) => console.log("Archive invoice", e)
}, {
	label: "Delete invoice",
	destructive: !0,
	icon: /* @__PURE__ */ O(D, {
		as: h,
		boxSize: "16px"
	}),
	onSelect: (e) => console.log("Delete invoice", e)
}], L = S(24).map((e) => ({
	...e,
	Amount: 1200,
	Status: x[0].Status
})), R = (e, t) => {
	let n = t.parameters?.pagePadding ?? "sm", r = t.parameters?.pageHeight;
	return /* @__PURE__ */ O(T, {
		padding: n,
		background: "bg",
		height: r,
		children: /* @__PURE__ */ O(e, {})
	});
}, z = (e) => {
	let { args: t, maxWidth: n, height: r, marginX: i } = e, [a, o] = w(null), s = (e) => {
		if (!t.enableRowActivation) return;
		let n = e.id;
		typeof n == "string" && o(n);
	};
	return /* @__PURE__ */ O(T, {
		width: "100%",
		maxWidth: n,
		height: r,
		marginX: i,
		children: /* @__PURE__ */ O(v, {
			...t,
			activeRowId: a,
			onRowClick: s
		})
	});
}, B = [
	{
		id: "name",
		label: "Name",
		alignment: "left"
	},
	{
		id: "role",
		label: "Role",
		alignment: "left"
	},
	{
		id: "status",
		label: "Status",
		alignment: "center"
	}
], V = [
	{
		id: "person-1",
		name: "Avery Chen",
		role: "Designer",
		status: "Active"
	},
	{
		id: "person-2",
		name: "Sam Rivera",
		role: "Engineer",
		status: "Active"
	},
	{
		id: "person-3",
		name: "Jordan Lee",
		role: "Researcher",
		status: "Away"
	}
], H = () => {
	let [e, t] = w(B), [n, r] = w(V);
	return /* @__PURE__ */ O(T, {
		width: "100%",
		maxWidth: "64rem",
		marginX: "auto",
		children: /* @__PURE__ */ O(v, {
			data: n,
			editMode: {
				columns: e,
				onColumnsChange: (e) => {
					t(e), r((t) => t.map((t) => ({
						id: t.id,
						...Object.fromEntries(e.map((e) => [e.id, t[e.id] ?? ""]))
					})));
				},
				onDataChange: r,
				isCellEditable: (e) => e.columnId !== "status"
			},
			fullWidth: !0,
			getRowId: (e) => String(e.id),
			isReadOnly: !1
		})
	});
}, U = () => {
	let [e, t] = w(B), [n, r] = w(V), [i, a] = w(!1);
	return /* @__PURE__ */ k(T, {
		width: "100%",
		maxWidth: "64rem",
		marginX: "auto",
		children: [/* @__PURE__ */ O(ee, {
			justifyContent: "flex-end",
			marginBottom: "xs",
			children: /* @__PURE__ */ O(E, {
				size: "sm",
				variant: "outline",
				onClick: () => a((e) => !e),
				children: i ? "View mode" : "Edit mode"
			})
		}), /* @__PURE__ */ O(v, {
			data: n,
			editMode: {
				columns: e,
				onColumnsChange: t,
				onDataChange: r
			},
			fullWidth: !0,
			getRowId: (e) => String(e.id),
			isReadOnly: !i
		})]
	});
}, W = [{
	id: "topic",
	label: "Topic",
	alignment: "left"
}, {
	id: "summary",
	label: "Rich Markdown",
	alignment: "left"
}], G = [{
	id: "note-1",
	topic: "Formatting",
	summary: "**Bold content** with *emphasis* and `inline code`."
}, {
	id: "note-2",
	topic: "Links",
	summary: "Open the [Prompt Studio site](https://prompt.studio). This longer description shows how the user can expand a compact table row when they need to read all of its content."
}], K = () => {
	let [e, t] = w(W), [n, r] = w(G);
	return /* @__PURE__ */ O(T, {
		width: "100%",
		maxWidth: "64rem",
		marginX: "auto",
		children: /* @__PURE__ */ O(v, {
			data: n,
			editMode: {
				columns: e,
				onColumnsChange: t,
				onDataChange: r,
				isCellEditable: (e) => e.columnId === "summary",
				renderHeader: (e) => /* @__PURE__ */ O(g, { value: e.label }),
				renderCell: (e) => /* @__PURE__ */ O(g, { value: String(e.value ?? "") }),
				renderCellEditor: ({ value: e, onChange: t }) => /* @__PURE__ */ O(y, {
					autoFocus: !0,
					defaultState: e,
					fullWidth: !0,
					isEditable: !0,
					padding: "xs",
					scrollable: !1,
					onChange: t
				})
			},
			fullWidth: !0,
			getRowId: (e) => String(e.id),
			isReadOnly: !1
		})
	});
}, te = () => {
	let [e, t] = w(B), [n, r] = w(V);
	return /* @__PURE__ */ O(T, {
		width: "100%",
		maxWidth: "64rem",
		marginX: "auto",
		children: /* @__PURE__ */ O(v, {
			data: n,
			editMode: {
				columns: e,
				onColumnsChange: t,
				onDataChange: r
			},
			fullWidth: !0,
			getRowId: (e) => String(e.id),
			isReadOnly: !1,
			selectionMode: "multiple",
			selectionActions: [{
				label: "Delete selected",
				destructive: !0,
				onSelect: (e) => {
					let t = new Set(e.map((e) => e.id));
					r((e) => e.filter((e) => !t.has(e.id)));
				}
			}]
		})
	});
}, q = [{
	id: "all",
	title: "All",
	settings: A,
	filter: _,
	sorts: []
}, {
	id: "active",
	title: "Active",
	settings: A,
	filter: {
		conjunction: "and",
		rules: [{
			attributeId: "status",
			condition: "is",
			value: "Active"
		}]
	},
	sorts: []
}], J = () => {
	let [e, t] = w(B), [n, r] = w(V);
	return /* @__PURE__ */ O(T, {
		width: "100%",
		maxWidth: "64rem",
		marginX: "auto",
		children: /* @__PURE__ */ O(v, {
			data: n,
			defaultViews: q,
			defaultActiveViewId: "all",
			editMode: {
				columns: e,
				onColumnsChange: t,
				onDataChange: r
			},
			fullWidth: !0,
			getRowId: (e) => String(e.id),
			isReadOnly: !1,
			toolbarStorageKey: "storybook-editable-data-table-with-views"
		})
	});
}, Y = {
	title: "Components/Data Display/Data Table",
	component: v,
	decorators: [R],
	args: {
		data: x,
		hiddenColumns: ["id"],
		columnIcons: N,
		toolbarStorageKey: "storybook-data-table-default"
	}
}, X = {
	render: (e) => /* @__PURE__ */ O(z, {
		args: e,
		maxWidth: "960px",
		height: "420px",
		marginX: "auto"
	}),
	play: async ({ canvasElement: i }) => {
		let a = e(i).getByRole("button", { name: "Add view" }), o = e(document.body);
		await n.hover(a), await r(await o.findByRole("tooltip")).toHaveTextContent("Add view"), await n.unhover(a), await t(() => r(o.queryByRole("tooltip")).not.toBeInTheDocument());
	}
}, Z = {
	args: {
		data: S(96),
		initialPageSize: 50,
		columnStats: {
			Invoice: { type: "unique" },
			Amount: {
				type: "histogram",
				bins: 12
			},
			Status: {
				type: "top-values",
				limit: 2
			},
			Region: {
				type: "top-values",
				limit: 2
			}
		},
		toolbarStorageKey: "storybook-data-table-column-stats"
	},
	render: (e) => /* @__PURE__ */ O(z, {
		args: e,
		maxWidth: "1180px",
		height: "560px",
		marginX: "auto"
	}),
	play: async ({ canvasElement: t }) => {
		let i = e(t);
		await r(await i.findByLabelText("Distribution for Amount")).toBeVisible(), await n.click(i.getByLabelText("Display settings"));
		let a = e(document.body), o = e(a.getByRole("dialog")), s = o.getByRole("checkbox", { name: "Invoice" });
		await n.click(s), await r(s).not.toBeChecked(), await r(i.queryByRole("columnheader", { name: "Invoice" })).not.toBeInTheDocument(), await n.click(s), await r(o.getByRole("checkbox", { name: "Invoice" })).toBeChecked(), await r(i.getByRole("columnheader", { name: "Invoice" })).toBeInTheDocument();
		let c = o.getByRole("switch", { name: /^Statistics/ });
		await r(c).toBeChecked(), await n.click(a.getByText("Statistics", { exact: !0 })), await r(c).not.toBeChecked(), await r(t.querySelector(".data-table-stats-row")).not.toBeInTheDocument();
	}
}, Q = {
	args: {
		data: L,
		initialPageSize: 20,
		columnStats: {
			Amount: {
				type: "histogram",
				bins: 8
			},
			Status: {
				type: "top-values",
				limit: 3
			}
		},
		toolbarStorageKey: "storybook-data-table-single-value-stats"
	},
	render: (e) => /* @__PURE__ */ O(z, {
		args: e,
		maxWidth: "1080px",
		height: "520px",
		marginX: "auto"
	}),
	play: async ({ canvasElement: t }) => {
		let n = e(t);
		await r(await n.findByText("Paid", { selector: "[data-single-value-stat] *" })).toBeVisible(), await r(n.getByText(new Intl.NumberFormat(void 0, { maximumFractionDigits: 2 }).format(1200))).toBeInTheDocument(), await r(n.getByText("Paid", { selector: "[data-single-value-stat] *" })).toBeInTheDocument(), await r(n.queryByLabelText("Distribution for Amount")).not.toBeInTheDocument(), await r(n.queryByLabelText("Paid: 100%")).not.toBeInTheDocument();
	}
}, ne = {
	args: {
		data: S(24),
		columnDescriptions: j,
		toolbarStorageKey: "storybook-data-table-column-descriptions"
	},
	render: (e) => /* @__PURE__ */ O(z, {
		args: e,
		maxWidth: "1080px",
		height: "480px",
		marginX: "auto"
	})
}, re = {
	args: {
		data: b,
		toolbarStorageKey: "storybook-data-table-full-height"
	},
	parameters: {
		pagePadding: 0,
		pageHeight: "100vh"
	},
	render: (e) => /* @__PURE__ */ O(z, {
		args: e,
		height: "100%"
	})
}, ie = {
	args: {
		data: S(96),
		initialPageSize: 10,
		pageSizeOptions: [
			10,
			20,
			50
		],
		compactHeaders: P,
		toolbarStorageKey: "storybook-data-table-paginated"
	},
	render: (e) => /* @__PURE__ */ O(z, {
		args: e,
		maxWidth: "1080px",
		height: "520px",
		marginX: "auto"
	})
}, ae = {
	args: {
		data: S(48),
		initialPageSize: 10,
		selectionMode: "multiple",
		selectionActions: F,
		compactHeaders: P,
		toolbarStorageKey: "storybook-data-table-selectable-rows"
	},
	render: (e) => /* @__PURE__ */ O(z, {
		args: e,
		maxWidth: "1080px",
		height: "520px",
		marginX: "auto"
	}),
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = i.getByTestId("collection-view-bar"), o = i.getAllByLabelText("Select row");
		await r(e(a).queryByText("48 rows")).not.toBeInTheDocument(), await n.click(o[0]), await n.click(o[1]);
		let s = i.getByRole("toolbar", { name: "Selection actions" }), c = s.parentElement;
		await r(s).toHaveTextContent("2 rows selected"), await r(c).not.toBeNull(), await r(getComputedStyle(c).position).toBe("absolute"), await r(e(a).getByText("All")).toBeInTheDocument();
	}
}, oe = {
	args: {
		data: S(36),
		initialPageSize: 10,
		rowActions: I,
		compactHeaders: P,
		toolbarStorageKey: "storybook-data-table-row-actions"
	},
	render: (e) => /* @__PURE__ */ O(z, {
		args: e,
		maxWidth: "1080px",
		height: "520px",
		marginX: "auto"
	})
}, $ = {
	args: {
		data: [{
			Invoice: "INV-001",
			Status: "Open"
		}, {
			Invoice: "INV-002",
			Status: "Archived"
		}],
		getRowActions: (e) => e.Status === "Archived" ? [] : I,
		compactHeaders: P,
		toolbarStorageKey: "storybook-data-table-dynamic-row-actions"
	},
	render: (e) => /* @__PURE__ */ O(z, {
		args: e,
		maxWidth: "1080px",
		height: "520px",
		marginX: "auto"
	}),
	play: async ({ canvasElement: i }) => {
		let a = e(i).getAllByRole("row").slice(1);
		await n.click(e(a[0]).getByRole("button", { name: "Row actions" })), await t(() => r(e(document.body).getByRole("menuitem", { name: "Archive invoice" })).toBeVisible()), await n.keyboard("{Escape}"), await r(e(a[1]).queryByRole("button", { name: "Row actions" })).not.toBeInTheDocument();
	}
}, se = {
	args: {
		data: S(36),
		initialPageSize: 10,
		compactHeaders: P,
		enableRowActivation: !0,
		toolbarStorageKey: "storybook-data-table-row-activation"
	},
	render: (e) => /* @__PURE__ */ O(z, {
		args: e,
		maxWidth: "1080px",
		height: "520px",
		marginX: "auto"
	})
}, ce = { render: () => /* @__PURE__ */ O(H, {}) }, le = { render: () => /* @__PURE__ */ O(K, {}) }, ue = { render: () => /* @__PURE__ */ O(U, {}) }, de = { render: () => /* @__PURE__ */ O(te, {}) }, fe = { render: () => /* @__PURE__ */ O(J, {}) }, pe = {
	args: {
		data: S(48),
		initialPageSize: 10,
		pageSizeOptions: [
			10,
			20,
			30
		],
		selectionMode: "multiple",
		selectionActions: F,
		rowActions: I,
		compactHeaders: P,
		toolbarStorageKey: "storybook-data-table-tag-rich-rows"
	},
	render: (e) => /* @__PURE__ */ O(z, {
		args: e,
		maxWidth: "1180px",
		height: "560px",
		marginX: "auto"
	})
}, me = {
	args: {
		data: C,
		initialPageSize: 10,
		pageSizeOptions: [
			10,
			20,
			30
		],
		selectionMode: "multiple",
		selectionActions: F,
		rowActions: I,
		compactHeaders: P,
		toolbarStorageKey: "storybook-data-table-column-management"
	},
	render: (e) => /* @__PURE__ */ O(z, {
		args: e,
		maxWidth: "1180px",
		height: "560px",
		marginX: "auto"
	})
};
export { ne as ColumnDescriptions, me as ColumnManagement, Z as ColumnStats, X as Default, $ as DynamicRowActions, ce as EditMode, de as EditableSelectableRows, fe as EditableWithViews, re as FullHeight, ue as ModeToggle, ie as Paginated, le as RichTextEditMode, oe as RowActions, se as RowActivation, ae as SelectableRows, Q as SingleValueStats, pe as TagRichRows, Y as default };
