// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-down-ZmPqsMG0.ts";
import { t } from "./circle-B0quX-xX.ts";
import { t as n } from "./copy-COTDVt4R.ts";
import { t as r } from "./ellipsis-vertical-CeKd7BaK.ts";
import { t as i } from "./file-text-B9-uT4dU.ts";
import { t as a } from "./folder-DJ8ZbA4G.ts";
import { n as o, t as s } from "./ticket-CH4ueYVY.ts";
import { t as c } from "./plus-CYkLGSPS.ts";
import { t as l } from "./star-DtQKFyMr.ts";
import { t as u } from "./trash-2-C03vrbuo.ts";
import { t as d } from "./list-row-BhxGCvIh.ts";
import { t as f } from "./workspace-badge-C5sEf_C9.ts";
import { useState as p } from "react";
import { Box as m, Button as h, HStack as g, Kbd as _, Menu as v, Portal as y, Stack as b, Text as x } from "@chakra-ui/react";
import { jsx as S, jsxs as C } from "react/jsx-runtime";
// packages/ui/src/components/list-row/list-row.stories.tsx
var w = {
	title: "Components/Data Display/List Row",
	component: d,
	parameters: { docs: { description: { component: "Reusable row item surface for lists, menus, trees, and dense navigation. Authoring rows compose startContent previews, actionsVisibility=always, pressed/disabled toggle actions, and expandOnClick=false for separate group expansion. Tree List / Outliner demonstrates controlled multiselection and keyboard reordering. Descriptions remain available to assistive technology. RULE: Subtitles/descriptions must add distinct context and never contain the same information as the title." } } }
}, T = {
	id: "overview",
	label: "Overview",
	icon: /* @__PURE__ */ S(i, { size: 14 })
}, E = (e) => /* @__PURE__ */ S(x, {
	textStyle: "label/XS",
	color: "fg.muted",
	textTransform: "uppercase",
	letterSpacing: "0.08em",
	children: e.children
}), D = { render: () => /* @__PURE__ */ C(b, {
	gap: "md",
	maxW: "22rem",
	children: [
		/* @__PURE__ */ C(b, {
			gap: "2xs",
			children: [
				/* @__PURE__ */ S(E, { children: "Default" }),
				/* @__PURE__ */ S(d, { ...T }),
				/* @__PURE__ */ S(d, {
					...T,
					description: "Project entry point and high-level summary"
				}),
				/* @__PURE__ */ S(d, {
					...T,
					isSelected: !0
				}),
				/* @__PURE__ */ S(d, {
					...T,
					label: "Run pipeline",
					description: "Coming soon",
					disabled: !0
				})
			]
		}),
		/* @__PURE__ */ C(b, {
			gap: "2xs",
			children: [
				/* @__PURE__ */ S(E, { children: "Compact" }),
				/* @__PURE__ */ S(d, {
					...T,
					variant: "compact"
				}),
				/* @__PURE__ */ S(d, {
					...T,
					description: "Project entry point and high-level summary",
					variant: "compact"
				}),
				/* @__PURE__ */ S(d, {
					...T,
					variant: "compact",
					isSelected: !0
				}),
				/* @__PURE__ */ S(d, {
					...T,
					label: "Run pipeline",
					description: "Coming soon",
					disabled: !0,
					variant: "compact"
				})
			]
		}),
		/* @__PURE__ */ C(b, {
			gap: "2xs",
			children: [/* @__PURE__ */ S(E, { children: "Empty State" }), /* @__PURE__ */ S(d, {
				id: "empty-files",
				label: "No files",
				variant: "empty-state",
				disabled: !0
			})]
		})
	]
}) }, O = { render: () => /* @__PURE__ */ C(b, {
	gap: "md",
	maxW: "22rem",
	children: [/* @__PURE__ */ C(b, {
		gap: "2xs",
		children: [
			/* @__PURE__ */ S(E, { children: "Default tone" }),
			/* @__PURE__ */ S(d, {
				...T,
				label: "Open file"
			}),
			/* @__PURE__ */ S(d, {
				...T,
				label: "Open file",
				variant: "compact"
			})
		]
	}), /* @__PURE__ */ C(b, {
		gap: "2xs",
		children: [
			/* @__PURE__ */ S(E, { children: "Danger tone" }),
			/* @__PURE__ */ S(d, {
				id: "delete",
				label: "Delete project",
				icon: /* @__PURE__ */ S(u, { size: 14 }),
				tone: "danger"
			}),
			/* @__PURE__ */ S(d, {
				id: "delete-desc",
				label: "Delete project",
				description: "This action cannot be undone",
				icon: /* @__PURE__ */ S(u, { size: 14 }),
				tone: "danger"
			}),
			/* @__PURE__ */ S(d, {
				id: "delete-c",
				label: "Delete project",
				icon: /* @__PURE__ */ S(u, { size: 14 }),
				tone: "danger",
				variant: "compact"
			})
		]
	})]
}) }, k = { render: () => /* @__PURE__ */ C(b, {
	gap: "md",
	maxW: "22rem",
	children: [
		/* @__PURE__ */ C(b, {
			gap: "2xs",
			children: [
				/* @__PURE__ */ S(E, { children: "Indicator + colored icon" }),
				/* @__PURE__ */ S(d, {
					...T,
					label: "Pipeline run",
					indicator: {
						icon: /* @__PURE__ */ S(t, { size: 8 }),
						color: "green.500",
						tooltip: "Running"
					}
				}),
				/* @__PURE__ */ S(d, {
					...T,
					label: "Starred",
					icon: /* @__PURE__ */ S(l, { size: 14 }),
					iconColor: "yellow.500"
				})
			]
		}),
		/* @__PURE__ */ C(b, {
			gap: "2xs",
			children: [/* @__PURE__ */ S(E, { children: "Two texts in a row" }), /* @__PURE__ */ S(d, {
				id: "ticket",
				icon: /* @__PURE__ */ S(s, { size: 14 }),
				label: /* @__PURE__ */ C(g, {
					gap: "2",
					children: [/* @__PURE__ */ S(x, {
						textStyle: "label/M/regular",
						color: "fg.muted",
						flexShrink: 0,
						children: "PST-1"
					}), /* @__PURE__ */ S(x, {
						textStyle: "label/M/regular",
						truncate: !0,
						children: "Ship the unified ListRow component"
					})]
				})
			})]
		}),
		/* @__PURE__ */ C(b, {
			gap: "2xs",
			children: [
				/* @__PURE__ */ S(E, { children: "Tooltip on hover" }),
				/* @__PURE__ */ S(d, {
					...T,
					label: "Hover me",
					tooltip: "Project entry point"
				}),
				/* @__PURE__ */ S(d, {
					...T,
					label: "With Kbd tooltip",
					tooltip: /* @__PURE__ */ C(g, {
						gap: "shortcut-key-gap",
						children: [
							/* @__PURE__ */ S(x, {
								textStyle: "label/XS",
								children: "Press"
							}),
							/* @__PURE__ */ S(_, {
								size: "sm",
								children: "⌘"
							}),
							/* @__PURE__ */ S(_, {
								size: "sm",
								children: "O"
							})
						]
					})
				})
			]
		}),
		/* @__PURE__ */ C(b, {
			gap: "2xs",
			children: [/* @__PURE__ */ S(E, { children: "End content (Kbd)" }), /* @__PURE__ */ S(d, {
				...T,
				label: "Open palette",
				endContent: /* @__PURE__ */ C(g, {
					gap: "shortcut-key-gap",
					children: [/* @__PURE__ */ S(_, {
						size: "sm",
						children: "⌘"
					}), /* @__PURE__ */ S(_, {
						size: "sm",
						children: "K"
					})]
				})
			})]
		}),
		/* @__PURE__ */ C(b, {
			gap: "2xs",
			children: [/* @__PURE__ */ S(E, { children: "Truncation" }), /* @__PURE__ */ S(d, {
				id: "long",
				icon: /* @__PURE__ */ S(i, { size: 14 }),
				label: "An extremely long ticket title that absolutely will not fit inside the row and must therefore be truncated with an ellipsis",
				description: "Likewise, this description goes on and on, eventually wrapping or truncating depending on the available container width."
			})]
		}),
		/* @__PURE__ */ C(b, {
			gap: "2xs",
			children: [
				/* @__PURE__ */ S(E, { children: "Workspace badge in subtitle slot" }),
				/* @__PURE__ */ S(d, {
					id: "ws-sub-1",
					label: "Triage failing e2e suite",
					icon: /* @__PURE__ */ S(s, { size: 14 }),
					description: /* @__PURE__ */ S(f, {
						workspaceType: "worktree",
						shorthand: "ws-3",
						attemptStatus: {
							name: "Running",
							color: "blue"
						},
						sessionStatus: "completed",
						diffAdditions: 42,
						diffDeletions: 7
					})
				}),
				/* @__PURE__ */ S(d, {
					id: "ws-sub-2",
					label: "Migrate auth middleware",
					icon: /* @__PURE__ */ S(s, { size: 14 }),
					description: /* @__PURE__ */ S(f, {
						workspaceType: "folder",
						label: "Project workspace",
						attemptStatus: {
							name: "Failed",
							color: "red"
						},
						sessionStatus: "failed"
					}),
					variant: "compact"
				})
			]
		}),
		/* @__PURE__ */ C(b, {
			gap: "2xs",
			children: [
				/* @__PURE__ */ S(E, { children: "Workspace badge as end content" }),
				/* @__PURE__ */ S(d, {
					id: "ws-1",
					label: "Triage failing e2e suite",
					description: "PST-128",
					icon: /* @__PURE__ */ S(s, { size: 14 }),
					endContent: /* @__PURE__ */ S(f, {
						workspaceType: "worktree",
						shorthand: "ws-3",
						attemptStatus: {
							name: "Running",
							color: "blue"
						},
						sessionStatus: "completed",
						diffAdditions: 42,
						diffDeletions: 7
					})
				}),
				/* @__PURE__ */ S(d, {
					id: "ws-2",
					label: "Migrate auth middleware",
					description: "PST-204",
					icon: /* @__PURE__ */ S(s, { size: 14 }),
					endContent: /* @__PURE__ */ S(f, {
						workspaceType: "folder",
						label: "Project workspace",
						attemptStatus: {
							name: "Failed",
							color: "red"
						},
						sessionStatus: "failed"
					}),
					variant: "compact"
				})
			]
		}),
		/* @__PURE__ */ C(b, {
			gap: "2xs",
			children: [/* @__PURE__ */ S(E, { children: "Right icon + long content" }), /* @__PURE__ */ S(d, {
				id: "long-with-end",
				icon: /* @__PURE__ */ S(i, { size: 14 }),
				label: "An extremely long ticket title that competes with end content for horizontal space and must truncate gracefully",
				description: "Plus a description that is also quite long and needs to share the row with a Kbd shortcut.",
				endContent: /* @__PURE__ */ C(g, {
					gap: "shortcut-key-gap",
					children: [/* @__PURE__ */ S(_, {
						size: "sm",
						children: "⌘"
					}), /* @__PURE__ */ S(_, {
						size: "sm",
						children: "↵"
					})]
				})
			})]
		})
	]
}) }, A = { render: () => /* @__PURE__ */ C(b, {
	gap: "md",
	maxW: "22rem",
	children: [/* @__PURE__ */ C(b, {
		gap: "2xs",
		children: [/* @__PURE__ */ S(E, { children: "Hover actions" }), /* @__PURE__ */ S(d, {
			...T,
			actions: [{
				id: "add",
				label: "Add",
				icon: /* @__PURE__ */ S(c, { size: 14 }),
				onAction: () => {}
			}, {
				id: "more",
				label: "More",
				icon: /* @__PURE__ */ S(r, { size: 14 }),
				menuItems: [{
					id: "copy-link",
					label: "Copy link",
					icon: /* @__PURE__ */ S(o, { size: 14 })
				}, {
					id: "delete",
					label: "Delete",
					icon: /* @__PURE__ */ S(u, { size: 14 })
				}]
			}]
		})]
	}), /* @__PURE__ */ C(b, {
		gap: "2xs",
		children: [/* @__PURE__ */ S(E, { children: "Resource actions (right-click) with a tooltip" }), /* @__PURE__ */ S(d, {
			...T,
			tooltip: "docs/overview.md",
			contextMenuItems: [{
				id: "rename",
				label: "Rename"
			}, {
				id: "delete",
				label: "Delete",
				icon: /* @__PURE__ */ S(u, { size: 14 })
			}]
		})]
	})]
}) }, j = { render: () => /* @__PURE__ */ C(b, {
	gap: "md",
	maxW: "22rem",
	children: [
		/* @__PURE__ */ C(b, {
			gap: "2xs",
			children: [/* @__PURE__ */ S(E, { children: "Action tooltip with Kbd hint (hover the icon)" }), /* @__PURE__ */ S(d, {
				...T,
				actions: [{
					id: "add",
					label: "Add",
					icon: /* @__PURE__ */ S(c, { size: 14 }),
					tooltip: /* @__PURE__ */ C(g, {
						gap: "2",
						children: [/* @__PURE__ */ S(x, { children: "Add" }), /* @__PURE__ */ S(_, { children: "⌘N" })]
					}),
					onAction: () => {}
				}, {
					id: "copy",
					label: "Copy",
					icon: /* @__PURE__ */ S(n, { size: 14 }),
					onAction: () => {}
				}]
			})]
		}),
		/* @__PURE__ */ C(b, {
			gap: "2xs",
			children: [/* @__PURE__ */ S(E, { children: "Action menu items with trailing Kbd (open menu)" }), /* @__PURE__ */ S(d, {
				...T,
				actions: [{
					id: "more",
					label: "More",
					icon: /* @__PURE__ */ S(r, { size: 14 }),
					menuItems: [{
						id: "copy-link",
						label: "Copy link",
						icon: /* @__PURE__ */ S(o, { size: 14 }),
						endContent: /* @__PURE__ */ S(_, { children: "⌘C" })
					}, {
						id: "delete",
						label: "Delete",
						icon: /* @__PURE__ */ S(u, { size: 14 }),
						endContent: /* @__PURE__ */ S(_, { children: "⌫" })
					}]
				}]
			})]
		}),
		/* @__PURE__ */ C(b, {
			gap: "2xs",
			children: [/* @__PURE__ */ S(E, { children: "Context menu items with trailing Kbd (right-click)" }), /* @__PURE__ */ S(d, {
				...T,
				contextMenuItems: [{
					id: "rename",
					label: "Rename",
					endContent: /* @__PURE__ */ S(_, { children: "F2" })
				}, {
					id: "delete",
					label: "Delete",
					icon: /* @__PURE__ */ S(u, { size: 14 }),
					endContent: /* @__PURE__ */ S(_, { children: "⌫" })
				}]
			})]
		})
	]
}) }, M = {
	id: "src",
	label: "src",
	icon: /* @__PURE__ */ S(a, { size: 14 }),
	isContainer: !0
}, N = () => {
	let [e, t] = p(!0);
	return /* @__PURE__ */ S(d, {
		...M,
		showExpandToggle: !0,
		isExpanded: e,
		onToggleExpand: () => t((e) => !e)
	});
}, P = { render: () => /* @__PURE__ */ C(b, {
	gap: "md",
	maxW: "22rem",
	children: [/* @__PURE__ */ C(b, {
		gap: "2xs",
		children: [/* @__PURE__ */ S(E, { children: "Expandable container" }), /* @__PURE__ */ S(N, {})]
	}), /* @__PURE__ */ C(b, {
		gap: "2xs",
		children: [/* @__PURE__ */ S(E, { children: "Nested at depth" }), /* @__PURE__ */ C(b, {
			gap: "0",
			children: [
				/* @__PURE__ */ S(d, {
					...M,
					showExpandToggle: !0,
					isExpanded: !0,
					depth: 0,
					variant: "tree"
				}),
				/* @__PURE__ */ S(d, {
					...T,
					id: "nested-1",
					label: "index.ts",
					depth: 1,
					variant: "tree"
				}),
				/* @__PURE__ */ S(d, {
					...M,
					id: "components",
					label: "components",
					showExpandToggle: !0,
					isExpanded: !0,
					depth: 1,
					variant: "tree"
				}),
				/* @__PURE__ */ S(d, {
					...T,
					id: "nested-2",
					label: "button.tsx",
					depth: 2,
					variant: "tree"
				}),
				/* @__PURE__ */ S(d, {
					...T,
					id: "nested-3",
					label: "input.tsx",
					depth: 2,
					variant: "tree",
					isSelected: !0
				})
			]
		})]
	})]
}) }, F = [
	{
		id: "open",
		label: "Open",
		icon: /* @__PURE__ */ S(i, { size: 14 }),
		endContent: /* @__PURE__ */ C(g, {
			gap: "shortcut-key-gap",
			children: [/* @__PURE__ */ S(_, {
				size: "sm",
				children: "⌘"
			}), /* @__PURE__ */ S(_, {
				size: "sm",
				children: "O"
			})]
		})
	},
	{
		id: "duplicate",
		label: "Duplicate",
		icon: /* @__PURE__ */ S(n, { size: 14 }),
		endContent: /* @__PURE__ */ C(g, {
			gap: "shortcut-key-gap",
			children: [/* @__PURE__ */ S(_, {
				size: "sm",
				children: "⌘"
			}), /* @__PURE__ */ S(_, {
				size: "sm",
				children: "D"
			})]
		})
	},
	{
		id: "copy-link",
		label: "Copy link",
		description: "Share a permalink to this item",
		icon: /* @__PURE__ */ S(o, { size: 14 })
	},
	{
		id: "delete",
		label: "Delete",
		icon: /* @__PURE__ */ S(u, { size: 14 }),
		disabled: !0
	}
], I = (t) => /* @__PURE__ */ C(v.Root, { children: [/* @__PURE__ */ S(v.Trigger, {
	asChild: !0,
	children: /* @__PURE__ */ C(h, { children: [t.label, /* @__PURE__ */ S(e, { size: 14 })] })
}), /* @__PURE__ */ S(y, { children: /* @__PURE__ */ S(v.Positioner, { children: /* @__PURE__ */ S(v.Content, { children: F.map((e) => /* @__PURE__ */ S(v.Item, {
	value: e.id,
	disabled: e.disabled,
	asChild: !0,
	children: /* @__PURE__ */ S(d, {
		asChild: !0,
		...e,
		variant: "full-width"
	})
}, e.id)) }) }) })] }), L = { render: () => /* @__PURE__ */ S(m, { children: /* @__PURE__ */ S(b, {
	gap: "md",
	children: /* @__PURE__ */ C(b, {
		gap: "2xs",
		children: [/* @__PURE__ */ S(E, { children: "Full Width" }), /* @__PURE__ */ S(I, { label: "Open menu" })]
	})
}) }) };
export { k as Decorations, L as InsideMenu, A as Interactions, j as ShortcutSlots, D as States, O as Tones, P as Tree, w as default };
