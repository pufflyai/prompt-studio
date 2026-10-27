// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./folder-git-2-wfLPwwiQ.ts";
import { t as i } from "./git-branch-BjWwGBn9.ts";
import { r as a, t as o } from "./list-row-BhxGCvIh.ts";
import { useRef as s, useState as c } from "react";
import { Box as l, Button as u, Dialog as d, Icon as f, Menu as p, Portal as m, Stack as h } from "@chakra-ui/react";
import { jsx as g, jsxs as _ } from "react/jsx-runtime";
// packages/ui/src/components/overlays/searchable-menu.stories.tsx
var v = Array.from({ length: 18 }, (e, t) => {
	let n = t === 0 ? "main" : `feature/searchable-menu-${t}`;
	return {
		id: n,
		label: n,
		searchText: `origin/${n}`,
		icon: i,
		isSelected: n === "main"
	};
}), y = Array.from({ length: 12 }, (e, t) => {
	let n = t === 0 ? "prompt-studio" : `repo-browser-${t}`;
	return {
		id: n,
		label: n,
		searchText: `/repos/${n}`,
		icon: r,
		isSelected: !1
	};
}), b = {
	title: "Components/Navigation/Searchable Menu",
	component: a,
	parameters: {
		layout: "padded",
		docs: { description: { component: "Searchable selection menu for switching between local option sets. RULE: Menu item subtitles must add distinct context and never contain the same information as the title." } }
	},
	decorators: [(e) => /* @__PURE__ */ g(l, {
		maxWidth: "320px",
		children: /* @__PURE__ */ g(e, {})
	})]
}, x = {
	tags: ["menu-selection"],
	render: () => /* @__PURE__ */ g(a, {
		trigger: /* @__PURE__ */ g(u, {
			variant: "outline",
			children: "Select branch"
		}),
		items: v,
		searchPlaceholder: "Search branches…",
		portalled: !1,
		emptyState: /* @__PURE__ */ g(p.Item, {
			value: "empty",
			asChild: !0,
			children: /* @__PURE__ */ g(o, {
				asChild: !0,
				variant: "full-width",
				label: "No branches found",
				icon: /* @__PURE__ */ g(f, {
					as: i,
					boxSize: "16px"
				}),
				disabled: !0
			})
		})
	}),
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await t.click(i.getByRole("button", { name: "Select branch" }));
		let a = i.getByLabelText("Search branches…");
		await t.type(a, "origin/main"), await n(i.getByRole("menuitem", { name: "main" })).toBeVisible(), await n(i.queryByRole("option", { name: "main" })).not.toBeInTheDocument(), await n(i.queryByRole("menuitem", { name: "feature/searchable-menu-1" })).not.toBeInTheDocument();
	}
}, S = {
	tags: ["menu-selection"],
	render: () => {
		let [e, t] = c("main"), [n, s] = c("prompt-studio"), l = y.find((e) => e.id === n)?.label ?? n;
		return /* @__PURE__ */ g(a, {
			trigger: /* @__PURE__ */ g(u, {
				variant: "outline",
				children: "Switchable menu"
			}),
			items: v.map((n) => ({
				...n,
				isSelected: n.id === e,
				onSelect: () => t(n.id)
			})),
			searchPlaceholder: "Search branches…",
			portalled: !1,
			emptyState: /* @__PURE__ */ g(p.Item, {
				value: "empty",
				asChild: !0,
				children: /* @__PURE__ */ g(o, {
					asChild: !0,
					variant: "full-width",
					label: "No branches found",
					icon: /* @__PURE__ */ g(f, {
						as: i,
						boxSize: "16px"
					}),
					disabled: !0
				})
			}),
			parentList: {
				items: y.map((e) => ({
					...e,
					isSelected: e.id === n
				})),
				selectedLabel: l,
				selectedIcon: r,
				ariaLabel: "Toggle list",
				showSearch: !0,
				searchPlaceholder: "Search repositories…",
				emptyState: /* @__PURE__ */ g(p.Item, {
					value: "empty",
					asChild: !0,
					children: /* @__PURE__ */ g(o, {
						asChild: !0,
						variant: "full-width",
						label: "No repositories found",
						icon: /* @__PURE__ */ g(f, {
							as: r,
							boxSize: "16px"
						}),
						disabled: !0
					})
				}),
				onSelect: (e) => s(e.id)
			}
		});
	},
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await t.click(i.getByRole("button", { name: "Switchable menu" }));
		let a = i.getByLabelText("Search branches…");
		await t.type(a, "searchable-menu-1"), await n(i.getByText("feature/searchable-menu-1")).toBeVisible(), await t.click(i.getByRole("menuitem", { name: "Toggle list" }));
		let o = i.getByLabelText("Search repositories…");
		await n(o).toHaveValue(""), await t.type(o, "repo-browser-1"), await n(i.getByText("repo-browser-1")).toBeVisible(), await t.click(i.getByRole("menuitem", { name: "repo-browser-1" }));
		let s = i.getByLabelText("Search branches…");
		await n(s).toHaveValue("");
	}
}, C = { render: () => /* @__PURE__ */ g(a, {
	trigger: /* @__PURE__ */ g(u, {
		variant: "outline",
		children: "Single repo"
	}),
	items: v,
	searchPlaceholder: "Search branches…",
	portalled: !1,
	emptyState: /* @__PURE__ */ g(p.Item, {
		value: "empty",
		asChild: !0,
		children: /* @__PURE__ */ g(o, {
			asChild: !0,
			variant: "full-width",
			label: "No branches found",
			icon: /* @__PURE__ */ g(f, {
				as: i,
				boxSize: "16px"
			}),
			disabled: !0
		})
	}),
	parentList: {
		items: [{
			id: "prompt-studio",
			label: "prompt-studio",
			icon: r
		}],
		selectedLabel: "prompt-studio",
		selectedIcon: r,
		ariaLabel: "Toggle list",
		disabled: !0,
		emptyState: /* @__PURE__ */ g(p.Item, {
			value: "empty",
			asChild: !0,
			children: /* @__PURE__ */ g(o, {
				asChild: !0,
				variant: "full-width",
				label: "No repositories found",
				icon: /* @__PURE__ */ g(f, {
					as: r,
					boxSize: "16px"
				}),
				disabled: !0
			})
		})
	}
}) }, w = {
	parameters: { layout: "fullscreen" },
	render: () => {
		let e = s(null);
		return /* @__PURE__ */ g(d.Root, {
			open: !0,
			modal: !0,
			children: /* @__PURE__ */ _(m, { children: [/* @__PURE__ */ g(d.Backdrop, {}), /* @__PURE__ */ g(d.Positioner, { children: /* @__PURE__ */ _(d.Content, {
				ref: e,
				maxW: "sm",
				overflow: "hidden",
				children: [/* @__PURE__ */ g(d.Header, { children: /* @__PURE__ */ g(d.Title, { children: "Create workspace" }) }), /* @__PURE__ */ g(d.Body, { children: /* @__PURE__ */ _(h, {
					alignItems: "flex-start",
					gap: "3",
					children: [/* @__PURE__ */ g(a, {
						portalContainer: e,
						positioning: {
							strategy: "fixed",
							hideWhenDetached: !0
						},
						trigger: /* @__PURE__ */ g(u, {
							variant: "outline",
							children: "Select workspace"
						}),
						items: v,
						searchPlaceholder: "Search workspaces...",
						emptyState: /* @__PURE__ */ g(p.Item, {
							value: "empty",
							asChild: !0,
							children: /* @__PURE__ */ g(o, {
								asChild: !0,
								variant: "full-width",
								label: "No workspaces found",
								icon: /* @__PURE__ */ g(f, {
									as: i,
									boxSize: "16px"
								}),
								disabled: !0
							})
						})
					}), /* @__PURE__ */ g(u, {
						variant: "primary",
						children: "Create workspace"
					})]
				}) })]
			}) })] })
		});
	},
	play: async () => {
		let r = e(document.body);
		await t.click(r.getByRole("button", { name: "Select workspace" })), await n(r.getByRole("menuitem", { name: "main" })).toBeVisible();
	}
};
export { x as BranchSelector, C as DisabledParentList, w as PortalledInsideDialog, S as SwitchableLists, b as default };
