// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, o as t, s as n } from "./use-landing-styles-CQWLl3TI.ts";
import { t as r } from "./use-demo-cli-BF9LFxZh.ts";
import { i, t as a } from "./demo-workbench-CNySDkwL.ts";
import { n as o, t as s } from "./icon-set-content-4o7Zf8x8.ts";
import { useState as c } from "react";
import { Box as l, Button as u, Field as d, HStack as f, Input as p, Text as m } from "@chakra-ui/react";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
// clients/landing-page/src/components/examples/icon-set-editor-demo.tsx
var _ = (r) => {
	let { item: a, icons: o, onRename: s } = r, [f, m] = c(a.name), _ = e(), v = n(), y = f.trim(), b = y !== "" && y !== a.name && !o.some((e) => e.name === y);
	return /* @__PURE__ */ g(l, {
		as: "form",
		css: _.inspector,
		onSubmit: (e) => {
			e.preventDefault(), b && s(y);
		},
		children: [
			/* @__PURE__ */ h(l, {
				css: _.iconCanvas,
				role: "img",
				"aria-label": `Icon preview: ${a.name}`,
				children: /* @__PURE__ */ h(l, {
					css: _.inspectorSymbol,
					children: /* @__PURE__ */ h(a.icon, {})
				})
			}),
			/* @__PURE__ */ g(d.Root, { children: [/* @__PURE__ */ h(d.Label, { children: "Name" }), /* @__PURE__ */ h(p, {
				value: f,
				onChange: (e) => m(e.target.value),
				"aria-label": "Icon name"
			})] }),
			!v && /* @__PURE__ */ g(d.Root, { children: [/* @__PURE__ */ h(d.Label, { children: "Codepoint" }), /* @__PURE__ */ h(p, {
				value: `U+${a.codepoint}`,
				readOnly: !0,
				"aria-label": "Icon codepoint"
			})] }),
			/* @__PURE__ */ h(t, {
				kind: "command",
				children: /* @__PURE__ */ g(u, {
					type: "submit",
					variant: "outline",
					disabled: !b,
					"data-demo-part": "command",
					children: [/* @__PURE__ */ h(i, { kind: "command" }), "Rename icon"]
				})
			})
		]
	});
}, v = (t) => {
	let { highlighted: i } = t, [u, d] = c(s), [v, y] = c(u[0].id), [b, x] = c(""), S = u.find((e) => e.id === v), C = b.trim().toLowerCase(), w = n(), T = u.filter((e) => `${e.name} U+${e.codepoint}`.toLowerCase().includes(C)), E = T;
	w && (E = C ? T.slice(0, o.length) : T.filter((e) => o.includes(e.id)));
	let D = r("icons", (e) => {
		y(e.id), d((t) => t.map((t) => t.id === e.id ? {
			...t,
			name: e.name
		} : t));
	}), O = e();
	return /* @__PURE__ */ g(l, {
		ref: D,
		css: O.iconEditor,
		children: [/* @__PURE__ */ g(a, {
			title: "Your icon set",
			kind: "page",
			highlighted: i,
			children: [
				/* @__PURE__ */ g(f, {
					css: O.toolbar,
					children: [/* @__PURE__ */ g(m, {
						textStyle: "label/S/regular",
						color: "fg.muted",
						"aria-live": "polite",
						children: [E.length, " icons"]
					}), /* @__PURE__ */ h(m, {
						textStyle: "mono/XS",
						color: "fg.muted",
						children: "prompt-studio-icons"
					})]
				}),
				/* @__PURE__ */ h(p, {
					placeholder: "Search by name or codepoint",
					"aria-label": "Search icons",
					value: b,
					onChange: (e) => x(e.target.value)
				}),
				/* @__PURE__ */ h(l, {
					css: O.iconGrid,
					role: "group",
					"aria-label": "Select an icon",
					children: E.map((e) => /* @__PURE__ */ g(l, {
						as: "button",
						css: O.iconTile,
						"data-icon-id": e.id,
						"aria-label": `Select icon ${e.name}`,
						"aria-pressed": e.id === v,
						onClick: () => y(e.id),
						children: [
							/* @__PURE__ */ h(l, {
								css: O.tileSymbol,
								children: /* @__PURE__ */ h(e.icon, {})
							}),
							/* @__PURE__ */ h(m, {
								css: O.iconName,
								children: e.name
							}),
							!w && /* @__PURE__ */ g(m, {
								textStyle: "mono/XS",
								color: "fg.muted",
								children: ["U+", e.codepoint]
							})
						]
					}, e.id))
				}),
				E.length === 0 && /* @__PURE__ */ h(m, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					children: "No icons match your search."
				})
			]
		}), /* @__PURE__ */ h(a, {
			title: "Icon inspector",
			kind: "editor",
			highlighted: i,
			children: /* @__PURE__ */ h(_, {
				item: S,
				icons: u,
				onRename: (e) => d(u.map((t) => t.id === v ? {
					...t,
					name: e
				} : t))
			}, `${S.id}:${S.name}`)
		})]
	});
};
export { v as t };
