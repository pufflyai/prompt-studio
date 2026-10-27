// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./workbench-core-N58OeDyx.ts";
import { t } from "./workbench-BYYWgWSr.ts";
import { t as n } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as r } from "react";
import { Box as i, Button as a, Code as o, HStack as s, Stack as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
import { resourceKey as f } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/examples/api/resource-tabs-example.tsx
var p = "guide.document", m = "guide.branch-inspector", h = "guide.new-document", g = {
	alpha: {
		type: "document",
		id: "alpha",
		label: "Alpha.md"
	},
	beta: {
		type: "document",
		id: "beta",
		label: "Beta.md"
	},
	gamma: {
		type: "document",
		id: "gamma",
		label: "Gamma.md"
	}
}, _ = {
	main: {
		type: "branch",
		id: "main",
		label: "main"
	},
	release: {
		type: "branch",
		id: "release",
		label: "release/v0.31"
	}
}, v = (e, t, n, r) => e.shellPlacements.openPlacement({
	placementId: p,
	resource: t,
	title: t.label,
	open: n,
	region: r
}), y = (e, t) => {
	e.shellPlacements.openPlacement({
		placementId: m,
		resource: t,
		title: `Inspect ${t.label}`
	});
}, b = (e) => {
	let { showCardinalityComparison: t, workbench: n } = e;
	return /* @__PURE__ */ d(c, {
		gap: "md",
		p: "lg",
		children: [
			/* @__PURE__ */ d(c, {
				gap: "xs",
				children: [/* @__PURE__ */ u(l, {
					textStyle: "heading/M",
					children: "Resource cardinality"
				}), /* @__PURE__ */ u(l, {
					color: "fg.muted",
					children: "One placement replaces its resource. The other keeps a tab for every open document."
				})]
			}),
			t ? /* @__PURE__ */ d(c, {
				gap: "sm",
				borderWidth: "1px",
				borderColor: "border.subtle",
				p: "md",
				children: [/* @__PURE__ */ d(s, {
					gap: "sm",
					flexWrap: "wrap",
					children: [/* @__PURE__ */ u(o, { children: "cardinality: \"one\"" }), /* @__PURE__ */ u(l, {
						color: "fg.muted",
						children: "One inspector tab follows the latest branch."
					})]
				}), /* @__PURE__ */ d(s, {
					gap: "sm",
					flexWrap: "wrap",
					children: [/* @__PURE__ */ u(a, {
						size: "sm",
						variant: "outline",
						onClick: () => y(n, _.main),
						children: "Inspect main"
					}), /* @__PURE__ */ u(a, {
						size: "sm",
						variant: "outline",
						onClick: () => y(n, _.release),
						children: "Inspect release/v0.31"
					})]
				})]
			}) : null,
			/* @__PURE__ */ d(c, {
				gap: "sm",
				borderWidth: "1px",
				borderColor: "border.subtle",
				p: "md",
				children: [/* @__PURE__ */ d(s, {
					gap: "sm",
					flexWrap: "wrap",
					children: [/* @__PURE__ */ u(o, { children: "cardinality: \"many\"" }), /* @__PURE__ */ u(l, {
						color: "fg.muted",
						children: "Pinned documents stay open. The unpinned preview is reused."
					})]
				}), /* @__PURE__ */ d(s, {
					gap: "sm",
					flexWrap: "wrap",
					children: [
						/* @__PURE__ */ u(a, {
							size: "sm",
							onClick: () => void n.commands.executeCommand(h),
							children: "New document"
						}),
						/* @__PURE__ */ u(a, {
							size: "sm",
							onClick: () => v(n, g.alpha, "preview"),
							children: "Preview Alpha"
						}),
						/* @__PURE__ */ u(a, {
							size: "sm",
							onClick: () => v(n, g.beta, "preview"),
							children: "Preview Beta"
						}),
						/* @__PURE__ */ u(a, {
							size: "sm",
							onClick: () => v(n, g.gamma, "preview"),
							children: "Preview Gamma"
						}),
						/* @__PURE__ */ u(a, {
							size: "sm",
							variant: "outline",
							onClick: () => v(n, g.alpha, "pin"),
							children: "Pin Alpha"
						}),
						/* @__PURE__ */ u(a, {
							size: "sm",
							variant: "outline",
							onClick: () => v(n, g.beta, "pin"),
							children: "Pin Beta"
						})
					]
				})]
			})
		]
	});
}, x = (t = !1) => {
	let n = e({ regionSettings: { secondary: { alwaysShowTabs: !0 } } }), r = 1;
	return n.commands.registerCommand({
		id: h,
		label: "New document"
	}, { execute: (e, t) => {
		let i = r++;
		return v(n, {
			type: "document",
			id: `new-${i}`,
			label: `Document ${i}.md`
		}, "pin", t?.region);
	} }), n.views.registerView({
		id: "guide.documents",
		title: "Documents",
		body: {
			kind: "react",
			render: ({ workbench: e }) => /* @__PURE__ */ u(b, {
				workbench: e,
				showCardinalityComparison: t
			})
		}
	}), n.shellPlacements.registerPlacement({
		id: "guide.documents",
		item: {
			kind: "view",
			presence: "fixed",
			view: {
				kind: "view",
				id: "guide.documents"
			}
		},
		region: "main"
	}), n.views.registerView({
		id: "guide.document-view",
		title: "Document",
		body: {
			kind: "react",
			render: ({ instance: e }) => /* @__PURE__ */ d(c, {
				gap: "sm",
				p: "lg",
				children: [/* @__PURE__ */ u(l, {
					textStyle: "heading/M",
					children: e.resource?.label
				}), /* @__PURE__ */ u(l, {
					color: "fg.muted",
					children: f(e.resource)
				})]
			})
		}
	}), n.shellPlacements.registerPlacement({
		id: p,
		item: {
			kind: "binding",
			binding: {
				kinds: [{
					kind: "resource-kind",
					id: "document"
				}],
				view: {
					kind: "view",
					id: "guide.document-view"
				},
				cardinality: "many",
				add: {
					kind: "command",
					target: { command: {
						kind: "command",
						id: h
					} }
				}
			}
		},
		region: "secondary"
	}), t && (n.views.registerView({
		id: "guide.branch-inspector",
		title: "Branch inspector",
		body: {
			kind: "react",
			render: ({ instance: e }) => /* @__PURE__ */ d(c, {
				gap: "sm",
				p: "lg",
				children: [
					/* @__PURE__ */ u(l, {
						textStyle: "heading/M",
						children: e.resource?.label
					}),
					/* @__PURE__ */ u(l, {
						color: "fg.muted",
						children: "This same tab rebinds when you inspect another branch."
					}),
					/* @__PURE__ */ u(o, {
						alignSelf: "flex-start",
						children: f(e.resource)
					})
				]
			})
		}
	}), n.shellPlacements.registerPlacement({
		id: m,
		item: {
			kind: "binding",
			binding: {
				kinds: [{
					kind: "resource-kind",
					id: "branch"
				}],
				view: {
					kind: "view",
					id: "guide.branch-inspector"
				},
				cardinality: "one"
			}
		},
		region: "secondary"
	}), y(n, _.main), v(n, g.alpha, "pin"), v(n, g.beta, "preview")), n;
}, S = (e) => {
	let { showCardinalityComparison: a = !1 } = e, [o] = r(() => x(a));
	return /* @__PURE__ */ u(n, { children: /* @__PURE__ */ u(i, {
		h: "480px",
		minH: "360px",
		borderWidth: "1px",
		borderColor: "border.subtle",
		overflow: "hidden",
		children: /* @__PURE__ */ u(t, { workbench: o })
	}) });
};
export { S as t };
