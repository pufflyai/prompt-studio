// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./book-open-OD77qyyJ.ts";
import { r as t } from "./docs-topics-BT1I3HP5.ts";
import { n } from "./use-landing-styles-CQWLl3TI.ts";
import { t as r } from "./docs-tree-GMnaff3L.ts";
import { Fragment as i, useState as a } from "react";
import { Text as o } from "@chakra-ui/react";
import { ListRow as s } from "@pstdio/ui";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
// clients/landing-page/src/components/docs/docs-sidebar.tsx
var d = (d) => {
	let { page: f, pages: p, onNavigate: m } = d, h = n(), g = t(f.path)?.path, [_, v] = a(() => new Set(g ? [g] : [])), [y, b] = a(g);
	g !== y && (b(g), g && v((e) => new Set(e).add(g)));
	let x = (e, t) => {
		let n = new Set(_);
		_.has(e) ? n.delete(e) : (n.add(e), m(t)), v(n);
	};
	return /* @__PURE__ */ u(c, { children: [/* @__PURE__ */ l(s, {
		icon: /* @__PURE__ */ l(e, {}),
		label: "Docs home",
		href: "/docs/",
		role: "link",
		isSelected: f.view === "docs",
		"aria-current": f.view === "docs" ? "page" : void 0
	}), r(p).map(({ section: e, topics: t }) => /* @__PURE__ */ u(i, { children: [/* @__PURE__ */ l(o, {
		css: h.sidebarHeading,
		children: e
	}), t.map(({ topic: e, pages: t }) => {
		let n = _.has(e.path);
		return /* @__PURE__ */ u(i, { children: [/* @__PURE__ */ l(s, {
			label: e.label,
			role: "button",
			variant: "tree",
			isContainer: !0,
			showExpandToggle: !0,
			isExpanded: n,
			onToggleExpand: () => x(e.path, t[0].path)
		}), n && t.map((e) => /* @__PURE__ */ l(s, {
			depth: 2,
			variant: "tree",
			label: e.label,
			href: e.path,
			role: "link",
			isSelected: e.path === f.path,
			"aria-current": e.path === f.path ? "page" : void 0
		}, e.path))] }, e.path);
	})] }, e))] });
};
export { d as DocsSidebar };
