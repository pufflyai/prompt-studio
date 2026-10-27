// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./useQuery-OeRqqLZF.ts";
import { t } from "./skills-api-BmZGdBXb.ts";
import { useEffect as n, useState as r } from "react";
import { Badge as i, Box as a, Flex as o, Spinner as s, Stack as c, Text as l } from "@chakra-ui/react";
import { ScrollArea as u, TreeList as d, resolveFileIconElement as f, useFileIconThemePreference as p } from "@pstdio/ui";
import { jsx as m, jsxs as h } from "react/jsx-runtime";
import { MarkdownEditor as g } from "@pstdio/ui/rich-text";
// packages/pstdio-dashboard/src/modules/settings/data/use-skills.ts
var _ = (e, t) => [
	"project-skill",
	e,
	t
], v = (n, r) => e({
	queryKey: _(n, r),
	queryFn: () => t(n, r),
	enabled: !!(n && r)
}), y = (e, t) => ({
	name: e,
	path: t,
	children: /* @__PURE__ */ new Map(),
	files: []
}), b = (e, t) => {
	let n = t.path.split("/"), r = n.pop() ?? t.path, i = e, a = "";
	for (let e of n) {
		a = a ? `${a}/${e}` : e;
		let t = i.children.get(e);
		t || (t = y(e, a), i.children.set(e, t)), i = t;
	}
	i.files.push({
		...t,
		path: r
	});
}, x = (e, t) => e.name.localeCompare(t.name), S = (e, t, n) => {
	let r = [...e.children.values()].sort(x).map((e) => ({
		id: `dir:${e.path}`,
		label: e.name,
		icon: f(e.name, {
			isDirectory: !0,
			theme: n
		}),
		children: S(e, e.path, n)
	})), i = [...e.files].sort((e, n) => t === "" && e.path === "SKILL.md" ? -1 : t === "" && n.path === "SKILL.md" ? 1 : e.path.localeCompare(n.path)).map((e) => ({
		id: t ? `${t}/${e.path}` : e.path,
		label: e.path,
		icon: f(e.path, { theme: n }),
		isNavigable: !0
	}));
	return [...r, ...i];
}, C = (e, t) => {
	let n = y("", "");
	for (let t of e) b(n, t);
	return S(n, "", t);
}, w = (e) => {
	let t = [], n = (e) => {
		for (let r of e) r.children && r.children.length > 0 && (t.push(r.id), n(r.children));
	};
	return n(e), t;
}, T = (e) => e.match(/^\s*-?\s*version:\s*(.+)\s*$/m)?.[1]?.trim() ?? "", E = "720px", D = (e) => e.find((e) => e.path === "SKILL.md")?.path ?? e[0]?.path ?? "", O = (e) => e.toLowerCase().endsWith(".md"), k = (e) => e ? `v${e}` : "unknown", A = (e) => {
	let { skill: t } = e, { activeFileIconTheme: s } = p(), f = C(t.files, s), [_, v] = r(() => w(f)), [y, b] = r(D(t.files));
	n(() => {
		v(w(C(t.files, s)));
	}, [t.files, s]), n(() => {
		b(D(t.files));
	}, [t.files]);
	let x = [{
		id: "files",
		nodes: f,
		collapsible: !1
	}], S = t.files.find((e) => e.path === y) ?? t.files[0], A = T(t.files.find((e) => e.path === "SKILL.md")?.content ?? "");
	return /* @__PURE__ */ h(o, {
		h: "full",
		minH: "0",
		minW: "0",
		overflow: "hidden",
		"data-testid": "project-skill-content",
		children: [/* @__PURE__ */ h(o, {
			h: "full",
			minH: "0",
			width: "280px",
			minW: "220px",
			flexShrink: "0",
			borderRightWidth: "1px",
			direction: "column",
			children: [/* @__PURE__ */ m(a, {
				flexShrink: "0",
				borderBottomWidth: "1px",
				padding: "sm",
				children: t.agent_installations.length > 0 ? /* @__PURE__ */ m(c, {
					gap: "xs",
					"data-testid": "project-skill-agent-installations",
					children: t.agent_installations.map((e) => /* @__PURE__ */ h(o, {
						alignItems: "center",
						gap: "xs",
						minW: "0",
						children: [/* @__PURE__ */ m(l, {
							textStyle: "label/S/regular",
							flex: "1",
							minW: "0",
							truncate: !0,
							children: e.agent_name
						}), /* @__PURE__ */ m(i, {
							size: "sm",
							"data-testid": "project-skill-installed-version",
							children: k(e.installed_version)
						})]
					}, e.agent_id))
				}) : /* @__PURE__ */ m(l, {
					textStyle: "paragraph/XS/regular",
					color: "fg.muted",
					"data-testid": "project-skill-not-installed",
					children: "Not installed locally"
				})
			}), /* @__PURE__ */ m(u, {
				flex: "1",
				minH: "0",
				viewportProps: { style: { overflowX: "hidden" } },
				contentProps: { style: {
					minWidth: "100%",
					width: "100%"
				} },
				"data-testid": "project-skill-file-tree",
				children: /* @__PURE__ */ m(d, {
					sections: x,
					expandedSectionIds: ["files"],
					expandedNodeIds: _,
					activeNodeId: S?.path,
					rowVariant: "tree",
					onToggleNode: (e) => {
						v((t) => t.includes(e) ? t.filter((t) => t !== e) : [...t, e]);
					},
					onNavigate: (e) => {
						b(e.nodeId);
					}
				})
			})]
		}), /* @__PURE__ */ m(u, {
			flex: "1",
			minH: "0",
			minW: "0",
			"data-testid": "project-skill-editor-scroll",
			children: /* @__PURE__ */ m(o, {
				justifyContent: "center",
				minW: "0",
				children: /* @__PURE__ */ h(c, {
					width: "100%",
					maxWidth: E,
					padding: "md",
					gap: "md",
					minW: "0",
					children: [
						/* @__PURE__ */ h(c, {
							gap: "xs",
							children: [/* @__PURE__ */ m(o, {
								alignItems: "flex-start",
								justifyContent: "space-between",
								gap: "sm",
								wrap: "wrap",
								children: /* @__PURE__ */ h(o, {
									alignItems: "center",
									gap: "sm",
									minW: "0",
									flex: "1",
									wrap: "wrap",
									children: [/* @__PURE__ */ m(l, {
										textStyle: "heading/S",
										"data-testid": "project-skill-name",
										children: t.name
									}), A && /* @__PURE__ */ h(i, {
										size: "sm",
										"data-testid": "project-skill-version",
										children: ["v", A]
									})]
								})
							}), /* @__PURE__ */ m(l, {
								textStyle: "paragraph/S/regular",
								color: "fg.muted",
								"data-testid": "project-skill-description",
								children: t.description
							})]
						}),
						!S && /* @__PURE__ */ m(l, {
							textStyle: "paragraph/S/regular",
							color: "fg.muted",
							children: "No skill content."
						}),
						S && O(S.path) && /* @__PURE__ */ m(g, {
							defaultState: S.content,
							isEditable: !1,
							scrollable: !1,
							placeholder: "No content."
						}, `${t.id}:${S.path}`),
						S && !O(S.path) && /* @__PURE__ */ m(u, {
							borderWidth: "1px",
							borderRadius: "sm",
							showHorizontalScrollbar: !0,
							contentProps: { p: "sm" },
							children: /* @__PURE__ */ m(a, {
								as: "pre",
								margin: "0",
								fontFamily: "mono",
								whiteSpace: "pre-wrap",
								"data-testid": "project-skill-code-content",
								children: S.content
							})
						})
					]
				})
			})
		})]
	});
}, j = (e) => {
	let { projectId: t, skillName: n } = e, { data: r, isLoading: i, error: a } = v(t, n);
	return i ? /* @__PURE__ */ m(o, {
		h: "full",
		minH: "0",
		flex: "1",
		justifyContent: "center",
		alignItems: "center",
		padding: "lg",
		children: /* @__PURE__ */ m(s, {})
	}) : a ? /* @__PURE__ */ m(o, {
		h: "full",
		minH: "0",
		flex: "1",
		justifyContent: "center",
		alignItems: "center",
		padding: "lg",
		children: /* @__PURE__ */ m(l, {
			textStyle: "paragraph/S/regular",
			color: "fg.muted",
			children: a instanceof Error ? a.message : "Failed to load skill."
		})
	}) : r ? /* @__PURE__ */ m(A, { skill: r }) : /* @__PURE__ */ m(o, {
		h: "full",
		minH: "0",
		flex: "1",
		justifyContent: "center",
		alignItems: "center",
		padding: "lg",
		children: /* @__PURE__ */ m(l, {
			textStyle: "paragraph/S/regular",
			color: "fg.muted",
			children: "Skill not found."
		})
	});
};
export { j as SkillViewer, A as SkillViewerContent };
