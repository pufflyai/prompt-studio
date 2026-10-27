// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./rolldown-runtime-CwxnZyOB.ts";
import { i as t, o as n, r } from "./use-landing-styles-CQWLl3TI.ts";
import { t as i } from "./use-demo-cli-BF9LFxZh.ts";
import { t as a } from "./demo-workbench-CNySDkwL.ts";
import { t as o } from "./use-shader-preview-BjocYG5t.ts";
import { useState as s } from "react";
import { Box as c, Button as l, HStack as u, Stack as d, Text as f, Textarea as p } from "@chakra-ui/react";
import { ScrollArea as m, Slider as h } from "@pstdio/ui";
import { jsx as g, jsxs as _ } from "react/jsx-runtime";
// clients/landing-page/src/components/examples/shader-editor-demo.tsx
var v = /* @__PURE__ */ e({ ShaderEditorDemo: () => y }), y = (e) => {
	let { shader: v, iconCodepoint: y, withControls: b, highlighted: x } = e, [S, C] = s(v.source), [w, T] = s(v.scale), [E, D] = s(v.speed), O = i("shaders", (e) => {
		T(e.scale), D(e.speed);
	}), k = o(S, b ? w : v.scale, b ? E : v.speed, y), A = r(), j = t();
	return /* @__PURE__ */ _(c, {
		ref: O,
		css: [A.panels, j.shaderPanels],
		children: [/* @__PURE__ */ _(a, {
			title: v.filename,
			kind: "editor",
			highlighted: x,
			children: [
				/* @__PURE__ */ g(m, {
					css: j.shaderScroll,
					showHorizontalScrollbar: !0,
					children: /* @__PURE__ */ g(p, {
						css: j.shaderCode,
						"aria-label": "Fragment shader code",
						wrap: "off",
						spellCheck: !1,
						autoCapitalize: "off",
						autoCorrect: "off",
						value: S,
						onChange: (e) => C(e.target.value)
					})
				}),
				k.error && /* @__PURE__ */ g(f, {
					textStyle: "mono/XS",
					color: "fg.error",
					role: "alert",
					children: k.error
				}),
				/* @__PURE__ */ g(l, {
					variant: "ghost",
					alignSelf: "start",
					onClick: () => C(v.source),
					disabled: S === v.source,
					children: "Reset code"
				})
			]
		}), /* @__PURE__ */ _(a, {
			title: "Preview",
			kind: "page",
			highlighted: x,
			children: [b && /* @__PURE__ */ g(n, {
				kind: "hook",
				children: /* @__PURE__ */ _(d, {
					css: j.shaderControls,
					"data-demo-part": "hook",
					children: [/* @__PURE__ */ _(d, {
						css: j.shaderControl,
						children: [/* @__PURE__ */ _(u, {
							css: j.toolbar,
							textStyle: "label/S/regular",
							children: [/* @__PURE__ */ g(f, { children: "Scale" }), /* @__PURE__ */ g(f, {
								as: "output",
								children: w
							})]
						}), /* @__PURE__ */ g(h, {
							"aria-label": ["Shader scale"],
							min: 4,
							max: 36,
							step: 1,
							value: [w],
							onValueChange: ({ value: e }) => T(e[0])
						})]
					}), /* @__PURE__ */ _(d, {
						css: j.shaderControl,
						children: [/* @__PURE__ */ _(u, {
							css: j.toolbar,
							textStyle: "label/S/regular",
							children: [/* @__PURE__ */ g(f, { children: "Speed" }), /* @__PURE__ */ _(f, {
								as: "output",
								children: [E.toFixed(1), "×"]
							})]
						}), /* @__PURE__ */ g(h, {
							"aria-label": ["Shader speed"],
							min: 0,
							max: v.maxSpeed,
							step: .1,
							value: [E],
							onValueChange: ({ value: e }) => D(e[0])
						})]
					})]
				})
			}), /* @__PURE__ */ g(c, {
				as: "canvas",
				css: j.shaderCanvas,
				ref: k.canvasRef,
				role: "img",
				"aria-label": "Live shader preview"
			})]
		})]
	});
};
export { v as n, y as t };
