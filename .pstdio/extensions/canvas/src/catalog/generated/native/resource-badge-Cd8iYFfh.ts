// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./triangle-alert-DcqN2fDE.ts";
import { t } from "./x-DqEAa6-d.ts";
import { t as n } from "./tooltip-BweQW627.ts";
import { t as r } from "./get-file-type-icon-Bq5BxZ4Y.ts";
import { IconButton as i, Spacer as a, Text as o, chakra as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/ui/src/components/primitives/resource-badge.tsx
var u = {
	sm: {
		container: {
			height: "5",
			lineHeight: { base: "5" },
			px: "xs"
		},
		iconSize: 12,
		textStyle: "label/XS"
	},
	md: {
		container: {
			height: "6",
			lineHeight: { base: "6" },
			px: "xs"
		},
		iconSize: 14,
		textStyle: "label/S/regular"
	}
}, d = {
	neutral: {
		color: "fg",
		bg: "bg.subtle",
		borderColor: "border",
		_hover: { bg: "bg.hover" }
	},
	accent: {
		color: "var(--schub-foreground-accent)",
		bg: "var(--schub-accent-subtle)",
		borderColor: "var(--schub-accent-subtle)",
		_hover: { bg: "var(--schub-accent-subtle)" }
	}
}, f = (n) => {
	let { referenceId: r, onRemove: u } = n;
	return /* @__PURE__ */ l(s.span, {
		height: "24px",
		lineHeight: { base: "24px" },
		gap: "2xs",
		display: "flex",
		flexDirection: "row",
		alignItems: "center",
		paddingX: "xs",
		borderRadius: "9999px",
		color: "blacks.50",
		bg: "red.500",
		_hover: { bg: "red.600" },
		children: [
			/* @__PURE__ */ c(s.span, {
				mr: "xs",
				display: "inline-flex",
				children: /* @__PURE__ */ c(e, { size: 14 })
			}),
			/* @__PURE__ */ c(o, {
				maxW: { base: "17.5rem" },
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
				overflow: "hidden",
				children: "Missing Reference"
			}),
			/* @__PURE__ */ c(a, {}),
			u && /* @__PURE__ */ c(i, {
				color: "blacks.50",
				"aria-label": "Remove reference",
				size: "2xs",
				ml: "sm",
				variant: "ghost",
				_hover: { bg: "transparent" },
				onClick: (e) => {
					e.stopPropagation(), u?.(r);
				},
				children: /* @__PURE__ */ c(t, { size: 12 })
			})
		]
	});
}, p = "md", m = "neutral", h = (e) => {
	let { fileName: a, onSelect: f, onRemove: h, size: g = p, tone: _ = m, icon: v, tooltip: y, ...b } = e, x = r(a), S = u[g], C = d[_];
	return /* @__PURE__ */ l(s.span, {
		display: "flex",
		flexDirection: "row",
		alignItems: "center",
		borderWidth: "1px",
		borderRadius: "xs",
		gap: "2xs",
		cursor: f ? "pointer" : "default",
		...C,
		...S.container,
		onClick: (e) => {
			e.stopPropagation(), f?.(a);
		},
		...b,
		children: [
			/* @__PURE__ */ c(s.span, {
				display: "inline-flex",
				flexShrink: 0,
				children: v ?? /* @__PURE__ */ c(x, { size: S.iconSize })
			}),
			/* @__PURE__ */ c(n, {
				content: y ?? a,
				disabled: y === !1,
				children: /* @__PURE__ */ c(o, {
					maxW: { base: "14rem" },
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
					overflow: "hidden",
					textStyle: S.textStyle,
					children: a
				})
			}),
			h && /* @__PURE__ */ c(i, {
				"aria-label": `Remove ${a}`,
				size: "2xs",
				variant: "ghost",
				_hover: { bg: "transparent" },
				onClick: (e) => {
					e.stopPropagation(), h?.(a);
				},
				children: /* @__PURE__ */ c(t, { size: 12 })
			})
		]
	});
};
export { h as n, f as t };
