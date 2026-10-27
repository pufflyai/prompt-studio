// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-right-C4vsuHeN.ts";
import { i as t, r as n } from "./use-landing-styles-CQWLl3TI.ts";
import { a as r, i, n as a, t as o } from "./demo-workbench-CNySDkwL.ts";
import { t as s } from "./shader-editor-demo-B_dcsCr4.ts";
import { a as c, t as l } from "./icon-set-content-4o7Zf8x8.ts";
import { t as u } from "./icon-set-editor-demo-B2JxUJJi.ts";
import { t as d } from "./chapter-carousel-BcggMWd3.ts";
import { useState as f } from "react";
import { Box as p, Button as m, HStack as h, Stack as g, Text as _ } from "@chakra-ui/react";
import { jsx as v, jsxs as y } from "react/jsx-runtime";
// clients/landing-page/src/components/examples/shader-icon-picker.tsx
var b = (e) => {
	let { selected: n, onSelect: r } = e, i = t();
	return /* @__PURE__ */ v(o, {
		title: "Your icon set",
		kind: "editor",
		children: /* @__PURE__ */ v(p, {
			css: i.iconPicker,
			role: "group",
			"aria-label": "Pick a shader icon",
			children: l.map((e) => /* @__PURE__ */ v(m, {
				variant: "ghost",
				size: "2xl",
				"aria-label": `Use ${e.name}`,
				title: e.name,
				"aria-pressed": n === e.id,
				onClick: () => r(e),
				children: /* @__PURE__ */ v(p, {
					css: i.tileSymbol,
					children: /* @__PURE__ */ v(e.icon, {})
				})
			}, e.id))
		})
	});
}, x = (t) => {
	let { withControls: n } = t, [r, a] = f(l[11]);
	return /* @__PURE__ */ y(g, {
		gap: "panel-gap",
		children: [
			/* @__PURE__ */ v(b, {
				selected: r.id,
				onSelect: a
			}),
			/* @__PURE__ */ y(h, {
				gap: "sm",
				px: "md",
				py: "sm",
				flexWrap: "wrap",
				textStyle: "label/S/regular",
				"aria-label": "Connected tools",
				children: [
					/* @__PURE__ */ v(i, { kind: "editor" }),
					/* @__PURE__ */ v(_, { children: "Icon set" }),
					/* @__PURE__ */ v(e, { size: 14 }),
					/* @__PURE__ */ v(_, {
						textStyle: "mono/XS",
						children: r.name
					}),
					/* @__PURE__ */ v(e, { size: 14 }),
					/* @__PURE__ */ v(i, { kind: "page" }),
					/* @__PURE__ */ v(_, { children: "Shader preview" })
				]
			}),
			/* @__PURE__ */ v(s, {
				shader: c,
				iconCodepoint: r.codepoint,
				withControls: n
			})
		]
	});
}, S = [
	{
		id: "building-blocks",
		label: "Building blocks",
		title: "The right building blocks to create extensions.",
		subtitle: "Give your agents the pieces they need to build useful tools.",
		Demo: r
	},
	{
		id: "editor",
		label: "A clean editor",
		title: "A clean editor out of the box.",
		subtitle: "Give your tools a consistent UI, with panels, navigation, and themes included.",
		Demo: () => /* @__PURE__ */ v(a, { children: /* @__PURE__ */ v(u, {}) })
	},
	{
		id: "connected-tools",
		label: "Connected tools",
		title: "Connect the tools you build.",
		subtitle: "Use shared files and commands to connect your tools into workflows.",
		Demo: () => /* @__PURE__ */ v(a, { children: /* @__PURE__ */ v(x, { withControls: !1 }) })
	},
	{
		id: "make-it-yours",
		label: "Make it yours",
		title: "Tweak things to work your way.",
		subtitle: "Ask your coding agent to add a view or change how your tool works.",
		Demo: () => {
			let [n, r] = f(!1), o = t();
			return /* @__PURE__ */ y(g, {
				gap: "md",
				children: [/* @__PURE__ */ y(p, {
					css: o.prompt,
					children: [/* @__PURE__ */ y(h, {
						gap: "sm",
						flex: "1",
						children: [/* @__PURE__ */ v(i, { kind: "skill" }), /* @__PURE__ */ v(_, { children: "Add sliders to adjust the scale and speed." })]
					}), /* @__PURE__ */ y(m, {
						variant: "subtle",
						size: "lg",
						flexShrink: "0",
						"aria-pressed": n,
						onClick: () => r(!n),
						children: [n ? "Undo change" : "Try the change", /* @__PURE__ */ v(e, {})]
					})]
				}), /* @__PURE__ */ v(a, { children: /* @__PURE__ */ v(s, {
					shader: c,
					iconCodepoint: l[11].codepoint,
					withControls: n
				}) })]
			});
		}
	}
], C = () => {
	let [e, t] = f(S[0].id), r = n();
	return /* @__PURE__ */ v(d, {
		label: "What is Prompt Studio",
		value: e,
		onChange: t,
		chapters: S.map(({ id: e, label: t, title: n, subtitle: i, Demo: a }) => ({
			id: e,
			label: t,
			content: /* @__PURE__ */ v(p, {
				css: r.page,
				children: /* @__PURE__ */ y(p, {
					as: "section",
					css: r.section,
					children: [/* @__PURE__ */ y(g, {
						css: r.intro,
						children: [/* @__PURE__ */ v(_, {
							as: "h1",
							textStyle: {
								base: "heading/M",
								md: "heading/L"
							},
							children: n
						}), /* @__PURE__ */ v(_, {
							textStyle: "paragraph/L/regular",
							color: "fg.muted",
							children: i
						})]
					}), /* @__PURE__ */ v(a, {})]
				})
			})
		}))
	});
};
export { C as WhatIsPromptStudioView };
