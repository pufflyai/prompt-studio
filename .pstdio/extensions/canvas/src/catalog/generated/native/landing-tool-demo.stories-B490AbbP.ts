// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./landing-tool-demo-AYY5tVVR.ts";
import { useState as n } from "react";
import { Box as r, Button as i, HStack as a, Input as o, Stack as s, Text as c, useSlotRecipe as l } from "@chakra-ui/react";
import { SessionIndicator as u, createGlyphIcon as d } from "@pstdio/ui";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
// clients/landing-page/src/theme/recipes/landing-tool-demo.stories.tsx
var m = [
	"cloud-add",
	"history",
	"folder",
	"global",
	"notification",
	"grid-4",
	"code",
	"component",
	"magicpen"
].map((e) => ({
	name: e,
	icon: d(e)
})), h = {
	title: "Theme/Landing Tool Demo",
	component: () => {
		let d = l({ recipe: t })({}), h = l({ recipe: e })({}), [g, _] = n(m[0]), [v, y] = n("");
		return /* @__PURE__ */ p(r, {
			css: h.page,
			children: [
				/* @__PURE__ */ f(c, {
					textStyle: "paragraph/M/regular",
					color: "fg.muted",
					children: "Browse, rename, and organise the icons you use across your tools."
				}),
				/* @__PURE__ */ p(r, {
					css: d.iconEditor,
					children: [/* @__PURE__ */ p(r, {
						css: h.panel,
						children: [/* @__PURE__ */ f(r, {
							css: h.panelHeader,
							children: "Your icon set"
						}), /* @__PURE__ */ p(s, {
							css: h.panelBody,
							children: [/* @__PURE__ */ f(o, {
								placeholder: "Search icons",
								"aria-label": "Search icons",
								value: v,
								onChange: (e) => y(e.target.value)
							}), /* @__PURE__ */ f(r, {
								css: d.iconGrid,
								children: m.filter((e) => e.name.includes(v.toLowerCase())).map((e) => /* @__PURE__ */ p(r, {
									as: "button",
									css: d.iconTile,
									"aria-pressed": e.name === g.name,
									onClick: () => _(e),
									children: [/* @__PURE__ */ f(r, {
										css: d.tileSymbol,
										children: /* @__PURE__ */ f(e.icon, {})
									}), /* @__PURE__ */ f(c, {
										css: d.iconName,
										children: e.name
									})]
								}, e.name))
							})]
						})]
					}), /* @__PURE__ */ p(r, {
						css: h.panel,
						children: [/* @__PURE__ */ f(r, {
							css: h.panelHeader,
							children: "Icon inspector"
						}), /* @__PURE__ */ f(s, {
							css: h.panelBody,
							children: /* @__PURE__ */ p(r, {
								css: d.inspector,
								children: [/* @__PURE__ */ f(r, {
									css: d.iconCanvas,
									role: "img",
									"aria-label": g.name,
									children: /* @__PURE__ */ f(r, {
										css: d.inspectorSymbol,
										children: /* @__PURE__ */ f(g.icon, {})
									})
								}), /* @__PURE__ */ f(o, {
									value: g.name,
									readOnly: !0,
									"aria-label": "Icon name"
								})]
							})
						})]
					})]
				}),
				/* @__PURE__ */ f(r, {
					css: d.metrics,
					children: [
						"Running",
						"Queued",
						"Completed"
					].map((e) => /* @__PURE__ */ p(r, {
						css: d.metric,
						children: [/* @__PURE__ */ f(c, {
							textStyle: "heading/M",
							children: "1"
						}), /* @__PURE__ */ f(c, {
							textStyle: "label/S/regular",
							children: e
						})]
					}, e))
				}),
				/* @__PURE__ */ f(r, {
					css: d.sessions,
					children: [
						"completed",
						"in_progress",
						"queued",
						"disconnected"
					].map((e, t) => /* @__PURE__ */ f(r, {
						css: d.session,
						"data-status": e,
						children: /* @__PURE__ */ p(a, {
							css: d.toolbar,
							children: [/* @__PURE__ */ f(c, {
								textStyle: "label/M/medium",
								children: [
									"Draw the icons",
									"Refine the outlines",
									"Check the icon set",
									"Paused workflow"
								][t]
							}), /* @__PURE__ */ p(a, {
								css: d.sessionStatus,
								"data-status": e,
								children: [/* @__PURE__ */ f(u, { status: e }), /* @__PURE__ */ f(c, {
									textStyle: "label/S/regular",
									children: [
										"Completed",
										"Running",
										"Queued",
										"Paused"
									][t]
								})]
							})]
						})
					}, e))
				}),
				/* @__PURE__ */ p(r, {
					css: d.prompt,
					children: [/* @__PURE__ */ f(c, { children: "Add sliders to adjust the scale and speed." }), /* @__PURE__ */ f(i, {
						variant: "subtle",
						size: "lg",
						children: "Try the change"
					})]
				})
			]
		});
	},
	parameters: { layout: "fullscreen" }
}, g = {}, _ = () => {
	let e = l({ recipe: t })({});
	return /* @__PURE__ */ f(r, {
		css: e.iconGrid,
		p: "md",
		children: [
			"pending",
			"active",
			"ready"
		].map((t, n) => {
			let i = m[n].icon;
			return /* @__PURE__ */ p(r, {
				css: e.iconTile,
				"data-state": t,
				children: [/* @__PURE__ */ f(r, {
					css: e.tileSymbol,
					children: /* @__PURE__ */ f(i, {})
				}), /* @__PURE__ */ f(c, {
					css: e.iconName,
					children: t
				})]
			}, t);
		})
	});
}, v = { render: () => /* @__PURE__ */ f(_, {}) }, y = { decorators: [(e) => /* @__PURE__ */ f(r, {
	width: "80",
	children: /* @__PURE__ */ f(e, {})
})] };
export { g as Desktop, y as NarrowPanel, v as PreviewStates, h as default };
