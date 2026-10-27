// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./workbench-core-kaLFKJEn.ts";
import { t } from "./workbench-BbqJVWhj.ts";
import { t as n } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as r } from "react";
import { Badge as i, Box as a, Button as o, HStack as s, Stack as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/page-composition/module.tsx
var f = {
	extensionId: "pstdio.storybook",
	kind: "page",
	id: "session"
}, p = {
	extensionId: "pstdio.storybook",
	kind: "page",
	id: "lab"
}, m = [{
	id: "session",
	ref: f,
	title: "Session S-104",
	modeId: "session",
	path: "sessions/S-104",
	description: "Codex is updating the workbench onboarding examples for PS-336.",
	details: [
		"Task: PS-336",
		"7 files changed",
		"Validation: pending"
	],
	layout: "Main + Side + Secondary",
	sidenav: {
		title: "Session files",
		detail: "mode-page.tsx · module.tsx · breadcrumbs.tsx"
	},
	auxiliary: {
		region: "side",
		title: "Session inspector",
		detail: "Agent output, changed files, and session metadata stay visible at full height."
	},
	target: p,
	targetLabel: "Open Extension Lab"
}, {
	id: "lab",
	ref: p,
	title: "Extension Lab",
	modeId: "lab",
	path: "extension-lab",
	description: "Inspect the installed Planner extension and its workbench contributions.",
	details: [
		"Extension: pstdio-planner",
		"API: 0.1.0",
		"State: enabled"
	],
	layout: "Main + Side + Secondary",
	sidenav: {
		title: "Contributions",
		detail: "2 pages · 4 views · 6 commands"
	},
	auxiliary: {
		region: "secondary",
		title: "Validation output",
		detail: "Manifest and contribution checks passed in the bottom panel."
	},
	target: f,
	targetLabel: "Return to Session S-104"
}], h = (e) => {
	let { input: t, page: n, showNavigation: r } = e;
	return /* @__PURE__ */ u(a, {
		h: "full",
		p: "lg",
		bg: "bg",
		children: /* @__PURE__ */ d(c, {
			gap: "md",
			maxW: "560px",
			children: [
				/* @__PURE__ */ d(c, {
					gap: "xs",
					children: [/* @__PURE__ */ d(s, {
						gap: "sm",
						flexWrap: "wrap",
						children: [
							/* @__PURE__ */ u(l, {
								textStyle: "heading/L/semibold",
								children: n.title
							}),
							/* @__PURE__ */ d(i, {
								colorPalette: "blue",
								children: [n.modeId, " mode"]
							}),
							/* @__PURE__ */ u(i, {
								colorPalette: "gray",
								children: n.layout
							})
						]
					}), /* @__PURE__ */ u(l, {
						color: "fg.muted",
						textStyle: "paragraph/M/regular",
						children: n.description
					})]
				}),
				/* @__PURE__ */ u(c, {
					gap: "xs",
					children: n.details.map((e) => /* @__PURE__ */ u(l, { children: e }, e))
				}),
				r ? /* @__PURE__ */ u(o, {
					alignSelf: "flex-start",
					onClick: () => t.workbench.pageLocations.navigate({
						kind: "page",
						page: n.target
					}),
					children: n.targetLabel
				}) : null
			]
		})
	});
}, g = (e) => {
	let { detail: t, owner: n, title: r } = e;
	return /* @__PURE__ */ d(c, {
		h: "full",
		gap: "xs",
		p: "md",
		bg: "bg",
		children: [
			/* @__PURE__ */ u(l, {
				textStyle: "heading/S/semibold",
				children: r
			}),
			/* @__PURE__ */ u(l, { children: t }),
			/* @__PURE__ */ d(l, {
				color: "fg.muted",
				textStyle: "paragraph/XS/regular",
				children: [
					"Owned by ",
					n,
					". It leaves with this page."
				]
			})
		]
	});
}, _ = (e, t, n) => {
	let r = `storybook.${t.id}.main`, i = `storybook.${t.id}.sidenav`, a = `storybook.${t.id}.${t.auxiliary.region}`;
	e.views.registerView({
		id: r,
		title: t.title,
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ u(h, {
				input: e,
				page: t,
				showNavigation: n
			})
		}
	}), e.views.registerView({
		id: i,
		title: t.sidenav.title,
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ u(g, {
				...t.sidenav,
				owner: t.title
			})
		}
	}), e.views.registerView({
		id: a,
		title: t.auxiliary.title,
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ u(g, {
				...t.auxiliary,
				owner: t.title
			})
		}
	}), e.pages.registerPage({
		id: `storybook.${t.id}`,
		ref: t.ref,
		title: t.title,
		path: t.path,
		modeId: t.modeId,
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: r
			},
			cardinality: "one"
		},
		slots: [{
			id: "context",
			region: t.auxiliary.region === "side" ? "secondary" : "side",
			item: {
				kind: "view",
				view: {
					kind: "view",
					id: i
				},
				presence: "fixed"
			}
		}, {
			id: t.auxiliary.region === "side" ? "inspector" : "output",
			region: t.auxiliary.region,
			item: {
				kind: "view",
				view: {
					kind: "view",
					id: a
				},
				presence: "open"
			}
		}]
	});
}, v = (t = {}) => {
	let { projectId: n = "storybook", showNavigation: r = !0, startPage: i = f } = t, a = e({ startPage: i });
	a.modes.registerMode({
		id: "session",
		label: "Session",
		activate: () => void 0
	}), a.modes.registerMode({
		id: "lab",
		label: "Extension Lab",
		activate: () => void 0
	});
	for (let e of m) _(a, e, r);
	return a.pageLocations.switchProject(n), a;
}, y = (e) => {
	let { workbench: n } = e;
	return /* @__PURE__ */ u(a, {
		h: "420px",
		minH: "360px",
		borderWidth: "1px",
		borderColor: "border.subtle",
		overflow: "hidden",
		children: /* @__PURE__ */ u(t, { workbench: n })
	});
}, b = () => {
	let [e] = r(() => v({
		projectId: "storybook-session-composition",
		showNavigation: !1,
		startPage: f
	})), [t] = r(() => v({
		projectId: "storybook-lab-composition",
		showNavigation: !1,
		startPage: p
	}));
	return /* @__PURE__ */ u(n, { children: /* @__PURE__ */ d(c, {
		gap: "xl",
		children: [/* @__PURE__ */ d(c, {
			gap: "sm",
			children: [/* @__PURE__ */ u(l, {
				textStyle: "heading/M/semibold",
				children: "Session composition: full-height Side panel"
			}), /* @__PURE__ */ u(y, { workbench: e })]
		}), /* @__PURE__ */ d(c, {
			gap: "sm",
			children: [/* @__PURE__ */ u(l, {
				textStyle: "heading/M/semibold",
				children: "Extension Lab composition: bottom Secondary panel"
			}), /* @__PURE__ */ u(y, { workbench: t })]
		})]
	}) });
}, x = () => {
	let [e] = r(() => v());
	return /* @__PURE__ */ u(n, { children: /* @__PURE__ */ u(y, { workbench: e }) });
};
export { x as n, v as r, b as t };
