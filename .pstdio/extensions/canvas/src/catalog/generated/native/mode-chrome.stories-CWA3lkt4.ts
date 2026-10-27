// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./workbench-core-kaLFKJEn.ts";
import { t } from "./mode-chrome-BfbQ4wE_.ts";
import { t as n } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as r } from "react";
import { Box as i, Button as a, HStack as o, Stack as s, Text as c } from "@chakra-ui/react";
import { jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/region/mode-chrome.stories.tsx
var d = (e) => {
	let { title: t } = e, [n, i] = r(0);
	return /* @__PURE__ */ u(s, {
		p: "md",
		gap: "sm",
		children: [/* @__PURE__ */ l(c, { children: t }), /* @__PURE__ */ u(a, {
			onClick: () => i(n + 1),
			children: ["Count: ", n]
		})]
	});
}, f = () => {
	let [f] = r(() => {
		let t = e(), n = t.views.registerView({
			id: "first",
			title: "First view",
			body: {
				kind: "react",
				render: () => /* @__PURE__ */ l(d, { title: "First view" })
			}
		});
		return t.views.registerView({
			id: "second",
			title: "Second view",
			body: {
				kind: "react",
				render: () => /* @__PURE__ */ l(d, { title: "Second view" })
			}
		}), {
			workbench: t,
			first: n
		};
	}), [p, m] = r("first");
	return /* @__PURE__ */ l(n, { children: /* @__PURE__ */ u(s, {
		p: "md",
		gap: "md",
		children: [
			/* @__PURE__ */ l(c, { children: "Increment a counter, switch views or hide them, then return. Each count stays unchanged." }),
			/* @__PURE__ */ u(o, {
				gap: "sm",
				children: [
					/* @__PURE__ */ l(a, {
						onClick: () => m("first"),
						children: "First view"
					}),
					/* @__PURE__ */ l(a, {
						onClick: () => m("second"),
						children: "Second view"
					}),
					/* @__PURE__ */ l(a, {
						onClick: () => m(void 0),
						children: "Hide views"
					}),
					/* @__PURE__ */ l(a, {
						onClick: () => {
							m(void 0), f.first.dispose();
						},
						children: "Remove first view"
					})
				]
			}),
			/* @__PURE__ */ l(i, {
				h: "xs",
				layerStyle: "panel",
				children: /* @__PURE__ */ l(t, {
					workbench: f.workbench,
					viewId: p,
					region: "nav"
				})
			})
		]
	}) });
}, p = {
	title: "pstdio-workbench/Workbench/Mode view retention",
	render: () => /* @__PURE__ */ l(f, {})
}, m = {};
export { m as NavigateAndReturn, p as default };
