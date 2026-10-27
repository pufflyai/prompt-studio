// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./file-text-B9-uT4dU.ts";
import { t as n } from "./folder-DJ8ZbA4G.ts";
import { t as r } from "./list-row-BhxGCvIh.ts";
import { Box as i, HStack as a, Kbd as o, Stack as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/ui/src/components/list-row/list-row-full-width.stories.tsx
var u = {
	title: "Components/Data Display/List Row/Full Width",
	component: r,
	parameters: { layout: "padded" }
}, d = { render: () => /* @__PURE__ */ c(i, {
	maxW: "32rem",
	borderWidth: "1px",
	borderColor: "border.subtle",
	overflow: "hidden",
	children: /* @__PURE__ */ l(s, {
		gap: "0",
		children: [/* @__PURE__ */ c(r, {
			variant: "full-width",
			id: "palette-entry",
			label: "Open command palette",
			description: "Global commands",
			icon: /* @__PURE__ */ c(t, { size: 14 }),
			endContent: /* @__PURE__ */ l(a, {
				gap: "shortcut-key-gap",
				children: [/* @__PURE__ */ c(o, {
					size: "sm",
					children: "mod"
				}), /* @__PURE__ */ c(o, {
					size: "sm",
					children: "K"
				})]
			}),
			isSelected: !0
		}), /* @__PURE__ */ c(r, {
			variant: "full-width",
			id: "project-entry",
			label: "Prompt Studio",
			description: "/Users/au-re/Documents/Projects/prompt-studio",
			icon: /* @__PURE__ */ c(n, { size: 14 }),
			endContent: /* @__PURE__ */ c(e, { size: 14 })
		})]
	})
}) };
export { d as OverlayRows, u as default };
