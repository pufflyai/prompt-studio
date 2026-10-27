// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { m as e } from "./assembly-layout-BE5FCzRo.ts";
import { r as t } from "./use-landing-styles-CQWLl3TI.ts";
import { l as n, n as r, r as i } from "./demo-workbench-CNySDkwL.ts";
import { i as a } from "./landing-route-DJns_G_o.ts";
import { t as o } from "./tool-demo-BbhwhxRg.ts";
import { t as s } from "./chapter-carousel-BcggMWd3.ts";
import { useState as c } from "react";
import { Box as l, HStack as u, Stack as d, Text as f } from "@chakra-ui/react";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
// clients/landing-page/src/components/sections/examples-view.tsx
var h = (t) => {
	let { exampleId: n, onNavigate: r } = t;
	return /* @__PURE__ */ p(s, {
		label: "Example tools",
		value: n,
		onChange: (e, t) => r(e, t),
		chapters: e.map((e) => ({
			id: e.id,
			label: e.name,
			href: a(e.id),
			content: /* @__PURE__ */ p(g, { exampleId: e.id }, e.id)
		}))
	});
}, g = (a) => {
	let { exampleId: s } = a, [h, g] = c("page"), _ = e.find((e) => e.id === s), v = _.blocks.find((e) => e.kind === h), y = t();
	return /* @__PURE__ */ p(l, {
		css: y.page,
		children: /* @__PURE__ */ m(l, {
			css: y.section,
			as: "section",
			"aria-labelledby": "tool-examples-title",
			children: [
				/* @__PURE__ */ p(d, {
					css: y.intro,
					children: /* @__PURE__ */ p(f, {
						id: "tool-examples-title",
						as: "h1",
						textStyle: {
							base: "heading/M",
							md: "heading/L"
						},
						children: _.name
					})
				}),
				/* @__PURE__ */ p(f, {
					textStyle: "paragraph/M/regular",
					color: "fg.muted",
					"aria-live": "polite",
					children: _.description
				}),
				/* @__PURE__ */ m(l, {
					css: y.composition,
					children: [
						/* @__PURE__ */ p(f, {
							textStyle: "label/S/regular",
							color: "fg.muted",
							children: "Made with"
						}),
						/* @__PURE__ */ p(u, {
							gap: "sm",
							flexWrap: "wrap",
							children: _.blocks.map((e) => /* @__PURE__ */ p(i, {
								kind: e.kind,
								selected: e.kind === h,
								onClick: () => g(e.kind)
							}, e.kind))
						}),
						/* @__PURE__ */ m(f, {
							textStyle: "paragraph/M/regular",
							"aria-live": "polite",
							children: [/* @__PURE__ */ m(f, {
								as: "span",
								textStyle: "label/M/medium",
								children: [
									n(h).name,
									".",
									" "
								]
							}), v.purpose]
						})
					]
				}),
				/* @__PURE__ */ p(r, { children: /* @__PURE__ */ p(o, {
					example: _.id,
					highlighted: h
				}, _.id) })
			]
		})
	});
};
export { h as ExamplesView };
