// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./search-FHo0INnP.ts";
import { t } from "./terminal-B2gAfUK-.ts";
import { c as n } from "./workbench-core-kaLFKJEn.ts";
import { t as r } from "./icon-D3uE7jD-.ts";
import { r as i } from "./workbench-theme-background-LZFbdbjE.ts";
import { useEffect as a, useState as o } from "react";
import { Box as s } from "@chakra-ui/react";
import { Palette as c } from "@pstdio/ui";
import { jsx as l } from "react/jsx-runtime";
import { resourceKey as u } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/react/command-palette/palette-view.tsx
var d = "search", f = "command", p = "theme", m = [{ id: d }, {
	id: f,
	inputPrefix: ">"
}], h = (e) => e === p, g = (e) => {
	if (h(e)) return p;
}, _ = (e) => {
	if (!h(e)) return m;
}, v = (e) => h(e.view) ? e.themeInitialActiveIndex : 0, y = (n) => h(n.view) ? /* @__PURE__ */ l(r, {
	name: "Palette",
	size: 16
}) : n.mode === "command" ? /* @__PURE__ */ l(t, {
	size: 16,
	"aria-hidden": "true"
}) : /* @__PURE__ */ l(e, {
	size: 16,
	"aria-hidden": "true"
}), b = (e) => h(e.view) ? "Search themes" : e.mode === "command" ? "Run command" : "Search, or type > to run a command", x = (e) => {
	let { children: t } = e;
	return /* @__PURE__ */ l(s, {
		display: "contents",
		css: {
			"& [data-scope=dialog][data-part=backdrop], & [data-scope=dialog][data-part=positioner]": {
				position: "absolute",
				inset: "0"
			},
			"& [data-scope=dialog][data-part=positioner]": {
				alignItems: "center",
				justifyContent: "center",
				h: "full",
				minH: "0",
				padding: "md",
				w: "full"
			},
			"& [data-scope=dialog][data-part=content]": { background: i }
		},
		children: t
	});
}, S = (e) => {
	let { entry: t, onClose: i, workbench: a } = e, { resource: o } = t, s = t.resource.label ?? u(t.resource), c = a.resources.getKind(o.type, o.extensionId), f = t.indicator, p = f?.icon ?? o.icon ?? c?.icon, m = t.activate;
	if (m) return {
		id: `workbench-resource:${u(o)}`,
		resourceKey: u(o),
		mode: d,
		label: s,
		searchText: t.searchText ?? s,
		description: t.description,
		group: t.group,
		icon: p ? /* @__PURE__ */ l(r, {
			name: p,
			color: f?.color,
			role: f?.label ? "img" : void 0,
			"aria-label": f?.label,
			"aria-hidden": !f?.label || void 0
		}) : void 0,
		onActivate: () => {
			n(a, s, () => m(o), {
				inlineTarget: "command-palette",
				onSuccess: i
			});
		}
	};
}, C = (e) => {
	let { onClose: t, query: n, workbench: r } = e;
	return (e.resources ?? r.resources.listResources(n)).map((e) => S({
		workbench: r,
		entry: e,
		onClose: t
	})).filter((e) => e !== void 0);
}, w = (e) => {
	let { workbench: t, request: n, onClose: i } = e, [s, u] = o(() => ({
		request: n,
		query: "",
		resources: n.list("")
	})), d = s.request === n ? s.query : "";
	s.request !== n && u({
		request: n,
		query: "",
		resources: n.list("")
	}), a(() => {
		let e = () => u((e) => e.request === n ? {
			...e,
			resources: n.list(e.query)
		} : e), t = n.subscribe?.(e);
		return e(), t;
	}, [n]);
	let f = C({
		workbench: t,
		query: d,
		resources: s.request === n ? s.resources : [],
		onClose: i
	});
	return /* @__PURE__ */ l(x, { children: /* @__PURE__ */ l(c, {
		open: !0,
		resetKey: n,
		label: n.label,
		entries: f,
		placeholder: n.placeholder,
		inputIcon: /* @__PURE__ */ l(r, { name: "Search" }),
		emptyLabel: "No resources found.",
		onQueryChange: (e) => u({
			request: n,
			query: e,
			resources: n.list(e)
		}),
		onClose: i
	}) });
};
export { d as a, b as c, h as d, f as i, g as l, C as n, v as o, x as r, y as s, w as t, _ as u };
