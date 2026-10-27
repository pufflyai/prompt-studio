// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
/* empty css                    */
import { Box as e, Skeleton as t, Stack as n, Table as r, Text as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
// packages/ui/src/components/data-table/data-table-skeleton.tsx
var s = [
	"70%",
	"45%",
	"60%",
	"35%",
	"55%"
], c = (e) => {
	let { columns: n, columnCount: c = 3, rowCount: l = 5 } = e, u = n && n.length > 0 ? n : Array.from({ length: c }, (e, t) => ({
		id: `column-${t + 1}`,
		label: ""
	}));
	return /* @__PURE__ */ o(r.Root, {
		className: "data-table full-width",
		width: "100%",
		children: [/* @__PURE__ */ a(r.Header, { children: /* @__PURE__ */ a(r.Row, {
			className: "data-table-column-header-row",
			borderRight: "1px solid",
			borderColor: "border.subtle",
			children: u.map((e) => /* @__PURE__ */ a(r.ColumnHeader, {
				textTransform: "none",
				borderRight: "1px solid",
				_last: { borderRight: "none" },
				borderColor: "border.subtle",
				paddingX: "xs",
				paddingY: "xs",
				whiteSpace: "nowrap",
				children: e.label ? /* @__PURE__ */ a(i, {
					as: "div",
					textStyle: "label/S/medium",
					lineHeight: "1.2",
					truncate: !0,
					children: e.label
				}) : /* @__PURE__ */ a(t, {
					height: "12px",
					width: "4rem",
					borderRadius: "xs"
				})
			}, e.id))
		}) }), /* @__PURE__ */ a(r.Body, { children: Array.from({ length: l }, (e, n) => /* @__PURE__ */ a(r.Row, { children: u.map((e, i) => /* @__PURE__ */ a(r.Cell, {
			padding: "xs",
			borderRight: "1px solid",
			borderColor: "border.subtle",
			_last: { borderRight: "none" },
			borderBottom: "none",
			children: /* @__PURE__ */ a(t, {
				height: "14px",
				width: s[(n + i) % s.length],
				borderRadius: "xs"
			})
		}, e.id)) }, n)) })]
	});
}, l = {
	title: "Components/Data Display/Data Table",
	component: c
}, u = { render: () => /* @__PURE__ */ o(n, {
	width: "100%",
	maxWidth: "820px",
	marginX: "auto",
	padding: "sm",
	gap: "md",
	background: "bg",
	children: [/* @__PURE__ */ o(e, { children: [/* @__PURE__ */ a(i, {
		textStyle: "label/S/medium",
		marginBottom: "xs",
		children: "Known columns: real headers render instantly, only the rows shimmer."
	}), /* @__PURE__ */ a(c, { columns: [
		{
			id: "name",
			label: "Name"
		},
		{
			id: "status",
			label: "Status"
		},
		{
			id: "amount",
			label: "Amount"
		}
	] })] }), /* @__PURE__ */ o(e, { children: [/* @__PURE__ */ a(i, {
		textStyle: "label/S/medium",
		marginBottom: "xs",
		children: "Unknown columns: header cells shimmer too."
	}), /* @__PURE__ */ a(c, {
		columnCount: 4,
		rowCount: 3
	})] })]
}) };
export { u as LoadingSkeleton, l as default };
