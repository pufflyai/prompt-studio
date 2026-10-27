// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./message-circle-DP0BFDQF.ts";
import { t } from "./moon-L5AtxmV1.ts";
import { t as n } from "./palette-pgRzNhdq.ts";
import { t as r } from "./plus-CYkLGSPS.ts";
import { t as i } from "./search-FHo0INnP.ts";
import { t as a } from "./settings-DjkPFa7Q.ts";
import { t as o } from "./square-kanban-DzsMXKKR.ts";
import { t as s } from "./sun-CdbAol6Z.ts";
import { t as c } from "./terminal-B2gAfUK-.ts";
import { t as l } from "./palette-CNb9VaIS.ts";
import { t as u } from "./palette-shortcut-01lOZVwG.ts";
import { useState as d } from "react";
import { Box as f, HStack as p, Text as m } from "@chakra-ui/react";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
// packages/ui/src/components/command-palette/palette.stories.tsx
var _ = [
	{
		id: "nav:tickets",
		mode: "search",
		label: "Tickets",
		searchText: "tickets board backlog kanban",
		icon: /* @__PURE__ */ h(o, { size: 14 }),
		onActivate: () => void 0
	},
	{
		id: "nav:sessions",
		mode: "search",
		label: "Sessions",
		searchText: "sessions chat agents",
		icon: /* @__PURE__ */ h(e, { size: 14 }),
		onActivate: () => void 0
	},
	{
		id: "nav:settings",
		mode: "search",
		label: "Project settings",
		searchText: "settings project tags statuses repositories agents",
		icon: /* @__PURE__ */ h(a, { size: 14 }),
		onActivate: () => void 0
	},
	{
		id: "command:create-ticket",
		mode: "command",
		label: "Create ticket",
		searchText: "create ticket new issue",
		icon: /* @__PURE__ */ h(r, { size: 14 }),
		onActivate: () => void 0
	},
	{
		id: "command:change-theme",
		mode: "command",
		label: "Change theme",
		searchText: "theme color appearance preferences",
		shortcut: /* @__PURE__ */ h(u, { binding: "Alt+Shift+T" }),
		icon: /* @__PURE__ */ h(n, { size: 14 }),
		onActivate: () => void 0
	},
	{
		id: "ticket:PS-74",
		mode: "search",
		label: "PS-74 Add command palette",
		icon: /* @__PURE__ */ h(o, { size: 14 }),
		onActivate: () => void 0
	},
	{
		id: "ticket:PS-101",
		mode: "search",
		label: "PS-101 Theme dashboard surfaces",
		icon: /* @__PURE__ */ h(o, { size: 14 }),
		onActivate: () => void 0
	},
	{
		id: "session:session-1",
		mode: "search",
		label: "Plan project sidenav updates",
		searchText: "session chat agent",
		icon: /* @__PURE__ */ h(e, { size: 14 }),
		onActivate: () => void 0
	}
], v = [
	{
		id: "theme:pstdio-light",
		mode: "theme",
		label: "Light",
		searchText: "theme color pstdio-light light",
		icon: /* @__PURE__ */ h(s, { size: 14 }),
		isSelected: !0,
		onActivate: () => void 0
	},
	{
		id: "theme:pstdio-dark",
		mode: "theme",
		label: "Dark",
		searchText: "theme color pstdio-dark dark",
		icon: /* @__PURE__ */ h(t, { size: 14 }),
		onActivate: () => void 0
	},
	{
		id: "theme:monokai",
		mode: "theme",
		label: "Monokai",
		searchText: "theme color monokai",
		icon: /* @__PURE__ */ h(n, { size: 14 }),
		onActivate: () => void 0
	}
], y = [...Array.from({ length: 180 }, (e, t) => ({
	id: `ticket:PS-${t + 200}`,
	mode: "search",
	label: `PS-${t + 200} Virtualized ticket asset ${t + 1}`,
	group: "Tickets",
	assetType: "ticket",
	icon: /* @__PURE__ */ h(o, { size: 14 }),
	onActivate: () => void 0
})), ...Array.from({ length: 120 }, (t, n) => ({
	id: `session:large-session-${n + 1}`,
	mode: "search",
	label: `Virtualized session asset ${n + 1}`,
	searchText: "session chat agent",
	group: "Sessions",
	assetType: "session",
	icon: /* @__PURE__ */ h(e, { size: 14 }),
	onActivate: () => void 0
}))], b = [{ id: "search" }, {
	id: "command",
	inputPrefix: ">"
}], x = (e) => {
	let { fullScreen: t, searchAutoFocus: n, entries: r = _, initialQuery: a = "", initialActiveIndex: o = 0, modes: s, placeholder: v = "Search tickets, sessions, commands", footerEnd: y } = e, [b, x] = d(!0);
	return /* @__PURE__ */ h(f, {
		bg: "bg",
		minH: "32rem",
		p: "lg",
		children: /* @__PURE__ */ h(l, {
			open: b,
			fullScreen: t,
			searchAutoFocus: n,
			entries: r,
			initialQuery: a,
			initialActiveIndex: o,
			modes: s,
			resetKey: a,
			inputIcon: ({ mode: e }) => h(e === "command" ? c : i, { size: 16 }),
			placeholder: ({ mode: e }) => e === "command" ? "Run command" : v,
			emptyLabel: "No results.",
			footerStart: /* @__PURE__ */ g(p, {
				gap: "2",
				color: "fg.muted",
				children: [/* @__PURE__ */ h(m, {
					textStyle: "label/XS",
					children: "Open palette"
				}), /* @__PURE__ */ h(u, { binding: "Mod+P" })]
			}),
			footerEnd: /* @__PURE__ */ h(m, {
				textStyle: "label/XS",
				color: "fg.muted",
				children: y ?? "Type to filter results"
			}),
			onClose: () => x(!1)
		})
	});
}, S = {
	title: "Components/Overlays/Palette",
	component: x,
	parameters: { layout: "fullscreen" }
}, C = { render: () => /* @__PURE__ */ h(x, {}) }, w = { render: () => /* @__PURE__ */ h(x, { initialActiveIndex: 2 }) }, T = { render: () => /* @__PURE__ */ h(x, {
	entries: v,
	placeholder: "Choose a theme",
	footerEnd: "Preview theme"
}) }, E = {
	render: () => /* @__PURE__ */ h(x, {
		fullScreen: !0,
		searchAutoFocus: !1,
		entries: y
	}),
	parameters: { docs: { description: { story: "Fill the viewport and focus the dialog on open. Search receives focus only when selected." } } }
}, D = { render: () => /* @__PURE__ */ h(x, {
	modes: b,
	initialQuery: "> ",
	placeholder: "Search resources",
	footerEnd: "Type > to search commands"
}) }, O = [
	{
		id: "intro",
		label: "Introduction"
	},
	{
		id: "architecture",
		label: "Architecture overview"
	},
	{
		id: "demo",
		label: "Live demo"
	},
	{
		id: "q-and-a",
		label: "Q&A"
	}
], k = (e) => {
	let t = e.trim().toLowerCase();
	return O.filter((e) => !t || e.label.toLowerCase().includes(t)).map((t) => ({
		id: `slide:${t.id}`,
		label: t.label,
		searchText: `${e} ${t.label}`,
		group: "Slides",
		onActivate: () => void 0
	}));
}, A = () => {
	let [e, t] = d(!0), [n, r] = d(() => k(""));
	return /* @__PURE__ */ h(f, {
		bg: "bg",
		minH: "32rem",
		p: "lg",
		children: /* @__PURE__ */ h(l, {
			open: e,
			entries: n,
			resetKey: "async",
			inputIcon: () => /* @__PURE__ */ h(i, { size: 16 }),
			placeholder: "Search slides (results fetched per query)",
			emptyLabel: "No slides match.",
			footerEnd: /* @__PURE__ */ h(m, {
				textStyle: "label/XS",
				color: "fg.muted",
				children: "Results update as you type"
			}),
			onQueryChange: (e) => r(k(e)),
			onClose: () => t(!1)
		})
	});
}, j = { render: () => /* @__PURE__ */ h(A, {}) }, M = { render: () => /* @__PURE__ */ h(x, { entries: y }) };
export { j as AsyncResults, C as Default, E as FullScreenNavigation, w as KeyboardSelection, M as LargeAssetSet, D as Modes, T as ThemeMenu, S as default };
