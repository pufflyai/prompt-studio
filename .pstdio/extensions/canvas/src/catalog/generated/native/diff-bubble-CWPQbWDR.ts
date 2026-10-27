// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Span as e } from "@chakra-ui/react";
import { jsx as t, jsxs as n } from "react/jsx-runtime";
// packages/ui/src/components/diff-viewer/diff-bubble.tsx
var r = (r) => {
	let { fileName: i, additions: a, deletions: o, additionsLabel: s, deletionsLabel: c, label: l, variant: u = "outline", size: d = "default", onClick: f, onClickFileLink: p } = r, m = d === "small";
	return /* @__PURE__ */ n(e, {
		display: "inline-flex",
		alignItems: "center",
		gap: "2xs",
		border: u === "outline" ? "1px solid" : "none",
		borderColor: "border.subtle",
		color: "fg.muted",
		paddingX: u === "outline" ? m ? "3xs" : "2xs" : "2px",
		paddingY: "1px",
		borderRadius: "xs",
		textStyle: m ? "label/S/regular" : void 0,
		cursor: f ? "pointer" : "default",
		onClick: f,
		_hover: { background: f ? "bg.muted" : "none" },
		children: [
			l,
			i && /* @__PURE__ */ t(e, {
				display: "inline-block",
				maxW: "24ch",
				truncate: !0,
				mr: "xs",
				title: i,
				onClick: (e) => {
					e.stopPropagation(), p?.();
				},
				cursor: p ? "pointer" : "default",
				_hover: {
					textDecoration: p ? "underline" : "none",
					color: p ? "fg.blue-dark" : "fg.muted"
				},
				children: i
			}),
			/* @__PURE__ */ t(e, {
				color: "fg.success",
				children: s ?? `+${a}`
			}),
			/* @__PURE__ */ t(e, {
				color: "fg.error",
				children: c ?? `-${o}`
			})
		]
	});
};
export { r as t };
