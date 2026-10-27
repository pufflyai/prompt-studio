// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./bot-DyijWSfK.ts";
import { t as i } from "./file-code-Bdj5XAS8.ts";
import { t as a } from "./shapes-DFL0934N.ts";
import { t as o } from "./star-DtQKFyMr.ts";
import { n as s, t as c } from "./landing-tool-demo-AYY5tVVR.ts";
import { useState as l } from "react";
import { Badge as u, Box as d, HStack as f, Input as p, Stack as m, Text as h, useSlotRecipe as g } from "@chakra-ui/react";
import { ListRow as _, Switch as v } from "@pstdio/ui";
import { jsx as y, jsxs as b } from "react/jsx-runtime";
var x = {
	title: "Theme/Landing Services",
	component: () => {
		let e = g({ recipe: s })({}), t = g({ recipe: c })({}), n = [
			{
				id: "icons",
				name: "Icon set editor",
				icon: a
			},
			{
				id: "shader",
				name: "Shader editor",
				icon: i
			},
			{
				id: "agents",
				name: "Coding agent dashboard",
				icon: r
			}
		], [x, S] = l(n.map((e) => e.id));
		return /* @__PURE__ */ b(d, {
			css: e.page,
			children: [
				/* @__PURE__ */ b(m, {
					gap: "sm",
					children: [/* @__PURE__ */ y(h, {
						as: "h1",
						textStyle: "heading/M",
						children: "A solid foundation to extend from"
					}), /* @__PURE__ */ y(h, {
						color: "fg.muted",
						children: "Shared features that every tool can use."
					})]
				}),
				/* @__PURE__ */ b(d, {
					css: e.featureSection,
					children: [/* @__PURE__ */ y(h, {
						as: "h2",
						textStyle: "heading/S",
						children: "Search"
					}), /* @__PURE__ */ y(d, {
						css: e.visual,
						children: /* @__PURE__ */ b(d, {
							css: e.panel,
							children: [/* @__PURE__ */ y(d, {
								css: e.panelHeader,
								children: /* @__PURE__ */ y(p, {
									"aria-label": "Search tools",
									placeholder: "Search tools, files, and commands…",
									variant: "borderless"
								})
							}), /* @__PURE__ */ b(d, {
								css: e.panelBody,
								children: [/* @__PURE__ */ y(_, {
									label: "Icon set editor",
									icon: /* @__PURE__ */ y(a, { size: 16 }),
									isSelected: !0,
									endContent: /* @__PURE__ */ y(u, { children: "Tool" })
								}), /* @__PURE__ */ y(_, {
									label: "Coding agent dashboard",
									icon: /* @__PURE__ */ y(r, { size: 16 }),
									endContent: /* @__PURE__ */ y(u, { children: "Tool" })
								})]
							})]
						})
					})]
				}),
				/* @__PURE__ */ b(d, {
					css: e.featureSection,
					children: [/* @__PURE__ */ y(h, {
						as: "h2",
						textStyle: "heading/S",
						children: "Extension management"
					}), /* @__PURE__ */ b(d, {
						css: e.visual,
						children: [/* @__PURE__ */ b(d, {
							css: e.panel,
							children: [/* @__PURE__ */ y(d, {
								css: e.panelHeader,
								children: "Installed extensions"
							}), /* @__PURE__ */ y(d, {
								css: e.panelBody,
								children: n.map((e) => /* @__PURE__ */ b(f, {
									gap: "md",
									children: [
										/* @__PURE__ */ y(e.icon, { size: 24 }),
										/* @__PURE__ */ y(h, {
											flex: "1",
											textStyle: "label/M/medium",
											children: e.name
										}),
										/* @__PURE__ */ y(v, {
											"aria-label": `Enable ${e.name}`,
											checked: x.includes(e.id),
											onCheckedChange: ({ checked: t }) => S((n) => t ? [...n, e.id] : n.filter((t) => t !== e.id))
										})
									]
								}, e.id))
							})]
						}), /* @__PURE__ */ b(m, {
							gap: "sm",
							mt: "md",
							children: [/* @__PURE__ */ b(h, {
								textStyle: "label/S/medium",
								children: [
									"Your workbench · ",
									x.length,
									" panels"
								]
							}), /* @__PURE__ */ b(d, {
								css: t.extensionPanels,
								children: [n.filter((e) => x.includes(e.id)).map((t) => /* @__PURE__ */ b(d, {
									css: e.panel,
									role: "region",
									"aria-label": `${t.name} panel`,
									children: [/* @__PURE__ */ b(f, {
										css: e.panelHeader,
										children: [/* @__PURE__ */ y(t.icon, { size: 16 }), /* @__PURE__ */ y(h, { children: t.name })]
									}), /* @__PURE__ */ b(d, {
										css: e.panelBody,
										children: [
											t.id === "icons" && /* @__PURE__ */ b(f, {
												gap: "md",
												children: [
													/* @__PURE__ */ y(o, {}),
													/* @__PURE__ */ y(a, {}),
													/* @__PURE__ */ y(i, {})
												]
											}),
											t.id === "shader" && /* @__PURE__ */ y(d, {
												display: "grid",
												gridTemplateColumns: "repeat(4, 1fr)",
												gap: "md",
												color: "fg.success",
												children: Array.from({ length: 16 }, (e, t) => /* @__PURE__ */ y(o, { size: 16 }, t))
											}),
											t.id === "agents" && /* @__PURE__ */ b(m, {
												gap: "sm",
												children: [/* @__PURE__ */ y(h, {
													textStyle: "label/S/medium",
													children: "Codex · Done"
												}), /* @__PURE__ */ y(h, {
													textStyle: "paragraph/S/regular",
													children: "Connect the icon set to the shader."
												})]
											})
										]
									})]
								}, t.id)), x.length === 0 && /* @__PURE__ */ y(h, {
									color: "fg.muted",
									children: "Enable an extension to add its panel."
								})]
							})]
						})]
					})]
				})
			]
		});
	},
	parameters: { layout: "fullscreen" }
}, S = {}, C = { play: async ({ canvasElement: r }) => {
	let i = e(r), a = i.getByRole("checkbox", { name: "Enable Icon set editor" });
	await t.click(a), await n(i.queryByRole("region", { name: "Icon set editor panel" })).not.toBeInTheDocument(), await n(i.getByRole("region", { name: "Shader editor panel" })).toBeVisible(), await t.click(a), await n(i.getByRole("region", { name: "Icon set editor panel" })).toBeVisible();
} }, w = { decorators: [(e) => /* @__PURE__ */ y(d, {
	width: "80",
	children: /* @__PURE__ */ y(e, {})
})] };
export { S as Desktop, w as NarrowPanel, C as TogglePanels, x as default };
