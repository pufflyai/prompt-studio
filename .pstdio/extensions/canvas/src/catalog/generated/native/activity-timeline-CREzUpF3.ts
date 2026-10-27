// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Children as e } from "react";
import { Avatar as t, Box as n, HStack as r, Stack as i, Text as a, Timeline as o, createSlotRecipeContext as s, defineSlotRecipe as c } from "@chakra-ui/react";
import { Fragment as l, jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/ui/src/components/activity/activity-avatar.tsx
var f = (e) => {
	let { actor: r, icon: i, color: a = "fg.muted", background: o = "bg.muted" } = e;
	return i ? /* @__PURE__ */ u(n, {
		boxSize: "18px",
		borderRadius: "full",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
		color: a,
		background: o,
		children: i
	}) : /* @__PURE__ */ d(t.Root, {
		size: "2xs",
		flexShrink: 0,
		children: [/* @__PURE__ */ u(t.Image, {
			src: r?.avatarSrc,
			alt: r?.avatarAlt ?? r?.name
		}), /* @__PURE__ */ u(t.Fallback, {
			name: r?.name,
			background: o,
			color: a
		})]
	});
}, p = c({
	className: "activity-comment",
	slots: [
		"root",
		"body",
		"content"
	],
	base: {
		root: {
			width: "full",
			borderWidth: "1px",
			borderRadius: "xs",
			overflow: "hidden"
		},
		body: {
			display: "flex",
			flexDirection: "column"
		},
		content: {
			color: "fg",
			overflowWrap: "anywhere",
			whiteSpace: "pre-wrap"
		}
	},
	variants: {
		tone: {
			default: { root: {
				background: "bg",
				borderColor: "border.subtle"
			} },
			attention: { root: {
				background: "bg.warning",
				borderColor: "border.warning"
			} }
		},
		size: {
			comfortable: {
				body: {
					gap: "sm",
					padding: "md"
				},
				content: { textStyle: "label/S/regular" }
			},
			compact: {
				body: {
					gap: "xs",
					padding: "sm"
				},
				content: { textStyle: "label/S/regular" }
			}
		}
	},
	defaultVariants: {
		tone: "default",
		size: "comfortable"
	}
}), { withContext: m, withProvider: h } = s({ recipe: p }), g = () => /* @__PURE__ */ u(n, {
	as: "span",
	boxSize: "3px",
	borderRadius: "full",
	background: "fg.subtle",
	flexShrink: 0
}), _ = (e) => {
	let { actor: t, icon: i, iconColor: o, iconBackground: s, timestamp: c, actions: p } = e;
	return /* @__PURE__ */ d(r, {
		gap: "xs",
		alignItems: "center",
		minW: "0",
		children: [
			/* @__PURE__ */ u(f, {
				actor: t,
				icon: i,
				color: o,
				background: s
			}),
			/* @__PURE__ */ u(a, {
				textStyle: "label/S/medium",
				color: "fg",
				truncate: !0,
				children: t.name
			}),
			c ? /* @__PURE__ */ d(l, { children: [/* @__PURE__ */ u(g, {}), /* @__PURE__ */ u(a, {
				textStyle: "label/S/regular",
				color: "fg.muted",
				flexShrink: 0,
				children: c
			})] }) : null,
			/* @__PURE__ */ u(n, {
				marginLeft: "auto",
				flexShrink: 0,
				children: p
			})
		]
	});
}, v = h("article", "root"), y = m("div", "body"), b = m("div", "content"), x = (e) => {
	let { actor: t, timestamp: r, actions: o, children: s, ...c } = e;
	return /* @__PURE__ */ u(n, {
		paddingX: "md",
		paddingY: "sm",
		...c,
		children: /* @__PURE__ */ d(i, {
			gap: "xs",
			children: [/* @__PURE__ */ u(_, {
				actor: t,
				timestamp: r,
				actions: o
			}), /* @__PURE__ */ u(n, {
				paddingLeft: "32px",
				children: /* @__PURE__ */ u(a, {
					as: "div",
					textStyle: "label/S/regular",
					color: "fg",
					overflowWrap: "anywhere",
					children: s
				})
			})]
		})
	});
}, S = (t) => {
	let { actor: r, icon: i, iconColor: a, iconBackground: o, timestamp: s, actions: c, replies: l, composer: f, children: p, ...m } = t, h = e.count(l) > 0;
	return /* @__PURE__ */ d(v, {
		...m,
		children: [
			/* @__PURE__ */ d(y, { children: [/* @__PURE__ */ u(_, {
				actor: r,
				icon: i,
				iconColor: a,
				iconBackground: o,
				timestamp: s,
				actions: c
			}), /* @__PURE__ */ u(b, { children: p })] }),
			h ? /* @__PURE__ */ u(n, {
				borderTopWidth: "1px",
				borderColor: "border.subtle",
				children: l
			}) : null,
			f ? /* @__PURE__ */ u(n, {
				borderTopWidth: "1px",
				borderColor: "border.subtle",
				children: f
			}) : null
		]
	});
}, C = () => /* @__PURE__ */ u(n, {
	as: "span",
	boxSize: "3px",
	borderRadius: "full",
	background: "fg.subtle",
	flexShrink: 0
}), w = (e) => {
	let { actor: t, icon: r, iconColor: i = "fg", iconBackground: s = "transparent", timestamp: c, children: p, ...m } = e;
	return /* @__PURE__ */ d(o.Item, {
		gap: "xs",
		minH: "24px",
		paddingX: "md",
		...m,
		children: [/* @__PURE__ */ d(o.Connector, { children: [/* @__PURE__ */ u(o.Separator, { borderColor: "border" }), /* @__PURE__ */ u(o.Indicator, {
			outline: "none",
			border: "none",
			background: "bg",
			children: /* @__PURE__ */ u(f, {
				actor: t,
				icon: r,
				color: i,
				background: s
			})
		})] }), /* @__PURE__ */ u(o.Content, {
			gap: "0",
			minW: "0",
			children: /* @__PURE__ */ d(o.Title, {
				marginTop: "0",
				gap: "xs",
				minW: "0",
				fontWeight: "normal",
				textStyle: "label/S/regular",
				color: "fg.muted",
				children: [
					t ? /* @__PURE__ */ u(a, {
						as: "span",
						color: "fg",
						fontWeight: "500",
						flexShrink: 0,
						children: t.name
					}) : null,
					/* @__PURE__ */ u(n, {
						as: "span",
						display: "inline-flex",
						alignItems: "center",
						gap: "2xs",
						minW: "0",
						flexWrap: "wrap",
						children: p
					}),
					c ? /* @__PURE__ */ d(l, { children: [/* @__PURE__ */ u(C, {}), /* @__PURE__ */ u(a, {
						as: "span",
						color: "fg.muted",
						flexShrink: 0,
						children: c
					})] }) : null
				]
			})
		})]
	});
}, T = (e) => {
	let { children: t, ...n } = e;
	return /* @__PURE__ */ u(i, {
		width: "full",
		gap: "md",
		...n,
		children: t
	});
}, E = (e) => {
	let { title: t = "Activity", actions: n, ...i } = e;
	return /* @__PURE__ */ d(r, {
		alignItems: "center",
		justifyContent: "space-between",
		gap: "md",
		...i,
		children: [/* @__PURE__ */ u(a, {
			textStyle: "label/M/medium",
			color: "fg",
			children: t
		}), n ? /* @__PURE__ */ u(r, {
			gap: "xs",
			children: n
		}) : null]
	});
}, D = (e) => {
	let { children: t, ...n } = e;
	return /* @__PURE__ */ u(i, {
		gap: "md",
		width: "full",
		...n,
		children: t
	});
}, O = (e) => {
	let { children: t, ...n } = e;
	return /* @__PURE__ */ u(o.Root, {
		size: "sm",
		variant: "plain",
		width: "full",
		css: { "--timeline-indicator-size": "18px" },
		...n,
		children: t
	});
};
export { w as a, f as c, T as i, D as n, S as o, E as r, x as s, O as t };
