// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./rolldown-runtime-CwxnZyOB.ts";
import { a as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./extension-preview-Dd64xulN.ts";
import { _ as a, b as ee, t as o } from "./workbench-core-N58OeDyx.ts";
import { t as s } from "./icon-D3uE7jD-.ts";
import { t as te } from "./settings-module-AIuYqymV.ts";
import { t as c } from "./settings-resources-BmVO5oBi.ts";
import { n as ne, t as re } from "./module-D85vQAe8.ts";
import { t as ie } from "./resource-tabs-example-BZ7CVm_o.ts";
import { t as ae } from "./host-terminal-story-BoAABSKd.ts";
import { n as oe, r as se, t as ce } from "./module-s4nTM6U-.ts";
import { t as le } from "./views-iju_97p5.ts";
import { n as ue, r as de, t as fe } from "./page-extension-DNMEVn7b.ts";
import { t as l } from "./onboarding-frame-C9daTas8.ts";
import { useState as u } from "react";
import { Badge as d, Box as f, Button as p, Center as pe, Code as me, HStack as m, Stack as h, Text as g, Textarea as he } from "@chakra-ui/react";
import { ScrollArea as ge, Switch as _e } from "@pstdio/ui";
import { jsx as _, jsxs as v } from "react/jsx-runtime";
import { defineExtension as ve, defineNavigationItem as ye, defineNavigationTree as be, definePage as y, defineResourceKind as xe, defineView as b, resourceKey as x, workbenchModes as S } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/examples/settings/components/custom-settings-panel.tsx
var Se = () => {
	let [e, t] = u(!0), [n, r] = u(!1);
	return /* @__PURE__ */ v(ge, {
		h: "full",
		minH: "0",
		contentProps: {
			p: "lg",
			display: "flex",
			flexDirection: "column",
			gap: "lg"
		},
		children: [/* @__PURE__ */ v(h, {
			gap: "xs",
			children: [
				/* @__PURE__ */ v(m, {
					gap: "sm",
					children: [/* @__PURE__ */ _(s, {
						name: "FlaskConical",
						size: 18
					}), /* @__PURE__ */ _(g, {
						textStyle: "heading/M/semibold",
						children: "Lab settings"
					})]
				}),
				/* @__PURE__ */ _(g, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					maxW: "640px",
					children: "A fully custom panel rendered by the contributing extension."
				}),
				/* @__PURE__ */ v(m, {
					gap: "xs",
					children: [/* @__PURE__ */ _(d, {
						colorPalette: "orange",
						children: "custom component"
					}), /* @__PURE__ */ _(d, {
						variant: "outline",
						children: "extension-lab"
					})]
				})
			]
		}), /* @__PURE__ */ _(f, {
			borderWidth: "1px",
			borderColor: "border.subtle",
			borderRadius: "sm",
			p: "md",
			maxW: "640px",
			children: /* @__PURE__ */ v(h, {
				gap: "md",
				children: [
					/* @__PURE__ */ v(m, {
						justify: "space-between",
						gap: "sm",
						children: [/* @__PURE__ */ v(h, {
							gap: "2xs",
							children: [/* @__PURE__ */ _(g, {
								textStyle: "label/S/semibold",
								children: "Usage telemetry"
							}), /* @__PURE__ */ _(g, {
								textStyle: "paragraph/XS/regular",
								color: "fg.muted",
								children: "Share anonymized lab usage with the extension author."
							})]
						}), /* @__PURE__ */ _(_e, {
							checked: e,
							onCheckedChange: (e) => t(e.checked)
						})]
					}),
					/* @__PURE__ */ v(m, {
						justify: "space-between",
						gap: "sm",
						children: [/* @__PURE__ */ v(h, {
							gap: "2xs",
							children: [/* @__PURE__ */ _(g, {
								textStyle: "label/S/semibold",
								children: "Experimental features"
							}), /* @__PURE__ */ _(g, {
								textStyle: "paragraph/XS/regular",
								color: "fg.muted",
								children: "Opt into in-development lab tools."
							})]
						}), /* @__PURE__ */ _(_e, {
							checked: n,
							onCheckedChange: (e) => r(e.checked)
						})]
					}),
					/* @__PURE__ */ v(p, {
						size: "sm",
						variant: "outline",
						w: "fit-content",
						onClick: () => r(!1),
						children: [/* @__PURE__ */ _(s, { name: "RotateCcw" }), "Reset experiments"]
					})
				]
			})
		})]
	});
}, Ce = (e) => {
	let { input: t } = e;
	return /* @__PURE__ */ _(pe, {
		h: "full",
		minH: "0",
		p: "lg",
		children: /* @__PURE__ */ v(h, {
			gap: "md",
			align: "center",
			maxW: "420px",
			textAlign: "center",
			children: [
				/* @__PURE__ */ _(s, {
					name: "Settings",
					size: 28
				}),
				/* @__PURE__ */ _(g, {
					textStyle: "heading/M/semibold",
					children: "Settings"
				}),
				/* @__PURE__ */ _(g, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					children: "The settings surface opens as a modal overlay. Close it any time — reopen it from here."
				}),
				/* @__PURE__ */ v(p, {
					onClick: () => void t.workbench.commands.executeCommand(c),
					children: [/* @__PURE__ */ _(s, { name: "Settings" }), "Open settings"]
				})
			]
		})
	});
}, we = (e) => {
	let { snippet: t } = e, [n, r] = u(t.body);
	return /* @__PURE__ */ v(ge, {
		h: "full",
		minH: "0",
		contentProps: {
			p: "lg",
			display: "flex",
			flexDirection: "column",
			gap: "md"
		},
		children: [/* @__PURE__ */ v(h, {
			gap: "xs",
			children: [/* @__PURE__ */ v(m, {
				gap: "sm",
				children: [/* @__PURE__ */ _(g, {
					textStyle: "heading/M/semibold",
					children: t.name
				}), /* @__PURE__ */ _(d, {
					colorPalette: "purple",
					children: t.category
				})]
			}), /* @__PURE__ */ _(g, {
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				children: "A contributor-owned editor for one collection item — the framework only routed the selection here."
			})]
		}), /* @__PURE__ */ _(f, {
			maxW: "640px",
			children: /* @__PURE__ */ _(he, {
				value: n,
				onChange: (e) => r(e.target.value),
				rows: 6
			})
		})]
	});
}, Te = { properties: {
	"demo.appearance.theme": {
		type: "string",
		enum: [
			"system",
			"light",
			"dark"
		],
		default: "system",
		scope: "user",
		description: "Color theme applied across the workbench."
	},
	"demo.appearance.density": {
		type: "string",
		enum: ["comfortable", "compact"],
		default: "comfortable",
		scope: "user",
		description: "Spacing used for lists, trees, and toolbars."
	},
	"demo.appearance.badges": {
		type: "boolean",
		default: !0,
		scope: "user",
		description: "Show count badges on sidenav entries."
	},
	"demo.editor.fontSize": {
		type: "number",
		default: 13,
		scope: "project",
		description: "Editor font size in pixels (per project)."
	},
	"demo.editor.wordWrap": {
		type: "boolean",
		default: !1,
		scope: "project",
		description: "Wrap long lines to the editor width (per project)."
	},
	"demo.editor.rulers": {
		type: "array",
		enum: [
			"80",
			"100",
			"120"
		],
		default: ["80"],
		scope: "project",
		description: "Columns where vertical rulers are drawn (per project)."
	}
} }, C = [
	{
		id: "greeting",
		name: "Greeting",
		category: "Prose",
		body: "Hello there!"
	},
	{
		id: "signoff",
		name: "Sign-off",
		category: "Prose",
		body: "Best,\n"
	},
	{
		id: "fixme",
		name: "FIXME",
		category: "Code",
		body: "// FIXME: "
	}
], w = 0, T = {
	list: () => [...C],
	create: () => {
		w += 1, C.push({
			id: `snippet-${w}`,
			name: `New snippet ${w}`,
			category: "Prose",
			body: ""
		});
	}
}, Ee = "demo-project", E = "onboarding.settings.launcher", D = "onboarding.settings.lab", O = "onboarding.settings.snippet", De = () => ({
	id: "onboarding.settings",
	activate(e) {
		e.preferences.registerSchema(Te), e.settings.registerSection({
			id: "workbench",
			title: "Workbench",
			order: 10
		}), e.settings.registerSection({
			id: "extensions",
			title: "Extensions",
			order: 20
		}), e.views.registerView({
			id: D,
			title: "Lab settings",
			body: {
				kind: "react",
				render: () => /* @__PURE__ */ _(Se, {})
			}
		}), e.views.registerView({
			id: O,
			title: "Snippet settings",
			body: {
				kind: "react",
				render: (e) => {
					let t = e.instance.resource?.metadata?.panelId, n = e.instance.resource?.metadata?.itemId, r = typeof t == "string" && typeof n == "string" ? e.workbench.settings.getCollectionItem(t, n) : void 0;
					return r ? /* @__PURE__ */ _(we, { snippet: r }) : null;
				}
			}
		}), e.settings.registerPanel({
			kind: "schema",
			id: "appearance",
			title: "Appearance",
			section: "workbench",
			scope: "global",
			icon: "Palette",
			description: "Theme and density — saved per user, applied live.",
			preferences: [
				{
					name: "demo.appearance.theme",
					label: "Theme"
				},
				{
					name: "demo.appearance.density",
					label: "Density"
				},
				{
					name: "demo.appearance.badges",
					label: "Sidenav badges"
				}
			]
		}), e.settings.registerPanel({
			kind: "schema",
			id: "editor",
			title: "Editor",
			section: "workbench",
			scope: "project",
			icon: "PencilRuler",
			description: "Project-scoped editing preferences — staged behind Save.",
			save: "apply",
			preferences: [
				{
					name: "demo.editor.fontSize",
					label: "Font size"
				},
				{
					name: "demo.editor.wordWrap",
					label: "Word wrap"
				},
				{
					name: "demo.editor.rulers",
					label: "Rulers"
				}
			]
		}), e.settings.registerPanel({
			kind: "view",
			id: "lab",
			title: "Lab",
			section: "extensions",
			scope: "global",
			icon: "FlaskConical",
			viewId: D
		}), e.settings.registerPanel({
			kind: "collection",
			viewId: O,
			id: "snippets",
			title: "Snippets",
			section: "extensions",
			scope: "project",
			icon: "Code",
			items: () => T.list(),
			itemId: (e) => e.id,
			itemLabel: (e) => e.name,
			groupBy: {
				key: (e) => e.category,
				order: ["Prose", "Code"],
				label: (e) => e
			},
			actions: [{
				id: "create",
				label: "Create snippet",
				icon: "Plus",
				run: () => {
					T.create(), e.settings.refresh();
				}
			}]
		});
		let t = te({ resolveScopeId: (e) => e === "project" ? Ee : void 0 }).activate(e);
		return e.views.registerView({
			id: E,
			title: "Settings",
			body: {
				kind: "react",
				render: (e) => /* @__PURE__ */ _(Ce, { input: e })
			}
		}), e.shellPlacements.registerPlacement({
			id: E,
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: E
				}
			},
			region: "main"
		}), e.commands.executeCommand(c, { panelId: "appearance" }), t;
	}
}), k = (e) => ({
	extensionId: "host.breadcrumb-example",
	kind: "page",
	id: e
}), A = [
	{
		id: "host.breadcrumb.root",
		ref: k("root"),
		title: "Prompt Studio",
		icon: "FolderGit2",
		path: "review"
	},
	{
		id: "host.breadcrumb.pull-requests",
		ref: k("pull-requests"),
		title: "Pull requests",
		icon: "GitPullRequest",
		path: "review/pull-requests",
		parentId: "host.breadcrumb.root"
	},
	{
		id: "host.breadcrumb.pull-request",
		ref: k("pull-request"),
		title: "#646 Additive pages",
		icon: "GitPullRequest",
		path: "review/pull-requests/646",
		parentId: "host.breadcrumb.pull-requests"
	},
	{
		id: "host.breadcrumb.files",
		ref: k("files"),
		title: "Files changed",
		icon: "Files",
		path: "review/pull-requests/646/files",
		parentId: "host.breadcrumb.pull-request"
	},
	{
		id: "host.breadcrumb.file",
		ref: k("file"),
		title: "workbench-core.ts",
		icon: "FileCode2",
		path: "review/pull-requests/646/files/workbench-core",
		parentId: "host.breadcrumb.files"
	}
], Oe = () => {
	let e = o({ startPage: A[0].ref });
	e.modes.registerMode({
		id: "review",
		label: "Review",
		activate: () => void 0
	});
	for (let t of A) {
		let n = `${t.id}.view`;
		e.views.registerView({
			id: n,
			title: t.title,
			body: {
				kind: "react",
				render: ({ workbench: e }) => /* @__PURE__ */ v(h, {
					h: "full",
					gap: "md",
					p: "lg",
					bg: "bg",
					children: [/* @__PURE__ */ v(h, {
						gap: "xs",
						children: [/* @__PURE__ */ _(g, {
							textStyle: "heading/M/semibold",
							children: t.title
						}), /* @__PURE__ */ _(g, {
							color: "fg.muted",
							children: "This is a real page location. Use Back and Forward in the header to move through the five-page history."
						})]
					}), /* @__PURE__ */ _(m, {
						gap: "sm",
						flexWrap: "wrap",
						children: A.map((n) => /* @__PURE__ */ v(p, {
							size: "sm",
							variant: "outline",
							disabled: n.id === t.id,
							onClick: () => e.pageLocations.navigate({
								kind: "page",
								page: n.ref
							}),
							children: ["Open ", n.title]
						}, n.id))
					})]
				})
			}
		}), e.pages.registerPage({
			id: t.id,
			ref: t.ref,
			title: t.title,
			icon: t.icon,
			path: t.path,
			modeId: "review",
			parentId: t.parentId,
			main: {
				kind: "view",
				view: {
					kind: "view",
					id: n
				},
				cardinality: "one"
			},
			slots: []
		});
	}
	e.pageLocations.switchProject("breadcrumb-story");
	for (let t of A.slice(1)) e.pageLocations.navigate({
		kind: "page",
		page: t.ref
	});
	return e;
}, j = "host.command-guide", M = "host.command-guide.placeholder", N = "host.open-command-guide", P = "host.close-command-guide", F = "host.commandGuideOpen", ke = (e) => {
	let { input: t } = e;
	return /* @__PURE__ */ v(h, {
		h: "full",
		align: "center",
		justify: "center",
		gap: "sm",
		bg: "bg",
		children: [/* @__PURE__ */ v(h, {
			gap: "xs",
			textAlign: "center",
			children: [/* @__PURE__ */ _(g, {
				textStyle: "heading/M/semibold",
				children: "Nothing is open"
			}), /* @__PURE__ */ _(g, {
				color: "fg.muted",
				children: "Run the command to open a panel in Main."
			})]
		}), /* @__PURE__ */ _(p, {
			onClick: () => void t.workbench.commands.executeCommand(N),
			children: "Open command panel"
		})]
	});
}, Ae = () => {
	let e = o();
	return e.registerModule({
		id: "host.command-guide",
		activate(e) {
			return e.views.registerView({
				id: j,
				title: "Command guide",
				body: {
					kind: "react",
					render: ({ instance: e }) => /* @__PURE__ */ v(h, {
						h: "full",
						gap: "sm",
						p: "lg",
						bg: "bg",
						children: [/* @__PURE__ */ _(g, {
							textStyle: "heading/M/semibold",
							children: e.title
						}), /* @__PURE__ */ _(g, {
							color: "fg.muted",
							children: "The placeholder ran a command that opened this panel."
						})]
					})
				}
			}), e.shellPlacements.registerPlacement({
				id: j,
				item: {
					kind: "view",
					presence: "closed",
					view: {
						kind: "view",
						id: j
					}
				},
				region: "main"
			}), e.views.registerView({
				id: M,
				title: "Command guide",
				body: {
					kind: "react",
					render: (e) => /* @__PURE__ */ _(ke, { input: e })
				}
			}), e.placeholders.registerPlaceholder({
				id: "host.command-guide.placeholder",
				viewId: M,
				region: "main"
			}), e.commands.registerCommand({
				id: N,
				label: "Open command panel",
				category: "Onboarding",
				icon: "Plus"
			}, { execute: () => e.navigation.openPanel({ panel: {
				kind: "shell-placement",
				id: j
			} }) }), e.commands.registerCommand({
				id: P,
				label: "Close command panel",
				category: "Onboarding",
				icon: "X"
			}, {
				execute: () => {
					let t = e.layout.getLayout().regions.main.widgets.find((e) => e.viewId === j);
					t?.placementIdentity?.kind === "shell" && e.shellPlacements.closePlacement(t.placementIdentity);
				},
				isEnabled: () => e.context.get(F) === !0
			}), e.layout.registerMenuItem(ee, {
				commandId: P,
				group: "primary"
			}), e.layout.registerMenuItem(a, {
				commandId: N,
				order: 10
			}), e.layout.registerMenuItem(a, {
				commandId: P,
				order: 11
			}), { dispose: e.layout.store.subscribeSelector((e) => e.layout.regions.main.widgets.some((e) => e.viewId === j), (t) => e.context.set(F, t), { fireImmediately: !0 }) };
		}
	}), e;
}, je = () => o(), I = (e) => ({
	extensionId: "host",
	kind: "page",
	id: e
}), L = I("overview"), R = I("tickets"), z = I("session"), B = [
	{
		id: "overview",
		ref: L,
		title: "Project overview",
		path: "overview",
		modeId: "project",
		pageContribution: "Release summary",
		pageContributionDetail: "Milestone v0.31 · 3 changes ready for review",
		description: "Northstar is preparing v0.31. Eight tickets remain open and three are ready for review.",
		links: [{
			label: "Open Tickets",
			page: R
		}, {
			label: "Open current session",
			page: z
		}]
	},
	{
		id: "tickets",
		ref: R,
		title: "Tickets",
		path: "tickets",
		modeId: "project",
		pageContribution: "Ticket filter",
		pageContributionDetail: "Status: In progress · Milestone: v0.31",
		description: "PS-336 cleans up the workbench API. PS-337 makes supplied extension templates editable.",
		links: [{
			label: "Open overview",
			page: L
		}, {
			label: "Open current session",
			page: z
		}]
	},
	{
		id: "session",
		ref: z,
		title: "Current session",
		path: "sessions/current",
		modeId: "session",
		pageContribution: "Session context",
		pageContributionDetail: "Agent: Codex · Task: PS-336 · 7 files changed",
		description: "Session S-104 is implementing the workbench API examples for PS-336.",
		links: [{
			label: "Open project overview",
			page: L
		}]
	}
], Me = (e) => {
	let { input: t, page: n } = e;
	return /* @__PURE__ */ v(h, {
		h: "full",
		gap: "md",
		p: "lg",
		bg: "bg",
		children: [
			/* @__PURE__ */ v(h, {
				gap: "xs",
				children: [/* @__PURE__ */ _(g, {
					textStyle: "heading/M/semibold",
					children: n.title
				}), /* @__PURE__ */ _(g, {
					color: "fg.muted",
					children: n.description
				})]
			}),
			/* @__PURE__ */ v(g, { children: ["Mode-owned Sidenav: ", /* @__PURE__ */ _("strong", { children: n.modeId === "project" ? "Northstar navigation" : "Session S-104" })] }),
			/* @__PURE__ */ v(g, { children: [
				"Page-owned content: ",
				/* @__PURE__ */ _("strong", { children: n.pageContribution }),
				" in Secondary and this panel in Main"
			] }),
			/* @__PURE__ */ _(m, {
				gap: "sm",
				flexWrap: "wrap",
				children: n.links.map((e) => /* @__PURE__ */ _(p, {
					size: "sm",
					onClick: () => t.workbench.pageLocations.navigate({
						kind: "page",
						page: e.page
					}),
					children: e.label
				}, e.label))
			})
		]
	});
}, V = (e, t, n) => {
	let r = `host.${t}.navigation`;
	e.views.registerView({
		id: r,
		title: `${n} navigation`,
		body: {
			kind: "tree",
			defaultExpandedSectionIds: [t],
			getBody: () => [{
				id: t,
				label: n,
				nodes: B.filter((e) => e.modeId === t).map((e) => ({
					id: e.id,
					label: e.title,
					target: {
						kind: "page",
						page: e.ref
					}
				}))
			}],
			getChildren: () => []
		}
	}), e.modePlacements.registerPlacement({
		id: r,
		ref: {
			extensionId: "host",
			kind: "placement",
			id: `${t}-navigation`
		},
		modeId: t,
		item: {
			kind: "view",
			presence: "fixed",
			view: {
				kind: "view",
				id: r
			}
		},
		region: "sidenav"
	});
}, Ne = (e, t) => {
	let n = `host.${t.id}.main`, r = `host.${t.id}.sidenav`;
	e.views.registerView({
		id: n,
		title: t.title,
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ _(Me, {
				input: e,
				page: t
			})
		}
	}), e.views.registerView({
		id: r,
		title: t.pageContribution,
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ v(h, {
				gap: "xs",
				p: "md",
				bg: "bg",
				children: [
					/* @__PURE__ */ _(g, {
						textStyle: "heading/S/semibold",
						children: t.pageContribution
					}),
					/* @__PURE__ */ _(g, { children: t.pageContributionDetail }),
					/* @__PURE__ */ v(g, {
						color: "fg.muted",
						children: [
							"This section belongs to ",
							t.title,
							". It changes when the page changes."
						]
					})
				]
			})
		}
	}), e.pages.registerPage({
		id: `host.${t.id}`,
		ref: t.ref,
		title: t.title,
		path: t.path,
		modeId: t.modeId,
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: n
			},
			cardinality: "one"
		},
		slots: [{
			id: "tools",
			region: "secondary",
			item: {
				kind: "view",
				view: {
					kind: "view",
					id: r
				},
				presence: "open"
			}
		}]
	});
}, Pe = () => {
	let e = o({ startPage: L });
	e.modes.registerMode({
		id: "project",
		label: "Project",
		activate: () => void 0
	}), e.modes.registerMode({
		id: "session",
		label: "Session",
		activate: () => void 0
	}), V(e, "project", "Northstar project"), V(e, "session", "Session S-104");
	for (let t of B) Ne(e, t);
	return e.pageLocations.switchProject("storybook"), e;
}, Fe = () => {
	let e = o();
	return e.registerModule({
		id: "host.empty-state",
		activate(e) {
			e.views.registerView({
				id: "host.empty-state",
				title: "Empty main",
				body: {
					kind: "react",
					render: () => /* @__PURE__ */ v(h, {
						h: "full",
						align: "center",
						justify: "center",
						gap: "xs",
						bg: "bg",
						children: [/* @__PURE__ */ _(g, {
							textStyle: "heading/M/semibold",
							children: "Nothing is open"
						}), /* @__PURE__ */ _(g, {
							color: "fg.muted",
							children: "Open a tool to replace this placeholder."
						})]
					})
				}
			}), e.placeholders.registerPlaceholder({
				id: "host.empty-state",
				viewId: "host.empty-state",
				region: "main"
			});
		}
	}), e;
}, H = "host.resource-guide", U = "host.resource-guide.open-next", W = [
	{
		type: "guide",
		id: "getting-started",
		label: "Getting started"
	},
	{
		type: "guide",
		id: "views",
		label: "Views and placements"
	},
	{
		type: "guide",
		id: "resources",
		label: "Resource identity"
	}
], Ie = () => {
	let e = o();
	return e.registerModule({
		id: "host.resource-guide",
		activate(e) {
			let t = () => {
				let t = new Set(Object.values(e.layout.getLayout().regions).flatMap((e) => e.widgets).filter((e) => e.placementIdentity?.kind === "shell" && e.placementIdentity.placementId === H).map((e) => x(e.resource)));
				return W.find((e) => !t.has(x(e)));
			}, n = (t, n) => e.shellPlacements.openPlacement({
				placementId: H,
				resource: t,
				title: t.label,
				open: "pin",
				region: n
			});
			e.resources.registerKind({
				kind: "guide",
				label: "Guide",
				icon: "BookOpen"
			}), e.views.registerView({
				id: H,
				title: "Open another guide",
				body: {
					kind: "react",
					render: ({ instance: e }) => /* @__PURE__ */ v(h, {
						h: "full",
						gap: "sm",
						p: "lg",
						bg: "bg",
						children: [
							/* @__PURE__ */ _(g, {
								textStyle: "heading/M/semibold",
								children: e.resource?.label
							}),
							/* @__PURE__ */ _(g, {
								color: "fg.muted",
								children: "Each button sends a different resource to the same placement. Reopening a guide selects its existing tab."
							}),
							/* @__PURE__ */ _(me, {
								alignSelf: "flex-start",
								children: x(e.resource)
							}),
							/* @__PURE__ */ _(m, {
								gap: "sm",
								flexWrap: "wrap",
								pt: "sm",
								children: W.map((e) => /* @__PURE__ */ v(p, {
									size: "sm",
									variant: "outline",
									onClick: () => n(e),
									children: ["Open ", e.label]
								}, x(e)))
							}),
							/* @__PURE__ */ _(g, {
								color: "fg.muted",
								textStyle: "paragraph/XS/regular",
								children: "The + button opens the next closed guide. It disappears when all three guides are open."
							})
						]
					})
				}
			}), e.commands.registerCommand({
				id: U,
				label: "Open another guide",
				category: "Guides",
				icon: "BookOpen"
			}, {
				isEnabled: () => !!t(),
				execute: (e, r) => {
					let i = t();
					if (i) return n(i, r?.region);
				}
			}), e.shellPlacements.registerPlacement({
				id: H,
				item: {
					kind: "binding",
					binding: {
						kinds: [{
							kind: "resource-kind",
							id: "guide"
						}],
						view: {
							kind: "view",
							id: H
						},
						cardinality: "many",
						add: {
							kind: "command",
							target: { command: {
								kind: "command",
								id: U
							} }
						}
					}
				},
				region: "main"
			}), n(W[0]);
		}
	}), e;
}, Le = [
	{
		id: "search",
		title: "Search",
		icon: "Search"
	},
	{
		id: "sessions",
		title: "Sessions",
		icon: "MessagesSquare"
	},
	{
		id: "tickets",
		title: "Tickets",
		icon: "Ticket"
	},
	{
		id: "settings",
		title: "Settings",
		icon: "Settings"
	}
], G = (e) => ({
	extensionId: "host",
	kind: "page",
	id: e
}), K = (e) => ({
	kind: "page",
	page: G(e)
}), Re = (e, t) => {
	let n = `host.project-navigation.${t.id}`;
	e.views.registerView({
		id: n,
		title: t.title,
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ v(h, {
				h: "full",
				gap: "sm",
				p: "lg",
				bg: "bg",
				children: [/* @__PURE__ */ _(g, {
					textStyle: "heading/M/semibold",
					children: t.title
				}), /* @__PURE__ */ _(g, {
					color: "fg.muted",
					children: "This page was opened by the tree renderer."
				})]
			})
		}
	}), e.pages.registerPage({
		id: n,
		ref: G(t.id),
		title: t.title,
		path: t.id,
		modeId: "project",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: n
			},
			cardinality: "one"
		},
		slots: []
	});
}, ze = () => {
	let e = o({ startPage: G("search") });
	e.modes.registerMode({
		id: "project",
		label: "Project",
		activate: () => void 0
	});
	for (let t of Le) Re(e, t);
	return e.views.registerView({
		id: "host.project-navigation",
		title: "Project navigation",
		body: {
			kind: "tree",
			defaultExpandedSectionIds: ["project"],
			getHeader: () => [{
				id: "search",
				nodes: [{
					id: "search",
					label: "Search",
					icon: "Search",
					target: K("search")
				}]
			}],
			getBody: () => [{
				id: "project",
				label: "Project",
				nodes: [{
					id: "sessions",
					label: "Sessions",
					icon: "MessagesSquare",
					target: K("sessions")
				}, {
					id: "tickets",
					label: "Tickets",
					icon: "Ticket",
					target: K("tickets")
				}]
			}],
			getFooter: () => [{
				id: "account",
				nodes: [{
					id: "settings",
					label: "Settings",
					icon: "Settings",
					target: K("settings")
				}]
			}],
			getChildren: () => []
		}
	}), e.modePlacements.registerPlacement({
		id: "host.project-navigation",
		ref: {
			extensionId: "host",
			kind: "placement",
			id: "project-navigation"
		},
		modeId: "project",
		item: {
			kind: "view",
			presence: "fixed",
			view: {
				kind: "view",
				id: "host.project-navigation"
			}
		},
		region: "sidenav"
	}), e.pageLocations.switchProject("storybook"), e;
}, q = xe({
	id: "recipe",
	label: "Recipe",
	icon: "ChefHat"
}), Be = [{
	id: "pancakes",
	title: "Pancakes"
}, {
	id: "ramen",
	title: "Ramen"
}], Ve = (e, t) => b({
	id: e,
	title: t,
	body: {
		kind: "file",
		load: async (n, { renderer: r }) => ({
			fileName: `${e}.md`,
			mimeType: "text/markdown",
			content: `# ${r.resource?.label ?? t}`
		})
	}
}), He = Ve("pantry", "Pantry"), J = Ve("recipe", "Recipes"), Y = y({
	id: "pantry",
	title: "Pantry",
	path: "pantry",
	mode: S.project,
	main: {
		kind: "view",
		view: He.ref,
		cardinality: "one"
	},
	slots: []
}), X = y({
	id: "recipes",
	title: "Recipes",
	path: "recipes",
	mode: S.project,
	main: {
		kind: "view",
		view: J.ref,
		cardinality: "one"
	},
	slots: []
}), Ue = y({
	id: "recipe",
	title: "Recipe",
	path: "recipe",
	mode: S.project,
	parent: X.ref,
	resource: { kinds: [q.ref] },
	main: {
		kind: "view",
		view: J.ref,
		cardinality: "one"
	},
	slots: []
}), We = b({
	id: "recipe-list",
	title: "Recipes",
	body: {
		kind: "tree",
		body: async () => [{
			id: "recipes",
			label: "Recipes",
			collapsible: !1,
			nodes: Be.map(({ id: e, title: t }) => {
				let n = {
					type: q.id,
					id: e,
					label: t
				};
				return {
					id: e,
					label: t,
					icon: "ChefHat",
					resource: n,
					target: {
						kind: "page",
						page: Ue.ref,
						resource: n
					}
				};
			})
		}]
	}
}), Ge = ve({
	resourceKinds: [q],
	views: [
		He,
		J,
		We
	],
	pages: [
		Y,
		X,
		Ue
	],
	navigationItems: [ye({
		id: "pantry",
		owner: S.project,
		slot: "header",
		label: "Pantry",
		icon: "ShoppingBasket",
		action: {
			kind: "page",
			page: Y.ref
		}
	}), ye({
		id: "recipes",
		owner: S.project,
		slot: "content",
		label: "Recipes",
		icon: "ChefHat",
		group: "",
		action: {
			kind: "page",
			page: X.ref
		}
	})],
	navigationTrees: [be({
		id: "recipe-list",
		owner: X.ref,
		slot: "content",
		view: We.ref,
		resourceScope: "project"
	})]
}), Ke = "import {\n  defineExtension,\n  defineNavigationItem,\n  defineNavigationTree,\n  definePage,\n  defineResourceKind,\n  defineView,\n  workbenchModes,\n} from \"@pstdio/sdk/extensions\";\n\nconst recipe = defineResourceKind({ id: \"recipe\", label: \"Recipe\", icon: \"ChefHat\" });\nconst recipes = [\n  { id: \"pancakes\", title: \"Pancakes\" },\n  { id: \"ramen\", title: \"Ramen\" },\n];\n\nconst markdown = (id: string, title: string) =>\n  defineView({\n    id,\n    title,\n    body: {\n      kind: \"file\",\n      load: async (_ctx, { renderer }) => ({\n        fileName: `${id}.md`,\n        mimeType: \"text/markdown\",\n        content: `# ${renderer.resource?.label ?? title}`,\n      }),\n    },\n  });\nconst pantryView = markdown(\"pantry\", \"Pantry\");\nconst recipeView = markdown(\"recipe\", \"Recipes\");\n\nexport const pantryPage = definePage({\n  id: \"pantry\",\n  title: \"Pantry\",\n  path: \"pantry\",\n  mode: workbenchModes.project,\n  main: { kind: \"view\", view: pantryView.ref, cardinality: \"one\" },\n  slots: [],\n});\n// Opening this page starts the Recipes level.\nconst recipesPage = definePage({\n  id: \"recipes\",\n  title: \"Recipes\",\n  path: \"recipes\",\n  mode: workbenchModes.project,\n  main: { kind: \"view\", view: recipeView.ref, cardinality: \"one\" },\n  slots: [],\n});\n// A child page keeps the Recipes level open through its declared parent.\nconst recipePage = definePage({\n  id: \"recipe\",\n  title: \"Recipe\",\n  path: \"recipe\",\n  mode: workbenchModes.project,\n  parent: recipesPage.ref,\n  resource: { kinds: [recipe.ref] },\n  main: { kind: \"view\", view: recipeView.ref, cardinality: \"one\" },\n  slots: [],\n});\n\nconst recipeList = defineView({\n  id: \"recipe-list\",\n  title: \"Recipes\",\n  body: {\n    kind: \"tree\",\n    body: async () => [\n      {\n        id: \"recipes\",\n        label: \"Recipes\",\n        collapsible: false,\n        nodes: recipes.map(({ id, title }) => {\n          const resource = { type: recipe.id, id, label: title };\n          return {\n            id,\n            label: title,\n            icon: \"ChefHat\",\n            resource,\n            target: { kind: \"page\", page: recipePage.ref, resource },\n          };\n        }),\n      },\n    ],\n  },\n});\n\nexport default defineExtension({\n  resourceKinds: [recipe],\n  views: [pantryView, recipeView, recipeList],\n  pages: [pantryPage, recipesPage, recipePage],\n  navigationItems: [\n    // Header rows stay visible in every level.\n    defineNavigationItem({\n      id: \"pantry\",\n      owner: workbenchModes.project,\n      slot: \"header\",\n      label: \"Pantry\",\n      icon: \"ShoppingBasket\",\n      action: { kind: \"page\", page: pantryPage.ref },\n    }),\n    // The main level shows one row that opens the level.\n    defineNavigationItem({\n      id: \"recipes\",\n      owner: workbenchModes.project,\n      slot: \"content\",\n      label: \"Recipes\",\n      icon: \"ChefHat\",\n      group: \"\",\n      action: { kind: \"page\", page: recipesPage.ref },\n    }),\n  ],\n  navigationTrees: [\n    // A page owner starts a level instead of adding rows to the project navigation.\n    defineNavigationTree({\n      id: \"recipe-list\",\n      owner: recipesPage.ref,\n      slot: \"content\",\n      view: recipeList.ref,\n      resourceScope: \"project\",\n    }),\n  ],\n});\n", qe = /* @__PURE__ */ e({
	Breadcrumbs: () => at,
	CommandAndMenu: () => $e,
	EmptyWorkbench: () => Ye,
	FirstExtensionPage: () => Qe,
	HostTerminal: () => ut,
	LayoutScopes: () => lt,
	ModeContribution: () => $,
	PageComposition: () => nt,
	PageReplacement: () => rt,
	Placeholder: () => Xe,
	PreferenceSchemas: () => ct,
	ResourceBackedPanel: () => tt,
	ResourceReuse: () => it,
	Settings: () => st,
	SidenavLevels: () => dt,
	TreeRenderer: () => et,
	Views: () => Ze,
	WorkbenchRegions: () => ot,
	default: () => Je
}), Je = {
	title: "pstdio-workbench/Guides/Onboarding",
	tags: ["!dev"],
	parameters: { layout: "padded" }
}, Z = (e) => {
	let t = o();
	return t.registerModule(e()), t;
}, Q = (e) => ({ docs: { description: { story: e } } }), Ye = {
	name: "0. Empty workbench",
	parameters: Q("The shell before any module contributes content."),
	render: () => /* @__PURE__ */ _(l, { createWorkbench: je })
}, Xe = {
	name: "1. Placeholder",
	parameters: Q("A region placeholder supplies a useful empty state."),
	render: () => /* @__PURE__ */ _(l, { createWorkbench: Fe })
}, Ze = {
	name: "2. Views",
	parameters: Q("A View defines reusable content. A placement puts it in Main."),
	render: () => /* @__PURE__ */ _(l, { createWorkbench: le })
}, Qe = {
	name: "3. First extension page",
	parameters: { docs: {
		description: { story: "Declare a native View, place it on a page, and expose the page in navigation." },
		source: {
			code: fe,
			language: "tsx",
			type: "code"
		}
	} },
	render: () => /* @__PURE__ */ _(l, { createWorkbench: () => i(de, ue.id) }),
	play: async ({ canvasElement: e }) => {
		let i = n(e);
		await r(await i.findByRole("heading", { name: "Getting started" })).toBeVisible(), await t.click(await i.findByRole("option", { name: "Pages" })), await r(await i.findByRole("heading", { name: "Pages" })).toBeVisible(), await t.click(i.getByRole("option", { name: "Views" })), await r(await i.findByRole("heading", { name: "Views" })).toBeVisible(), await t.click(i.getByRole("button", { name: "Navigate back" })), await r(await i.findByRole("heading", { name: "Pages" })).toBeVisible();
	}
}, $e = {
	name: "4. Command and menu",
	parameters: Q("Global header commands open and close a panel."),
	render: () => /* @__PURE__ */ _(l, { createWorkbench: Ae })
}, et = {
	name: "5. Tree navigation",
	parameters: Q("Tree rows run commands across pinned header, scrolling content, and pinned footer."),
	render: () => /* @__PURE__ */ _(l, { createWorkbench: ze })
}, tt = {
	name: "6. Resource-backed panel",
	parameters: Q("Open several guides through one resource placement, including its Add-panel action."),
	render: () => /* @__PURE__ */ _(l, { createWorkbench: Ie }),
	play: async ({ canvasElement: e }) => {
		let i = n(e);
		await t.click(await i.findByRole("button", { name: "Add panel" })), await t.click(i.getByRole("button", { name: "Add panel" })), await r(i.queryByRole("button", { name: "Add panel" })).toBeNull(), await r(i.getAllByRole("tab")).toHaveLength(3), await t.click(i.getByRole("button", { name: "Close Resource identity" })), await t.click(await i.findByRole("button", { name: "Add panel" })), await r(i.getAllByRole("tab")).toHaveLength(3), await r(i.queryByRole("button", { name: "Add panel" })).toBeNull();
	}
}, $ = {
	name: "7. Mode and page contributions",
	parameters: Q("Switch between a project, its ticket list, and a live session to see both owners."),
	render: () => /* @__PURE__ */ _(l, { createWorkbench: Pe })
}, nt = {
	name: "8. Page composition",
	parameters: Q("Compare a full-height Side layout with a bottom Secondary layout."),
	render: () => /* @__PURE__ */ _(re, {})
}, rt = {
	name: "9. Page replacement",
	parameters: Q("Page navigation replaces the old content and panel geometry in one step."),
	render: () => /* @__PURE__ */ _(ne, {})
}, it = {
	name: "10. Resource cardinality: one and many",
	parameters: Q("Compare one replaceable inspector with several pinned and preview document tabs."),
	render: () => /* @__PURE__ */ _(ie, { showCardinalityComparison: !0 }),
	play: async ({ canvasElement: e }) => {
		let i = n(e);
		await t.click(await i.findByRole("button", { name: "New document" }));
		for (let e = 0; e < 4; e++) await t.click(i.getByRole("button", { name: "Add panel" }));
		await r(i.getAllByRole("tab")).toHaveLength(8), await t.click(i.getByRole("button", { name: "Inspect release/v0.31" })), await r(i.getAllByRole("tab")).toHaveLength(8);
	}
}, at = {
	name: "11. Breadcrumbs",
	parameters: Q("A five-level trail lets each ancestor return to that location."),
	render: () => /* @__PURE__ */ _(l, { createWorkbench: Oe })
}, ot = {
	name: "12. Workbench regions",
	render: () => /* @__PURE__ */ _(l, { createWorkbench: () => Z(ce) })
}, st = {
	name: "13. Settings",
	render: () => /* @__PURE__ */ _(l, { createWorkbench: () => Z(De) })
}, ct = {
	name: "14. Preference schemas",
	render: () => /* @__PURE__ */ _(l, { createWorkbench: () => Z(oe) })
}, lt = {
	name: "15. Layout scopes",
	render: () => /* @__PURE__ */ _(l, { createWorkbench: se })
}, ut = {
	name: "16. Host terminal",
	parameters: Q("Open as many scripted terminal tabs as needed from the launcher or Add panel."),
	render: () => /* @__PURE__ */ _(l, { createWorkbench: ae })
}, dt = {
	name: "17. Sidenav levels",
	parameters: { docs: {
		description: { story: "A page-owned navigation tree replaces the Sidenav body while header rows stay." },
		source: {
			code: Ke,
			language: "tsx",
			type: "code"
		}
	} },
	render: () => /* @__PURE__ */ _(l, { createWorkbench: () => i(Ge, Y.id) }),
	play: async ({ canvasElement: e }) => {
		let i = n(e);
		await r(await i.findByRole("heading", { name: "Pantry" })).toBeVisible(), await t.click(await i.findByRole("option", { name: "Recipes" })), await r(await i.findByRole("option", { name: "Pancakes" })).toBeVisible(), await r(i.getByRole("option", { name: "Pantry" })).toBeVisible(), await r(i.queryByRole("option", { name: "Recipes" })).toBeNull(), await t.click(i.getByRole("option", { name: "Pancakes" })), await r(await i.findByRole("heading", { name: "Pancakes" })).toBeVisible(), await r(i.getByRole("option", { name: "Ramen" })).toBeVisible(), await t.click(i.getByRole("option", { name: "Pantry" })), await r(await i.findByRole("option", { name: "Recipes" })).toBeVisible();
	}
};
export { at as Breadcrumbs, $e as CommandAndMenu, Ye as EmptyWorkbench, Qe as FirstExtensionPage, ut as HostTerminal, lt as LayoutScopes, $ as ModeContribution, nt as PageComposition, rt as PageReplacement, Xe as Placeholder, ct as PreferenceSchemas, tt as ResourceBackedPanel, it as ResourceReuse, st as Settings, dt as SidenavLevels, et as TreeRenderer, Ze as Views, ot as WorkbenchRegions, Je as default, Ke as n, qe as t };
