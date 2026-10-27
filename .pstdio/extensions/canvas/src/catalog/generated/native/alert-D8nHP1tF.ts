// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./x-DqEAa6-d.ts";
import { t } from "./scroll-area-I7hjn89T.ts";
import { t as n } from "./copy-button-BuvxTT0_.ts";
import * as r from "react";
import { Alert as i, Box as a, ButtonPropsProvider as o, HStack as s, IconButton as c } from "@chakra-ui/react";
import { jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/ui/src/components/primitives/alert.tsx
var d = r.forwardRef(function(d, f) {
	let { title: p, children: m, icon: h, startElement: g, endElement: _, onClose: v, closeLabel: y = "Dismiss", ...b } = d, x = r.useRef(null), S = b.status === "error";
	return /* @__PURE__ */ u(i.Root, {
		ref: f,
		...b,
		children: [g || /* @__PURE__ */ l(i.Indicator, { children: h }), /* @__PURE__ */ l(o, {
			value: {
				variant: "ghost",
				size: "2xs"
			},
			children: /* @__PURE__ */ u(i.Content, { children: [/* @__PURE__ */ u(a, {
				position: "relative",
				minW: "0",
				minH: "0",
				flex: "1",
				children: [/* @__PURE__ */ l(t, {
					contentRef: x,
					viewportProps: { overscrollBehavior: "contain" },
					children: /* @__PURE__ */ u(a, {
						paddingEnd: v ? "xl" : void 0,
						children: [/* @__PURE__ */ l(i.Title, { children: p }), m ? /* @__PURE__ */ l(i.Description, { children: m }) : null]
					})
				}), v ? /* @__PURE__ */ l(c, {
					"aria-label": y,
					position: "absolute",
					top: "0",
					right: "xs",
					onClick: v,
					children: /* @__PURE__ */ l(e, {})
				}) : null]
			}), _ || S ? /* @__PURE__ */ u(s, {
				gap: "2xs",
				pt: "xs",
				justifyContent: "flex-end",
				alignItems: "flex-end",
				flexWrap: "wrap",
				minW: "0",
				flexShrink: "0",
				children: [S ? /* @__PURE__ */ l(n, {
					size: "2xs",
					label: "Copy error message",
					text: () => x.current?.innerText ?? ""
				}) : null, _]
			}) : null] })
		})]
	});
});
export { d as t };
