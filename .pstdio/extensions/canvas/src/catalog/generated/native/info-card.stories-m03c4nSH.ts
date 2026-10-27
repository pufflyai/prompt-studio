// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./ellipsis-BnQWfGiA.ts";
import { t } from "./play-crlvkPMv.ts";
import { t as n } from "./settings-DjkPFa7Q.ts";
import { t as r } from "./shield-check-8abL6TC4.ts";
import { t as i } from "./sparkles-GpXFEeOw.ts";
import { t as a } from "./list-row-BhxGCvIh.ts";
import { t as o } from "./info-card-BkKWOZQJ.ts";
import { Badge as s, Box as c, Button as l, HStack as u, Icon as d, Menu as f, Text as p } from "@chakra-ui/react";
import { jsx as m, jsxs as h } from "react/jsx-runtime";
// packages/ui/src/components/primitives/info-card.stories.tsx
var g = {
	title: "Components/Data Display/Info Card",
	component: o,
	decorators: [(e) => /* @__PURE__ */ m(c, {
		padding: "sm",
		background: "bg",
		children: /* @__PURE__ */ m(e, {})
	})],
	args: {
		title: "Fraud review pipeline",
		description: "Checks incoming claims against historical activity for anomalies.",
		infoItems: [{
			label: "Created",
			value: "Sep 18, 2024"
		}, {
			label: "Updated",
			value: "Oct 2, 2024"
		}]
	}
}, _ = { render: (e) => /* @__PURE__ */ m(c, {
	maxWidth: "520px",
	children: /* @__PURE__ */ m(o, { ...e })
}) }, v = { render: (s) => {
	let g = [/* @__PURE__ */ m(l, {
		size: "md",
		variant: "primary",
		children: /* @__PURE__ */ h(u, {
			gap: "2px",
			children: [/* @__PURE__ */ m(d, {
				as: t,
				boxSize: "18px"
			}), /* @__PURE__ */ m(p, { children: "Run" })]
		})
	}, "run"), /* @__PURE__ */ h(f.Root, { children: [/* @__PURE__ */ m(f.Trigger, {
		asChild: !0,
		children: /* @__PURE__ */ m(l, {
			size: "md",
			variant: "outline",
			"aria-label": "Options menu",
			children: /* @__PURE__ */ m(d, {
				as: e,
				boxSize: "18px"
			})
		})
	}), /* @__PURE__ */ m(f.Positioner, { children: /* @__PURE__ */ h(f.Content, {
		minW: "240px",
		bg: "bg",
		children: [
			/* @__PURE__ */ m(f.Item, {
				value: "favorite",
				asChild: !0,
				children: /* @__PURE__ */ m(a, {
					asChild: !0,
					variant: "full-width",
					label: "Feature pipeline",
					description: "Pin to overview",
					icon: /* @__PURE__ */ m(d, {
						as: i,
						boxSize: "16px"
					})
				})
			}),
			/* @__PURE__ */ m(f.Item, {
				value: "restrict",
				asChild: !0,
				children: /* @__PURE__ */ m(a, {
					asChild: !0,
					variant: "full-width",
					label: "Restrict access",
					description: "Limit to admins",
					icon: /* @__PURE__ */ m(d, {
						as: r,
						boxSize: "16px"
					})
				})
			}),
			/* @__PURE__ */ m(f.Separator, {}),
			/* @__PURE__ */ m(f.Item, {
				value: "settings",
				asChild: !0,
				children: /* @__PURE__ */ m(a, {
					asChild: !0,
					variant: "full-width",
					label: "Pipeline settings",
					description: "Configure inputs and outputs",
					icon: /* @__PURE__ */ m(d, {
						as: n,
						boxSize: "16px"
					})
				})
			})
		]
	}) })] }, "options")];
	return /* @__PURE__ */ m(c, {
		maxWidth: "520px",
		children: /* @__PURE__ */ m(o, {
			...s,
			actions: g
		})
	});
} }, y = {
	args: { badge: /* @__PURE__ */ m(s, {
		size: "lg",
		variant: "subtle",
		colorPalette: "blue",
		children: "Pipeline"
	}) },
	render: (e) => /* @__PURE__ */ m(c, {
		maxWidth: "520px",
		children: /* @__PURE__ */ m(o, { ...e })
	})
}, b = {
	args: {
		title: "Northwind Traders Q4 validation",
		description: "Monthly invoice and credit memo validation set with regional edge cases, multi-currency rounding, and fallback parsing rules.",
		infoItems: [{
			label: "Rows",
			value: "1,248"
		}, {
			label: "Coverage",
			value: "85%"
		}]
	},
	render: (e) => /* @__PURE__ */ m(c, {
		maxWidth: "520px",
		children: /* @__PURE__ */ m(o, { ...e })
	})
};
export { _ as Default, b as LongCopy, v as WithActions, y as WithBadge, g as default };
