// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./landing-tool-demo-AYY5tVVR.ts";
import { useState as n } from "react";
import { Box as r, Button as i, HStack as a, Stack as o, Text as s, Textarea as c, useSlotRecipe as l } from "@chakra-ui/react";
import { ScrollArea as u, Slider as d, createGlyphIcon as f } from "@pstdio/ui";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
// clients/landing-page/src/theme/recipes/landing-shader-demo.stories.tsx
var h = [
	"star",
	"cloud-add",
	"global",
	"grid-4",
	"code",
	"component"
].map((e) => ({
	name: e,
	icon: f(e)
})), g = {
	title: "Theme/Landing Shader Demo",
	component: (f) => {
		let { withControls: g, connected: _ } = f, v = l({ recipe: t })({}), y = l({ recipe: e })({}), [b, x] = n(h[0]), [S, C] = n(16), [w, T] = n(1.8);
		return /* @__PURE__ */ m(r, {
			css: y.page,
			children: [
				!_ && /* @__PURE__ */ m(r, {
					css: v.prompt,
					children: [/* @__PURE__ */ p(s, { children: "Add sliders to adjust the scale and speed." }), /* @__PURE__ */ p(i, {
						variant: "subtle",
						size: "lg",
						children: "Try the change"
					})]
				}),
				_ && /* @__PURE__ */ m(r, {
					css: y.panel,
					children: [/* @__PURE__ */ p(r, {
						css: y.panelHeader,
						children: "Your icon set"
					}), /* @__PURE__ */ m(r, {
						css: y.panelBody,
						children: [/* @__PURE__ */ p(r, {
							css: v.iconPicker,
							children: h.map((e) => /* @__PURE__ */ p(i, {
								size: "2xl",
								variant: "ghost",
								"aria-label": `Use ${e.name}`,
								"aria-pressed": b.name === e.name,
								onClick: () => x(e),
								children: /* @__PURE__ */ p(r, {
									css: v.tileSymbol,
									children: /* @__PURE__ */ p(e.icon, {})
								})
							}, e.name))
						}), /* @__PURE__ */ m(s, {
							textStyle: "label/S/regular",
							children: [
								"Icon set → ",
								b.name,
								" → Shader preview"
							]
						})]
					})]
				}),
				/* @__PURE__ */ m(r, {
					css: [y.panels, v.shaderPanels],
					children: [/* @__PURE__ */ m(r, {
						css: y.panel,
						children: [/* @__PURE__ */ p(r, {
							css: y.panelHeader,
							children: "icon-matrix.frag"
						}), /* @__PURE__ */ p(r, {
							css: y.panelBody,
							children: /* @__PURE__ */ p(u, {
								css: v.shaderScroll,
								showHorizontalScrollbar: !0,
								children: /* @__PURE__ */ p(c, {
									css: v.shaderCode,
									"aria-label": "Fragment shader code",
									wrap: "off",
									spellCheck: !1,
									defaultValue: `vec3 shade(vec2 uv) {
  vec2 cell = uv * u_scale;
  float phase = mod(floor(cell.y) + u_time * 2.0, 18.0);
  float trail = exp(-phase * 0.32) * smoothstep(0.0, 0.8, phase);
  float icon = texture2D(u_icon, cell).a;
  vec3 green = vec3(0.04, 0.65, 0.28);
  return green * icon * (0.035 + trail);
}\n${Array.from({ length: 20 }, (e, t) => `// Shader note ${t + 1}`).join("\n")}`
								})
							})
						})]
					}), /* @__PURE__ */ m(r, {
						css: y.panel,
						children: [/* @__PURE__ */ p(r, {
							css: y.panelHeader,
							children: "Preview"
						}), /* @__PURE__ */ m(r, {
							css: y.panelBody,
							children: [g && /* @__PURE__ */ m(o, {
								gap: "lg",
								children: [/* @__PURE__ */ m(o, {
									gap: "sm",
									children: [/* @__PURE__ */ m(a, {
										css: v.toolbar,
										textStyle: "label/S/regular",
										children: [/* @__PURE__ */ p(s, { children: "Scale" }), /* @__PURE__ */ p(s, { children: S })]
									}), /* @__PURE__ */ p(d, {
										"aria-label": ["Shader scale"],
										min: 4,
										max: 36,
										step: 1,
										value: [S],
										onValueChange: ({ value: e }) => C(e[0])
									})]
								}), /* @__PURE__ */ m(o, {
									gap: "sm",
									children: [/* @__PURE__ */ m(a, {
										css: v.toolbar,
										textStyle: "label/S/regular",
										children: [/* @__PURE__ */ p(s, { children: "Speed" }), /* @__PURE__ */ m(s, { children: [w.toFixed(1), "×"] })]
									}), /* @__PURE__ */ p(d, {
										"aria-label": ["Shader speed"],
										min: 0,
										max: 4,
										step: .1,
										value: [w],
										onValueChange: ({ value: e }) => T(e[0])
									})]
								})]
							}), /* @__PURE__ */ p(r, {
								css: v.shaderCanvas,
								children: /* @__PURE__ */ p(r, {
									height: "64",
									display: "grid",
									gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
									placeItems: "center",
									p: "md",
									role: "img",
									"aria-label": "Icon matrix preview",
									children: Array.from({ length: 64 }, (e, t) => /* @__PURE__ */ p(r, {
										color: "fg.success",
										opacity: .15 + t * 7 % 11 / 13,
										children: /* @__PURE__ */ p(b.icon, {})
									}, t))
								})
							})]
						})]
					})]
				})
			]
		});
	},
	args: {
		withControls: !1,
		connected: !0
	},
	parameters: { layout: "fullscreen" }
}, _ = {}, v = { args: {
	withControls: !0,
	connected: !1
} }, y = {
	args: {
		withControls: !0,
		connected: !1
	},
	decorators: [(e) => /* @__PURE__ */ p(r, {
		width: "80",
		children: /* @__PURE__ */ p(e, {})
	})]
};
export { _ as Editor, y as NarrowPanel, v as WithControls, g as default };
