// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./useQuery-OeRqqLZF.ts";
import { t } from "./useQueries-B-OSez1o.ts";
import { t as n } from "./cloud-Bj0H0fk_.ts";
import { t as r } from "./folder-DJ8ZbA4G.ts";
import { t as i } from "./plus-CYkLGSPS.ts";
import { t as a } from "./search-FHo0INnP.ts";
import { t as o } from "./settings-DjkPFa7Q.ts";
import { t as s } from "./useTranslation-DvWg4zeU.ts";
import { t as c } from "./use-workbench-store-BMaFgEbb.ts";
import { t as l } from "./settings-resources-BmVO5oBi.ts";
import { n as u } from "./api-BQ3Fs8xe.ts";
import { n as d } from "./project-context-BR7AjHlE.ts";
import { t as f } from "./commands-Bp5w85f4.ts";
import { a as p, t as m } from "./dashboard-rows-wkmk8GQV.ts";
import { t as h } from "./project-data-BZ7dVP-4.ts";
import { useState as g, useSyncExternalStore as _ } from "react";
import { Box as v, Button as y, Icon as b, Stack as x, Text as S } from "@chakra-ui/react";
import { EmptyState as C, ListRow as w, SearchModalContent as T } from "@pstdio/ui";
import { jsx as E, jsxs as D } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/projects/data/cloud-project-states.ts
var O = 2e3, k = (n) => {
	let r = e({
		queryKey: ["account-status"],
		queryFn: () => u().account.status(),
		refetchInterval: O
	}), i = new Set(r.data?.cloudProjects ?? []), a = n.filter((e) => i.has(e)), o = t({ queries: a.map((e) => ({
		queryKey: ["project-sync-status", e],
		queryFn: () => u().account.projectSyncStatus(e),
		refetchInterval: O
	})) }), s = !!r.data?.login;
	return (e) => {
		let t = a.indexOf(e);
		return {
			signedIn: s,
			cloud: t !== -1,
			sync: o[t]?.data
		};
	};
}, A = (e) => e.sync ? e.sync.state === "first-download-incomplete" ? "list.cloudNotOnDevice" : e.sync.state === "needs-attention" ? "list.cloudNeedsAttention" : e.sync.offlineReady ? "list.cloudReady" : "list.cloudWaiting" : "list.cloud", j = (e, t) => t.cloud ? e ? {
	key: "path",
	path: e
} : { key: A(t) } : e ? t.signedIn ? {
	key: "list.localPath",
	path: e
} : {
	key: "path",
	path: e
} : { key: "list.noFolder" }, M = (e, t, n) => {
	let r = t.trim().toLowerCase();
	return r ? e.filter((e) => {
		let t = e.folderPath ?? "";
		return e.name.toLowerCase().includes(r) || t.toLowerCase().includes(r);
	}) : e;
}, N = (e) => {
	let { projects: t, selectedProjectId: i, searchTerm: a, cloudState: o, onSelectProject: c } = e, { t: l } = s("projects");
	return t.length === 0 && a.trim().length > 0 ? /* @__PURE__ */ E(v, {
		px: "sm",
		py: "sm",
		children: /* @__PURE__ */ E(S, {
			textStyle: "paragraph/S/regular",
			color: "fg.muted",
			children: l("list.noSearchResults")
		})
	}) : t.length === 0 ? /* @__PURE__ */ E(v, {
		px: "sm",
		py: "md",
		children: /* @__PURE__ */ E(C, {
			title: l("list.noProjectsYet"),
			description: l("list.noProjectsDescription")
		})
	}) : /* @__PURE__ */ E(x, {
		gap: "0",
		children: t.map((e) => {
			let t = o(e.id), a = j(e.folderPath, t);
			return /* @__PURE__ */ E(w, {
				variant: "full-width",
				id: e.id,
				label: e.name,
				description: a.key === "path" ? a.path : l(a.key, { path: a.path }),
				icon: /* @__PURE__ */ E(b, {
					as: t.cloud ? n : r,
					boxSize: "16px"
				}),
				isSelected: e.id === i,
				onActivate: () => c(e)
			}, e.id);
		})
	});
}, P = (e) => {
	let { input: t } = e, { t: n } = s("projects"), [r, u] = g(""), v = c(t.workbench.context.store, (e) => e.values[d]), x = _(p, m, m), S = typeof v == "string" ? v : void 0, C = h(), w = C.length >= 8, O = w ? r : "", A = M(C, O, x), j = k(C.map((e) => e.id));
	return /* @__PURE__ */ E(T, {
		title: n("title"),
		showSearch: w,
		searchValue: r,
		searchPlaceholder: n("list.searchPlaceholder"),
		searchIcon: /* @__PURE__ */ E(a, { size: 14 }),
		searchAutoFocus: !0,
		footerStart: S ? void 0 : /* @__PURE__ */ D(y, {
			variant: "ghost",
			size: "sm",
			onClick: () => void t.workbench.commands.executeCommand(l),
			children: [/* @__PURE__ */ E(b, { as: o }), n("list.settings")]
		}),
		footerEnd: /* @__PURE__ */ D(y, {
			variant: "outline",
			size: "sm",
			onClick: () => {
				t.workbench.commands.executeCommand(f.createProject);
			},
			children: [/* @__PURE__ */ E(b, { as: i }), n("list.createProject")]
		}),
		scrollAreaProps: {
			maxH: "24rem",
			viewportProps: { overscrollBehavior: "contain" },
			p: "0",
			gap: "0"
		},
		onSearchChange: u,
		children: /* @__PURE__ */ E(N, {
			projects: A,
			selectedProjectId: S,
			searchTerm: O,
			cloudState: j,
			onSelectProject: (e) => {
				t.workbench.commands.executeCommand(f.selectProject, { project: {
					id: e.id,
					name: e.name
				} });
			}
		})
	});
};
export { P as n, N as t };
