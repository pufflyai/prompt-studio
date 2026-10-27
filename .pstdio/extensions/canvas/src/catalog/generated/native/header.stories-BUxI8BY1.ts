// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./ellipsis-BnQWfGiA.ts";
import { t } from "./minus-BdT0RA0-.ts";
import { t as n } from "./plus-CYkLGSPS.ts";
import { t as r } from "./square-arrow-out-up-right-ChOYv0bR.ts";
import { t as i } from "./header-8InG5j3w.ts";
import { Box as a, Button as o, Icon as s, IconButton as c, Input as l, Stack as u, Tabs as d, Text as f } from "@chakra-ui/react";
import { Fragment as p, jsx as m, jsxs as h } from "react/jsx-runtime";
// packages/ui/src/components/layout/header.stories.tsx
var g = {
	title: "Components/Navigation/Header",
	component: i,
	decorators: [(e) => /* @__PURE__ */ m(a, {
		padding: "sm",
		background: "bg",
		children: /* @__PURE__ */ m(e, {})
	})]
}, _ = [
	"main",
	"narrow",
	"input"
], v = { render: () => /* @__PURE__ */ m(u, {
	gap: "md",
	children: _.map((t) => /* @__PURE__ */ m(i, {
		variant: t,
		background: "bg.muted",
		children: t === "input" ? /* @__PURE__ */ m(l, {
			placeholder: "Search tickets",
			size: "sm"
		}) : /* @__PURE__ */ h(p, { children: [/* @__PURE__ */ m(f, {
			textStyle: t === "narrow" ? "label/S/medium" : "label/M/medium",
			children: t
		}), /* @__PURE__ */ h(u, {
			direction: "row",
			gap: "xs",
			marginInlineStart: "auto",
			children: [/* @__PURE__ */ m(o, {
				size: t === "narrow" ? "xs" : "sm",
				variant: "ghost",
				children: "Action"
			}), /* @__PURE__ */ m(c, {
				size: t === "narrow" ? "xs" : "sm",
				variant: "ghost",
				"aria-label": "More actions",
				children: /* @__PURE__ */ m(s, {
					as: e,
					boxSize: "16px"
				})
			})]
		})] })
	}, t))
}) }, y = { render: () => /* @__PURE__ */ m(i, {
	variant: "input",
	background: "bg.muted",
	children: /* @__PURE__ */ m(l, {
		placeholder: "Filter results",
		size: "sm"
	})
}) }, b = { render: () => /* @__PURE__ */ h(i, {
	variant: "narrow",
	background: "bg.muted",
	children: [
		/* @__PURE__ */ m(d.Root, {
			defaultValue: "workspaces",
			size: "sm",
			variant: "subtle",
			children: /* @__PURE__ */ h(d.List, { children: [/* @__PURE__ */ m(d.Trigger, {
				value: "workspaces",
				children: "Workspaces"
			}), /* @__PURE__ */ m(c, {
				size: "2xs",
				variant: "ghost",
				"aria-label": "Add panel",
				children: /* @__PURE__ */ m(s, {
					as: n,
					boxSize: "14px"
				})
			})] })
		}),
		/* @__PURE__ */ m(c, {
			size: "2xs",
			variant: "ghost",
			"aria-label": "Attach panel",
			children: /* @__PURE__ */ m(s, {
				as: r,
				boxSize: "14px"
			})
		}),
		/* @__PURE__ */ m(c, {
			size: "2xs",
			variant: "ghost",
			"aria-label": "Minimize panel",
			children: /* @__PURE__ */ m(s, {
				as: t,
				boxSize: "14px"
			})
		})
	]
}) };
export { b as PanelControls, y as SearchInput, v as Variants, g as default };
