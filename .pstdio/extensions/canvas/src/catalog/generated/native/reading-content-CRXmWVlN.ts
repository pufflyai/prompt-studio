// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./doc-column-G6d3T2RC.ts";
import { i as n, n as r, r as i, t as a } from "./docs-page-view-Dq9UVIUy.ts";
import { jsx as o } from "react/jsx-runtime";
// clients/landing-page/src/components/workbench/reading-content.tsx
var s = (s) => {
	let { page: c, pages: l, document: u = {
		html: "",
		headings: []
	} } = s;
	return c.view === "docs" ? /* @__PURE__ */ o(r, {
		page: c,
		pages: l
	}) : c.view === "doc" ? /* @__PURE__ */ o(a, {
		page: c,
		document: u
	}) : c.view === "blog" ? /* @__PURE__ */ o(n, {
		page: c,
		pages: l
	}) : c.view === "post" ? /* @__PURE__ */ o(i, {
		page: c,
		document: u
	}) : /* @__PURE__ */ o(t, {
		pageKey: c.path,
		children: /* @__PURE__ */ o(e, { html: u.html })
	});
};
export { s as ReadingContent };
