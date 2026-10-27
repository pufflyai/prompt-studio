// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./use-landing-styles-CQWLl3TI.ts";
import { t } from "./page-scroll-CScB-LpO.ts";
import { useEffect as n } from "react";
import { Box as r } from "@chakra-ui/react";
import { jsx as i, jsxs as a } from "react/jsx-runtime";
// clients/landing-page/src/components/workbench/doc-column.tsx
var o = (o) => {
	let { children: s, pageKey: c, aside: l } = o, u = e();
	return n(() => {
		let e = decodeURIComponent(window.location.hash.slice(1));
		e && window.document.getElementById(e)?.scrollIntoView();
	}, [c]), /* @__PURE__ */ i(r, {
		as: "section",
		css: u.column,
		children: /* @__PURE__ */ i(t, {
			pageKey: c,
			children: /* @__PURE__ */ a(r, {
				css: u.layout,
				children: [/* @__PURE__ */ i(r, {
					as: "article",
					css: u.prose,
					children: s
				}), l]
			})
		})
	});
}, s = (t) => {
	let { html: n } = t, a = e();
	return /* @__PURE__ */ i(r, {
		css: a.html,
		dangerouslySetInnerHTML: { __html: n }
	});
};
export { s as n, o as t };
