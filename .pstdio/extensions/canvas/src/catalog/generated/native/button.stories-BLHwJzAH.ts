// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-down-ZmPqsMG0.ts";
import { t } from "./download-B4RJJThF.ts";
import { t as n } from "./plus-CYkLGSPS.ts";
import { t as r } from "./settings-DjkPFa7Q.ts";
import { t as i } from "./trash-2-C03vrbuo.ts";
import { n as a } from "./apply-theme-preference-DzXMh3mV.ts";
import { Box as o, Button as s, ButtonGroup as c, HStack as l, Icon as u, IconButton as d, SimpleGrid as f, Stack as p, Text as m } from "@chakra-ui/react";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
// packages/ui/src/components/primitives/button.stories.tsx
var _ = [
	{
		label: "Primary",
		description: "Brand action style using accent tokens.",
		variant: "primary"
	},
	{
		label: "Destructive",
		description: "Filled destructive actions for delete and removal flows.",
		variant: "destructive"
	},
	{
		label: "Outline",
		description: "Neutral outlines for quiet actions.",
		variant: "outline"
	},
	{
		label: "Ghost",
		description: "Low emphasis actions in dense UI.",
		variant: "ghost"
	},
	{
		label: "Subtle",
		description: "Muted background actions with a light border.",
		variant: "subtle"
	},
	{
		label: "Plain",
		description: "Inline link-style actions.",
		variant: "plain"
	}
], v = [
	{
		label: "2XS",
		helper: "Tiny icon controls in dense tables.",
		size: "2xs"
	},
	{
		label: "Extra Small",
		helper: "Compact inline controls.",
		size: "xs"
	},
	{
		label: "Small",
		helper: "Dense toolbars and tables.",
		size: "sm"
	},
	{
		label: "Medium",
		helper: "Default buttons across the app.",
		size: "md"
	},
	{
		label: "Large",
		helper: "Primary CTAs in dialogs.",
		size: "lg"
	},
	{
		label: "2XL",
		helper: "Hero CTAs on landing surfaces.",
		size: "2xl"
	}
], y = [{
	id: "pstdio-light",
	label: "Light mode",
	mode: "light"
}, {
	id: "pstdio-dark",
	label: "Dark mode",
	mode: "dark"
}], b = {
	title: "Components/Inputs/Button",
	component: s,
	decorators: [(e) => /* @__PURE__ */ h(o, {
		padding: "sm",
		background: "bg",
		children: /* @__PURE__ */ h(e, {})
	})]
}, x = { render: () => /* @__PURE__ */ h(f, {
	columns: {
		base: 1,
		lg: 2
	},
	gap: "md",
	children: _.map((e) => /* @__PURE__ */ h(o, {
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "xs",
		background: "bg",
		padding: "md",
		children: /* @__PURE__ */ g(p, {
			gap: "sm",
			children: [/* @__PURE__ */ g(p, {
				gap: "xs",
				children: [/* @__PURE__ */ h(m, {
					textStyle: "label/L/medium",
					children: e.label
				}), /* @__PURE__ */ h(m, {
					textStyle: "label/XS",
					color: "fg.muted",
					children: e.description
				})]
			}), /* @__PURE__ */ g(l, {
				gap: "sm",
				flexWrap: "wrap",
				children: [
					/* @__PURE__ */ h(s, {
						variant: e.variant,
						children: "Run action"
					}),
					/* @__PURE__ */ h(s, {
						variant: e.variant,
						loading: !0,
						children: "Loading"
					}),
					/* @__PURE__ */ h(s, {
						variant: e.variant,
						disabled: !0,
						children: "Disabled"
					})
				]
			})]
		})
	}, e.label))
}) }, S = { render: () => /* @__PURE__ */ h(f, {
	columns: {
		base: 1,
		lg: 2
	},
	gap: "md",
	children: y.map((e) => /* @__PURE__ */ h(o, {
		className: a(e.id, e.mode).join(" "),
		"data-color-mode": e.mode,
		"data-theme": e.id,
		color: "fg",
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "xs",
		background: "bg",
		padding: "md",
		children: /* @__PURE__ */ g(p, {
			gap: "sm",
			children: [
				/* @__PURE__ */ h(m, {
					textStyle: "label/L/medium",
					children: e.label
				}),
				/* @__PURE__ */ g(l, {
					gap: "sm",
					flexWrap: "wrap",
					children: [
						/* @__PURE__ */ h(s, {
							variant: "primary",
							children: "Primary action"
						}),
						/* @__PURE__ */ h(s, {
							variant: "primary",
							loading: !0,
							children: "Loading"
						}),
						/* @__PURE__ */ h(s, {
							variant: "primary",
							disabled: !0,
							children: "Disabled"
						}),
						/* @__PURE__ */ h(s, {
							variant: "destructive",
							children: "Delete item"
						})
					]
				}),
				/* @__PURE__ */ h(m, {
					textStyle: "label/XS",
					color: "fg.muted",
					children: "Destructive actions keep readable labels in every enabled state."
				}),
				/* @__PURE__ */ g(l, {
					gap: "sm",
					flexWrap: "wrap",
					children: [
						/* @__PURE__ */ h(s, {
							variant: "destructive",
							children: "Default"
						}),
						/* @__PURE__ */ h(s, {
							variant: "destructive",
							"data-hover": !0,
							children: "Hover"
						}),
						/* @__PURE__ */ h(s, {
							variant: "destructive",
							"data-hover": !0,
							"data-active": !0,
							children: "Pressed"
						})
					]
				})
			]
		})
	}, e.id))
}) }, C = { render: () => /* @__PURE__ */ h(p, {
	gap: "lg",
	children: v.map((e) => /* @__PURE__ */ g(l, {
		alignItems: "center",
		justifyContent: "space-between",
		flexWrap: "wrap",
		gap: "md",
		padding: "md",
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "xs",
		background: "bg",
		children: [/* @__PURE__ */ g(p, {
			gap: "xs",
			minWidth: "12rem",
			children: [/* @__PURE__ */ h(m, {
				textStyle: "label/L/medium",
				children: e.label
			}), /* @__PURE__ */ h(m, {
				textStyle: "label/XS",
				color: "fg.muted",
				children: e.helper
			})]
		}), /* @__PURE__ */ g(l, {
			gap: "sm",
			flexWrap: "wrap",
			children: [
				/* @__PURE__ */ h(s, {
					size: e.size,
					variant: "primary",
					children: "Create new"
				}),
				/* @__PURE__ */ h(s, {
					size: e.size,
					variant: "outline",
					children: "Outline"
				}),
				/* @__PURE__ */ g(s, {
					size: e.size,
					variant: "ghost",
					children: [/* @__PURE__ */ h(u, { as: t }), "Export"]
				}),
				/* @__PURE__ */ h(d, {
					size: e.size,
					variant: "ghost",
					"aria-label": "Settings",
					children: /* @__PURE__ */ h(u, { as: r })
				}),
				/* @__PURE__ */ h(d, {
					size: e.size,
					variant: "destructive-ghost",
					"aria-label": "Delete",
					children: /* @__PURE__ */ h(u, { as: i })
				})
			]
		})]
	}, e.label))
}) }, w = { render: () => /* @__PURE__ */ g(l, {
	gap: "sm",
	flexWrap: "wrap",
	padding: "md",
	borderWidth: "1px",
	borderColor: "border.subtle",
	borderRadius: "xs",
	children: [
		/* @__PURE__ */ h(d, {
			variant: "primary",
			"aria-label": "Add",
			children: /* @__PURE__ */ h(u, {
				as: n,
				boxSize: "icon-sm"
			})
		}),
		/* @__PURE__ */ h(d, {
			variant: "subtle",
			"aria-label": "Settings",
			children: /* @__PURE__ */ h(u, {
				as: r,
				boxSize: "16px"
			})
		}),
		/* @__PURE__ */ h(d, {
			variant: "outline",
			"aria-label": "Download",
			children: /* @__PURE__ */ h(u, {
				as: t,
				boxSize: "16px"
			})
		}),
		/* @__PURE__ */ h(d, {
			variant: "destructive-ghost",
			"aria-label": "Delete",
			children: /* @__PURE__ */ h(u, {
				as: i,
				boxSize: "16px"
			})
		}),
		/* @__PURE__ */ h(d, {
			variant: "ghost",
			"aria-label": "Open panel",
			"aria-pressed": "true",
			children: /* @__PURE__ */ h(u, {
				as: r,
				boxSize: "16px"
			})
		})
	]
}) }, T = { render: () => /* @__PURE__ */ g(p, {
	gap: "md",
	padding: "md",
	borderWidth: "1px",
	borderColor: "border.subtle",
	borderRadius: "xs",
	background: "bg",
	children: [/* @__PURE__ */ h(m, {
		textStyle: "label/L/medium",
		children: "Flush button groups"
	}), /* @__PURE__ */ g(l, {
		gap: "sm",
		flexWrap: "wrap",
		children: [
			/* @__PURE__ */ g(c, {
				size: "sm",
				variant: "outline",
				attached: !0,
				children: [/* @__PURE__ */ h(s, {
					variant: "outline",
					children: "Button"
				}), /* @__PURE__ */ h(d, {
					variant: "outline",
					"aria-label": "More actions",
					children: /* @__PURE__ */ h(u, { as: e })
				})]
			}),
			/* @__PURE__ */ g(c, {
				size: "xs",
				variant: "subtle",
				attached: !0,
				children: [/* @__PURE__ */ h(s, {
					variant: "subtle",
					children: "Filter"
				}), /* @__PURE__ */ h(d, {
					variant: "subtle",
					"aria-label": "Filter options",
					children: /* @__PURE__ */ h(u, { as: e })
				})]
			}),
			/* @__PURE__ */ g(c, {
				size: "2xs",
				variant: "ghost",
				attached: !0,
				children: [/* @__PURE__ */ h(s, {
					variant: "ghost",
					children: "Tiny"
				}), /* @__PURE__ */ h(d, {
					variant: "ghost",
					"aria-label": "Tiny options",
					children: /* @__PURE__ */ h(u, { as: e })
				})]
			})
		]
	})]
}) };
export { T as AttachedGroups, w as IconOnly, S as PrimaryAndDestructive, C as Sizes, x as Variants, b as default };
