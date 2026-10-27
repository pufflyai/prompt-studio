// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-up-right-CUuzCgQb.ts";
import { t } from "./book-open-OD77qyyJ.ts";
import { t as n } from "./circle-dot-DzEudT09.ts";
import { t as r } from "./download-B4RJJThF.ts";
import { t as i } from "./file-text-B9-uT4dU.ts";
import { t as a } from "./github--jDPcRoW.ts";
import { t as o } from "./messages-square-BlwGm9iJ.ts";
import { t as s } from "./newspaper-DQI2-Eer.ts";
import { t as c } from "./sun-moon-C67AbMAy.ts";
import { r as l } from "./docs-topics-4UNaLo2y.ts";
import { n as u, r as d, t as f } from "./landing-content-Dr_aPkzK.ts";
import { a as p } from "./landing-route-DJns_G_o.ts";
import { t as m } from "./desktop-releases-TalCnyn2.ts";
import { useBreakpointValue as h } from "@chakra-ui/react";
import { Palette as g, filterPaletteEntries as _, useThemePreference as v } from "@pstdio/ui";
import { jsx as y } from "react/jsx-runtime";
// clients/landing-page/src/components/workbench/command-palette-modal.tsx
var b = {
	start: "home landing start here install",
	"what-is-prompt-studio": "what is prompt studio extensions tools building blocks workbench",
	examples: "examples tools icons coding agent dashboard kanban financial formula glossary building blocks",
	features: "features search notifications navigation extension management themes plumbing"
}, x = (x) => {
	let { open: S, pages: C, onClose: w, onNavigate: T } = x, { toggleThemePreference: E } = v(), D = h({
		base: !0,
		lg: !1
	}) ?? !0, O = (e) => () => {
		w(), e();
	}, k = [
		...f.map((e) => {
			let t = d[e].icon;
			return {
				id: `nav:${e}`,
				label: d[e].label,
				searchText: b[e],
				icon: /* @__PURE__ */ y(t, { size: 14 }),
				path: p(e)
			};
		}),
		{
			id: "nav:docs",
			label: "Docs",
			searchText: "documentation guides references",
			icon: /* @__PURE__ */ y(t, { size: 14 }),
			path: "/docs/"
		},
		{
			id: "nav:blog",
			label: "Blog",
			searchText: "news posts releases",
			icon: /* @__PURE__ */ y(s, { size: 14 }),
			path: "/blog/"
		}
	].map(({ path: e, ...t }) => ({
		...t,
		group: "Navigate",
		onActivate: O(() => T(e))
	})), A = C.flatMap((e) => {
		if (e.view !== "doc" && e.view !== "post") return [];
		let t = l(e.path)?.label;
		return {
			id: `page:${e.path}`,
			label: e.label,
			secondaryLabel: t,
			searchText: t,
			group: e.view === "doc" ? "Docs" : "Blog",
			assetType: e.view,
			icon: e.view === "doc" ? /* @__PURE__ */ y(i, { size: 14 }) : /* @__PURE__ */ y(s, { size: 14 }),
			onActivate: O(() => T(e.path))
		};
	}), j = [
		{
			id: "ext:github",
			label: "GitHub",
			searchText: "github source repository code",
			icon: /* @__PURE__ */ y(a, { size: 14 }),
			url: u.github
		},
		{
			id: "ext:issues",
			label: "Issues",
			searchText: "issues bugs report",
			icon: /* @__PURE__ */ y(n, { size: 14 }),
			url: u.issues
		},
		{
			id: "ext:discord",
			label: "Discord",
			searchText: "discord community chat help",
			icon: /* @__PURE__ */ y(o, { size: 14 }),
			url: u.discord
		}
	].map(({ url: t, ...n }) => ({
		...n,
		group: "Navigate",
		endContent: /* @__PURE__ */ y(e, { size: 12 }),
		onActivate: O(() => window.open(t, "_blank", "noopener"))
	})), M = [{
		id: "command:download",
		label: "Download Prompt Studio",
		searchText: "download install desktop macos windows linux",
		group: "Commands",
		icon: /* @__PURE__ */ y(r, { size: 14 }),
		onActivate: O(() => window.open(m, "_blank", "noopener"))
	}, {
		id: "command:toggle-theme",
		label: "Toggle light/dark theme",
		searchText: "toggle theme light dark mode appearance",
		group: "Commands",
		icon: /* @__PURE__ */ y(c, { size: 14 }),
		onActivate: O(E)
	}];
	return /* @__PURE__ */ y(g, {
		open: S,
		fullScreen: D,
		searchAutoFocus: !D,
		entries: [
			...k,
			...j,
			...A,
			...M
		],
		filterEntries: (e, t) => _(e, {
			query: t,
			defaultAssetLimit: 0
		}),
		placeholder: "Search or run a command…",
		onClose: w
	});
};
export { x as CommandPaletteModal };
