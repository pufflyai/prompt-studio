// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./useQuery-OeRqqLZF.ts";
import { t as n } from "./useQueries-B-OSez1o.ts";
import { a as r, d as i, i as a, l as o, r as s, s as c } from "./module-DYoDP9uf.ts";
import { useState as l } from "react";
import { Box as u, Center as d, Flex as f, Text as p } from "@chakra-ui/react";
import { EmptyState as m, resolveFileIconElement as h, useFileIconThemePreference as g } from "@pstdio/ui";
import { jsx as _ } from "react/jsx-runtime";
import { DiffViewer as v } from "@pstdio/ui/diff";
// packages/pstdio-dashboard/src/modules/workspaces/components/workspace-widget.tsx
var y = (e, t) => ({
	change: e.change,
	oldPath: e.oldPath ?? e.filePath,
	newPath: e.newPath ?? e.filePath,
	additions: e.additions,
	deletions: e.deletions,
	...t ? {
		oldContent: t.oldContent ?? "",
		newContent: t.newContent ?? ""
	} : {}
}), b = (i) => {
	let a = e(), [u, d] = l({ paths: [] }), f = i?.workspaceId, p = i?.mode ?? "fork_point", m = i ? `${i.workspaceId}:${i.mode}` : void 0, h = u.requestKey === m ? u.paths : [], g = t({
		...o(f ?? "", p),
		enabled: !!f
	}), _ = n({ queries: f ? h.map((e) => c(f, p, e)) : [] }), v = new Map(_.map((e) => e.data).filter((e) => e != null).map((e) => [r(e), e])), b = g.data?.files ?? [];
	return {
		diffs: b.map((e) => y(e, v.get(r(e)))),
		paths: b.map(r),
		defaultSelectedPath: s(b),
		loading: g.isLoading,
		error: g.error,
		loadDiff: async (e) => {
			f && (d((t) => {
				let n = t.requestKey === m ? t.paths : [];
				return {
					requestKey: m,
					paths: n.includes(e) ? n : [...n, e]
				};
			}), await a.fetchQuery(c(f, p, e)));
		}
	};
}, x = (e) => {
	let { input: t } = e, n = a({
		resourceId: t.instance.resource?.id,
		metadata: t.instance.resource?.metadata
	}), { diffs: r, paths: o, defaultSelectedPath: s, loading: c, error: l, loadDiff: y } = b(n), { activeFileIconTheme: x } = g(), S = i(t.instance.resource, "workspaceError"), C = i(t.instance.resource, "workspaceProviderState");
	if (S || l) return /* @__PURE__ */ _(d, {
		h: "full",
		minH: "0",
		bg: "bg",
		p: "md",
		children: /* @__PURE__ */ _(p, {
			color: "fg.error",
			children: S || (l instanceof Error ? l.message : "Failed to load workspace changes.")
		})
	});
	if (!n) {
		let e = !C || C === "provisioning";
		return /* @__PURE__ */ _(d, {
			h: "full",
			minH: "0",
			bg: "bg",
			p: "md",
			children: /* @__PURE__ */ _(m, {
				title: e ? "Preparing workspace" : "Changes unavailable",
				description: e ? "Changes will appear when the workspace is ready." : "This workspace is not available for reviewing changes."
			})
		});
	}
	return /* @__PURE__ */ _(f, {
		direction: "column",
		h: "full",
		minH: "0",
		minW: "0",
		bg: "bg",
		children: /* @__PURE__ */ _(u, {
			position: "relative",
			flex: "1",
			minH: "0",
			minW: "0",
			children: /* @__PURE__ */ _(u, {
				position: "absolute",
				inset: "0",
				display: "flex",
				minH: "0",
				minW: "0",
				overflow: "hidden",
				children: /* @__PURE__ */ _(v, {
					diffs: r,
					changedFilePaths: o,
					defaultSelectedPath: s,
					loading: c,
					onLoadDiff: y,
					resolveFileIcon: (e) => {
						let t = e.split("/").pop() ?? e;
						return {
							icon: h(t, { theme: x }),
							color: "fg.subtle"
						};
					}
				})
			})
		})
	});
};
export { x as WorkspaceDiffsPanel };
