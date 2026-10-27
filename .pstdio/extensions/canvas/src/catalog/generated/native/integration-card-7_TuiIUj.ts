// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { n as t, t as n } from "./simple-card-OilaHrM-.ts";
import { Badge as r, Box as i, Button as a, HStack as o, Icon as s, Stack as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/ui/src/components/primitives/integration-card.tsx
var f = (f) => {
	let { icon: p, name: m, description: h, id: g, version: _, category: v, active: y = !1, actionLabel: b } = f;
	return /* @__PURE__ */ u(n, { children: /* @__PURE__ */ u(t, { children: /* @__PURE__ */ d(o, {
		gap: "4",
		alignItems: "flex-start",
		children: [
			/* @__PURE__ */ u(s, {
				boxSize: "1em",
				fontSize: "2xl",
				flexShrink: "0",
				color: "fg.muted",
				children: p
			}),
			/* @__PURE__ */ u(i, {
				flex: "1",
				minW: "0",
				children: /* @__PURE__ */ d(c, {
					gap: "1",
					children: [/* @__PURE__ */ d(o, {
						gap: "2",
						flexWrap: "wrap",
						children: [
							/* @__PURE__ */ u(l, {
								textStyle: "sm",
								fontWeight: "semibold",
								children: m
							}),
							/* @__PURE__ */ u(r, {
								size: "sm",
								variant: "outline",
								children: g
							}),
							_ && /* @__PURE__ */ d(r, {
								size: "sm",
								variant: "outline",
								children: ["v", _]
							}),
							v && /* @__PURE__ */ u(r, {
								size: "sm",
								variant: "outline",
								children: v
							})
						]
					}), /* @__PURE__ */ u(l, {
						color: "fg.muted",
						children: h
					})]
				})
			}),
			/* @__PURE__ */ d(a, {
				type: "button",
				disabled: y,
				size: "sm",
				variant: "outline",
				colorPalette: "gray",
				bg: "bg",
				flexShrink: "0",
				children: [y && /* @__PURE__ */ u(s, {
					color: "fg.success",
					children: /* @__PURE__ */ u(e, {})
				}), b ?? (y ? "Active" : "Connect")]
			})
		]
	}) }) });
};
export { f as t };
