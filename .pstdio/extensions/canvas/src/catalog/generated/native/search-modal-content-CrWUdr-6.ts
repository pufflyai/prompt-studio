// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./scroll-area-I7hjn89T.ts";
import { Box as t, CloseButton as n, Dialog as r, Input as i, InputGroup as a } from "@chakra-ui/react";
import { Fragment as o, jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/overlays/search-modal-content.tsx
var l = (e) => e != null, u = (e, t) => e && t ? "space-between" : t ? "flex-end" : "flex-start", d = (d) => {
	let { children: f, searchValue: p, searchPlaceholder: m, searchAriaLabel: h = m, searchIcon: g, searchInputRef: _, searchAutoFocus: v, showSearch: y = !0, title: b, showCloseButton: x = !1, closeButtonLabel: S = "Close", bodyBefore: C, footerStart: w, footerEnd: T, scrollAreaProps: E, onSearchChange: D, onSearchKeyDown: O } = d, k = l(w), A = l(T), { maxH: j = "24rem", showHorizontalScrollbar: M = !1, ...N } = E ?? {};
	return /* @__PURE__ */ c(o, { children: [
		/* @__PURE__ */ c(r.Header, {
			px: "0",
			py: "0",
			minH: "3rem",
			borderBottomWidth: "1px",
			borderBottomColor: "border.subtle",
			children: [
				b && /* @__PURE__ */ s(r.Title, {
					srOnly: y,
					px: "sm",
					py: "sm",
					children: b
				}),
				y && /* @__PURE__ */ s(a, {
					startElement: g,
					width: "full",
					children: /* @__PURE__ */ s(i, {
						ref: _,
						value: p,
						placeholder: m,
						"aria-label": h,
						autoComplete: "off",
						autoFocus: v,
						mx: "xs",
						h: "3rem",
						variant: "borderless",
						onChange: (e) => D(e.target.value),
						onKeyDown: O
					})
				}),
				x ? /* @__PURE__ */ s(r.CloseTrigger, {
					asChild: !0,
					children: /* @__PURE__ */ s(n, {
						"aria-label": S,
						size: "sm",
						mr: "2"
					})
				}) : null
			]
		}),
		/* @__PURE__ */ c(r.Body, {
			p: "0",
			children: [C, /* @__PURE__ */ s(e, {
				maxH: j,
				showHorizontalScrollbar: M,
				...N,
				children: f
			})]
		}),
		k || A ? /* @__PURE__ */ c(r.Footer, {
			justifyContent: u(k, A),
			px: "sm",
			py: "xs",
			borderTopWidth: "1px",
			borderTopColor: "border.subtle",
			children: [k ? /* @__PURE__ */ s(t, {
				minW: "0",
				children: w
			}) : null, A ? /* @__PURE__ */ s(t, {
				flexShrink: 0,
				children: T
			}) : null]
		}) : null
	] });
};
export { d as t };
