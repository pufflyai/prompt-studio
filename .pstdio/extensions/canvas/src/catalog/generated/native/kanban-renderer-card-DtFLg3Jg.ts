// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./highlighted-text-CaWxQuWj.ts";
import { t } from "./workspace-badge-C5sEf_C9.ts";
import { t as n } from "./kanban-renderer-attribute-badge-C8XDAdt5.ts";
import { HStack as r, Stack as i, Text as a, Wrap as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-card.tsx
var l = (l) => {
	let { eyebrow: u, title: d, highlight: f = "", badges: p = [], customSlots: m = [], workspaceBadge: h, isSelected: g = !1, draggable: _, onBadgeChange: v, onDragStart: y, onDragEnd: b, onClick: x } = l, S = p.length > 0 || m.length > 0;
	return /* @__PURE__ */ c(i, {
		gap: "xs",
		padding: "compact",
		borderRadius: "compact",
		borderWidth: "1px",
		borderColor: g ? "border.accent" : "border",
		width: "100%",
		background: "bg",
		transition: "border-color 0.2s ease-in-out, background 0.2s ease-in-out",
		_hover: { borderColor: g ? "border.accent" : "border.accent-light" },
		cursor: _ ? "grab" : x ? "pointer" : "default",
		draggable: _,
		onDragStart: y,
		onDragEnd: b,
		onClick: x ? (e) => {
			e.defaultPrevented || e.target instanceof Node && e.currentTarget.contains(e.target) && x?.();
		} : void 0,
		"data-selected": g ? "true" : void 0,
		"data-testid": "renderer-card",
		"data-board-pan-ignore": !0,
		children: [
			u || h ? /* @__PURE__ */ c(r, {
				minW: "0",
				gap: "2xs",
				children: [u ? /* @__PURE__ */ s(a, {
					textStyle: "label/XS",
					color: "fg.muted",
					fontFamily: "mono",
					truncate: !0,
					children: /* @__PURE__ */ s(e, {
						text: u,
						query: f
					})
				}) : null, /* @__PURE__ */ s(r, {
					marginLeft: "auto",
					children: h ? /* @__PURE__ */ s(t, { ...h }) : null
				})]
			}) : null,
			/* @__PURE__ */ s(a, {
				textStyle: "paragraph/S/regular",
				minW: "0",
				overflowWrap: "anywhere",
				children: /* @__PURE__ */ s(e, {
					text: d,
					query: f
				})
			}),
			S && /* @__PURE__ */ c(o, {
				gap: "2xs",
				children: [p.map((e) => /* @__PURE__ */ s(n, {
					badge: e,
					onChange: v
				}, e.attributeId)), m]
			})
		]
	});
};
export { l as t };
