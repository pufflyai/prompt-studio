// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { useState as i } from "react";
import { Avatar as a, Badge as o, Box as s, Button as c, Drawer as l, Editable as u, Field as d, HStack as f, IconButton as p, Input as m, Kbd as ee, NumberInput as h, Popover as g, Portal as _, Progress as v, ProgressCircle as y, Separator as b, Skeleton as x, Spinner as S, Stack as C, Table as w, Tabs as T, Tag as E, Text as D, Textarea as O } from "@chakra-ui/react";
import { AlertMessage as te, Breadcrumb as ne, Checkbox as k, Chip as re, CopyButton as ie, DeleteConfirmationModal as ae, EmptyState as oe, Header as A, ListRow as j, Radio as M, RadioGroup as N, ResourceBadge as P, ScrollArea as F, SearchableMenu as I, SegmentedControl as L, SimpleCard as R, SimpleCardBody as z, Slider as B, Switch as V, Tooltip as H, TreeList as U, WindowTabs as W, WorkspaceBadge as G } from "@pstdio/ui";
import { jsx as K, jsxs as q } from "react/jsx-runtime";
import { ChatInput as se, createSerializedPromptState as ce } from "@pstdio/ui/chat-ui";
import { DataTable as le } from "@pstdio/ui/data-table";
// extensions/pstdio-base-themes/stories/gallery-section.tsx
function J(e) {
	let { title: t, children: n } = e;
	return /* @__PURE__ */ q(C, {
		as: "section",
		gap: "sm",
		minW: "0",
		children: [/* @__PURE__ */ K(D, {
			as: "h2",
			textStyle: "label/M/medium",
			children: t
		}), n]
	});
}
// extensions/pstdio-base-themes/stories/buttons-and-inputs.tsx
var ue = [
	"primary",
	"outline",
	"ghost",
	"subtle",
	"destructive"
], de = [
	"Default",
	"Hover",
	"Pressed",
	"Focus",
	"Disabled",
	"Loading"
];
function fe() {
	return /* @__PURE__ */ q(J, {
		title: "Buttons and interaction states",
		children: [
			/* @__PURE__ */ K(D, {
				textStyle: "label/S/regular",
				color: "fg.muted",
				children: "Each row: default, hover, pressed, keyboard focus, disabled, loading."
			}),
			ue.map((e) => /* @__PURE__ */ q(C, {
				gap: "2xs",
				children: [/* @__PURE__ */ K(D, {
					textStyle: "label/S/medium",
					children: e
				}), /* @__PURE__ */ K(f, {
					gap: "2xs",
					flexWrap: "wrap",
					children: de.map((t) => /* @__PURE__ */ K(c, {
						variant: e,
						size: "xs",
						"data-hover": t === "Hover" ? "" : void 0,
						"data-active": t === "Pressed" ? "" : void 0,
						"data-focus-visible": t === "Focus" ? "" : void 0,
						disabled: t === "Disabled",
						loading: t === "Loading",
						children: t
					}, t))
				})]
			}, e)),
			/* @__PURE__ */ q(f, {
				gap: "xs",
				children: [
					/* @__PURE__ */ K(p, {
						"aria-label": "Add item",
						variant: "outline",
						size: "xs",
						children: "+"
					}),
					/* @__PURE__ */ K(c, {
						variant: "ghost",
						"aria-pressed": "true",
						size: "xs",
						children: "Toggled"
					}),
					[
						"2xs",
						"xs",
						"sm",
						"md"
					].map((e) => /* @__PURE__ */ K(c, {
						size: e,
						children: e
					}, e))
				]
			})
		]
	});
}
function pe() {
	return /* @__PURE__ */ q(J, {
		title: "Fields and selection controls",
		children: [
			/* @__PURE__ */ q(d.Root, { children: [/* @__PURE__ */ K(d.Label, { children: "Name" }), /* @__PURE__ */ K(m, {
				placeholder: "Default input",
				"aria-label": "Default input"
			})] }),
			/* @__PURE__ */ K(m, {
				placeholder: "Hover",
				"aria-label": "Hovered input",
				"data-hover": ""
			}),
			/* @__PURE__ */ K(m, {
				placeholder: "Keyboard focus",
				"aria-label": "Focused input",
				"data-focus-visible": ""
			}),
			/* @__PURE__ */ K(m, {
				placeholder: "Disabled input",
				"aria-label": "Disabled input",
				disabled: !0
			}),
			/* @__PURE__ */ q(d.Root, {
				invalid: !0,
				children: [
					/* @__PURE__ */ K(d.Label, { children: "Invalid field" }),
					/* @__PURE__ */ K(m, { defaultValue: "Incomplete" }),
					/* @__PURE__ */ K(d.ErrorText, { children: "Enter a complete value." })
				]
			}),
			/* @__PURE__ */ K(O, {
				placeholder: "Multiline notes",
				"aria-label": "Multiline notes"
			}),
			/* @__PURE__ */ q(h.Root, {
				defaultValue: "3",
				min: 0,
				max: 10,
				size: "sm",
				children: [/* @__PURE__ */ K(h.Input, { "aria-label": "Item count" }), /* @__PURE__ */ q(h.Control, { children: [/* @__PURE__ */ K(h.IncrementTrigger, {}), /* @__PURE__ */ K(h.DecrementTrigger, {})] })]
			}),
			/* @__PURE__ */ q(f, {
				flexWrap: "wrap",
				children: [
					/* @__PURE__ */ K(k, {
						size: "sm",
						children: "Unchecked"
					}),
					/* @__PURE__ */ K(k, {
						size: "sm",
						defaultChecked: !0,
						children: "Checked"
					}),
					/* @__PURE__ */ K(k, {
						size: "sm",
						checked: "indeterminate",
						children: "Mixed"
					}),
					/* @__PURE__ */ K(k, {
						size: "sm",
						disabled: !0,
						children: "Disabled"
					})
				]
			}),
			/* @__PURE__ */ q(f, { children: [
				/* @__PURE__ */ K(V, {
					size: "sm",
					children: "Off"
				}),
				/* @__PURE__ */ K(V, {
					size: "sm",
					defaultChecked: !0,
					children: "On"
				}),
				/* @__PURE__ */ K(V, {
					size: "sm",
					disabled: !0,
					children: "Disabled"
				})
			] }),
			/* @__PURE__ */ K(N, {
				defaultValue: "one",
				size: "sm",
				children: /* @__PURE__ */ q(f, { children: [
					/* @__PURE__ */ K(M, {
						value: "one",
						children: "One"
					}),
					/* @__PURE__ */ K(M, {
						value: "two",
						children: "Two"
					}),
					/* @__PURE__ */ K(M, {
						value: "three",
						disabled: !0,
						children: "Disabled"
					})
				] })
			}),
			/* @__PURE__ */ K(s, {
				py: "sm",
				children: /* @__PURE__ */ K(B, {
					"aria-label": ["Volume"],
					defaultValue: [40]
				})
			})
		]
	});
}
// extensions/pstdio-base-themes/stories/composed-components.tsx
var me = ce();
function he() {
	let [e, t] = i("");
	return /* @__PURE__ */ q(J, {
		title: "Composed components and auxiliary controls",
		children: [
			/* @__PURE__ */ q(A, {
				variant: "narrow",
				children: [/* @__PURE__ */ K(D, { children: "Panel header" }), /* @__PURE__ */ K(ie, {
					text: "Theme comparison",
					label: "Copy title",
					size: "xs"
				})]
			}),
			/* @__PURE__ */ q(f, {
				flexWrap: "wrap",
				children: [
					/* @__PURE__ */ K(a.Root, {
						size: "xs",
						children: /* @__PURE__ */ K(a.Fallback, { name: "Theme Reviewer" })
					}),
					/* @__PURE__ */ K(P, {
						fileName: "theme.json",
						size: "sm"
					}),
					/* @__PURE__ */ K(G, {
						workspaceType: "folder",
						label: "Workspace"
					}),
					/* @__PURE__ */ K(E.Root, {
						size: "sm",
						children: /* @__PURE__ */ K(E.Label, { children: "Tag" })
					}),
					/* @__PURE__ */ K(y.Root, {
						value: 60,
						size: "xs",
						children: /* @__PURE__ */ q(y.Circle, { children: [/* @__PURE__ */ K(y.Track, {}), /* @__PURE__ */ K(y.Range, {})] })
					})
				]
			}),
			/* @__PURE__ */ q(u.Root, {
				defaultValue: "Click to rename",
				activationMode: "click",
				"aria-label": "Editable name",
				children: [/* @__PURE__ */ K(u.Preview, {}), /* @__PURE__ */ K(u.Input, {})]
			}),
			/* @__PURE__ */ K(F, {
				height: "24",
				borderWidth: "1px",
				borderColor: "border.subtle",
				children: /* @__PURE__ */ K(C, {
					gap: "xs",
					p: "xs",
					children: Array.from({ length: 8 }, (e, t) => /* @__PURE__ */ q(D, { children: ["Scrollable item ", t + 1] }, t))
				})
			}),
			/* @__PURE__ */ K(s, {
				height: "xs",
				minW: "0",
				children: /* @__PURE__ */ K(le, {
					data: [{
						Resource: "Theme audit",
						Status: "Ready"
					}, {
						Resource: "Component review",
						Status: "In progress"
					}],
					selectionMode: "multiple"
				})
			}),
			/* @__PURE__ */ K(s, {
				bg: "bg.muted",
				p: "2xs",
				borderRadius: "xs",
				children: /* @__PURE__ */ K(se, {
					defaultState: me,
					placeholder: "Write a message",
					onSubmit: (e) => t(e)
				})
			}),
			e && /* @__PURE__ */ q(D, {
				textStyle: "label/S/regular",
				children: ["Sent: ", e]
			})
		]
	});
}
// extensions/pstdio-base-themes/stories/contrast.ts
var Y = (e) => e.match(/[\d.]+/g).slice(0, 3).map(Number).reduce((e, t, n) => {
	let r = t / 255;
	return e + (r <= .04045 ? r / 12.92 : ((r + .055) / 1.055) ** 2.4) * [
		.2126,
		.7152,
		.0722
	][n];
}, 0), X = (e, t) => {
	let n = Y(e), r = Y(t);
	return (Math.max(n, r) + .05) / (Math.min(n, r) + .05);
}, ge = [
	"bg",
	"bg.panel",
	"bg.subtle",
	"bg.muted",
	"bg.hover",
	"bg.active",
	"bg.code"
];
function _e() {
	return /* @__PURE__ */ q(J, {
		title: "Surfaces, text and borders",
		children: [
			/* @__PURE__ */ K(C, {
				gap: "2xs",
				children: ge.map((e) => /* @__PURE__ */ K(s, {
					"data-theme-surface": e,
					bg: e,
					p: "sm",
					borderWidth: "1px",
					borderColor: "border",
					children: /* @__PURE__ */ q(f, {
						justify: "space-between",
						children: [/* @__PURE__ */ K(D, {
							textStyle: "label/S/medium",
							children: e
						}), /* @__PURE__ */ K(D, {
							color: "fg.muted",
							textStyle: "label/S/regular",
							children: "Muted text"
						})]
					})
				}, e))
			}),
			/* @__PURE__ */ K(f, {
				gap: "sm",
				children: [
					"border",
					"border.subtle",
					"border.accent"
				].map((e) => /* @__PURE__ */ K(s, {
					borderWidth: "1px",
					borderColor: e,
					p: "xs",
					children: /* @__PURE__ */ K(D, {
						textStyle: "label/XS",
						children: e
					})
				}, e))
			}),
			/* @__PURE__ */ K(D, {
				textStyle: "heading/M",
				children: "Heading"
			}),
			/* @__PURE__ */ q(D, {
				textStyle: "paragraph/S/regular",
				children: [
					"Body text and",
					" ",
					/* @__PURE__ */ K(D, {
						as: "span",
						color: "fg.muted",
						children: "secondary text"
					}),
					"."
				]
			})
		]
	});
}
// extensions/pstdio-base-themes/stories/navigation-and-feedback.tsx
function ve() {
	let [e, t] = i("list"), [n, r] = i("overview"), [a, o] = i("selected"), [c, l] = i(["folder"]);
	return /* @__PURE__ */ q(J, {
		title: "Navigation and lists",
		children: [
			/* @__PURE__ */ K(ne, { items: [{
				title: "Project",
				onClick: () => o("project")
			}, { title: "Settings" }] }),
			/* @__PURE__ */ q(T.Root, {
				defaultValue: "general",
				size: "sm",
				children: [
					/* @__PURE__ */ q(T.List, { children: [
						/* @__PURE__ */ K(T.Trigger, {
							value: "general",
							children: "General"
						}),
						/* @__PURE__ */ K(T.Trigger, {
							value: "advanced",
							children: "Advanced"
						}),
						/* @__PURE__ */ K(T.Trigger, {
							value: "disabled",
							disabled: !0,
							children: "Disabled"
						})
					] }),
					/* @__PURE__ */ K(T.Content, {
						value: "general",
						children: "General settings"
					}),
					/* @__PURE__ */ K(T.Content, {
						value: "advanced",
						children: "Advanced settings"
					})
				]
			}),
			/* @__PURE__ */ K(L, {
				"aria-label": "View",
				options: [{
					label: "List",
					value: "list"
				}, {
					label: "Grid",
					value: "grid"
				}],
				value: e,
				onValueChange: t
			}),
			/* @__PURE__ */ K(W, {
				"aria-label": "Open resources",
				tabs: [{
					id: "overview",
					label: "Overview"
				}, {
					id: "notes",
					label: "Notes"
				}],
				selectedId: n,
				onSelect: r,
				onClose: () => r(void 0)
			}),
			/* @__PURE__ */ q(s, {
				"data-testid": "navigation-panel",
				bg: "bg.panel",
				p: "sm",
				borderWidth: "1px",
				borderColor: "border.subtle",
				children: [
					/* @__PURE__ */ K(D, {
						color: "fg.muted",
						textStyle: "label/S/regular",
						children: "Rows on a panel surface"
					}),
					/* @__PURE__ */ K(j, {
						id: "default",
						label: "Default row",
						description: "Hover or select this row",
						isSelected: a === "default",
						onClick: () => o("default")
					}),
					/* @__PURE__ */ K(j, {
						id: "selected",
						label: "Selected row",
						isSelected: a === "selected",
						onClick: () => o("selected")
					}),
					/* @__PURE__ */ K(j, {
						id: "hovered",
						label: "Hovered row",
						"data-testid": "panel-hover-row",
						"data-hover": ""
					}),
					/* @__PURE__ */ K(j, {
						id: "disabled",
						label: "Disabled row",
						disabled: !0
					}),
					/* @__PURE__ */ K(U, {
						expandedSectionIds: ["files"],
						expandedNodeIds: c,
						onToggleNode: (e) => l(c.includes(e) ? [] : [e]),
						sections: [{
							id: "files",
							label: "Files",
							nodes: [{
								id: "folder",
								label: "Folder",
								isContainer: !0,
								children: [{
									id: "readme",
									label: "README.md"
								}]
							}]
						}]
					})
				]
			})
		]
	});
}
function ye() {
	return /* @__PURE__ */ q(J, {
		title: "Data display and feedback",
		children: [
			/* @__PURE__ */ q(f, {
				flexWrap: "wrap",
				children: [
					/* @__PURE__ */ K(o, {
						variant: "ticket",
						children: "Ticket"
					}),
					/* @__PURE__ */ K(o, {
						variant: "chip",
						children: "Chip badge"
					}),
					/* @__PURE__ */ K(re, { children: "Label" }),
					/* @__PURE__ */ K(ee, { children: "⌘ K" })
				]
			}),
			/* @__PURE__ */ K(R, { children: /* @__PURE__ */ K(z, { children: /* @__PURE__ */ q(C, {
				gap: "2xs",
				children: [
					/* @__PURE__ */ K(D, { children: "Card heading" }),
					/* @__PURE__ */ K(D, {
						color: "fg.muted",
						children: "Muted supporting text"
					}),
					/* @__PURE__ */ K(D, {
						color: "fg.subtle",
						children: "Subtle text"
					})
				]
			}) }) }),
			/* @__PURE__ */ q(w.Root, {
				size: "sm",
				children: [/* @__PURE__ */ K(w.Header, { children: /* @__PURE__ */ q(w.Row, { children: [/* @__PURE__ */ K(w.ColumnHeader, { children: "Resource" }), /* @__PURE__ */ K(w.ColumnHeader, { children: "Status" })] }) }), /* @__PURE__ */ q(w.Body, { children: [/* @__PURE__ */ q(w.Row, { children: [/* @__PURE__ */ K(w.Cell, { children: "Theme audit" }), /* @__PURE__ */ K(w.Cell, { children: "Ready" })] }), /* @__PURE__ */ q(w.Row, { children: [/* @__PURE__ */ K(w.Cell, { children: "Component review" }), /* @__PURE__ */ K(w.Cell, { children: "In progress" })] })] })]
			}),
			/* @__PURE__ */ K(b, {}),
			[
				"info",
				"success",
				"warning",
				"error"
			].map((e) => /* @__PURE__ */ K(te, {
				status: e,
				variant: "subtle",
				title: e,
				children: "Supporting status text"
			}, e)),
			/* @__PURE__ */ K(v.Root, {
				value: 65,
				size: "sm",
				children: /* @__PURE__ */ K(v.Track, { children: /* @__PURE__ */ K(v.Range, {}) })
			}),
			/* @__PURE__ */ q(f, { children: [/* @__PURE__ */ K(S, { size: "sm" }), /* @__PURE__ */ K(D, {
				color: "fg.muted",
				children: "Loading"
			})] }),
			/* @__PURE__ */ K(x, { height: "6" }),
			/* @__PURE__ */ K(oe, {
				title: "No resources",
				description: "Create a resource to get started.",
				size: "sm"
			})
		]
	});
}
// extensions/pstdio-base-themes/stories/overlays.tsx
function be() {
	let [e, t] = i(!1), [n, r] = i("None");
	return /* @__PURE__ */ q(J, {
		title: "Menus, tooltips and overlays",
		children: [
			/* @__PURE__ */ K(D, {
				textStyle: "label/S/regular",
				color: "fg.muted",
				children: "Open controls to compare surfaces, focus and portal colors."
			}),
			/* @__PURE__ */ q(C, {
				align: "start",
				children: [
					/* @__PURE__ */ K(I, {
						trigger: /* @__PURE__ */ K(c, { children: "Choose resource" }),
						searchPlaceholder: "Find a resource",
						emptyState: "No matching resources",
						items: [
							{
								id: "one",
								label: "First resource",
								onSelect: () => r("First resource")
							},
							{
								id: "two",
								label: "Selected resource",
								isSelected: !0,
								onSelect: () => r("Selected resource")
							},
							{
								id: "disabled",
								label: "Disabled resource",
								isDisabled: !0
							}
						]
					}),
					/* @__PURE__ */ q(D, {
						textStyle: "label/S/regular",
						children: ["Selected: ", n]
					}),
					/* @__PURE__ */ K(H, {
						content: "Helpful information",
						children: /* @__PURE__ */ K(c, {
							variant: "ghost",
							children: "Hover for tooltip"
						})
					}),
					/* @__PURE__ */ q(g.Root, { children: [/* @__PURE__ */ K(g.Trigger, {
						asChild: !0,
						children: /* @__PURE__ */ K(c, { children: "Open popover" })
					}), /* @__PURE__ */ K(_, { children: /* @__PURE__ */ K(g.Positioner, { children: /* @__PURE__ */ K(g.Content, { children: /* @__PURE__ */ K(g.Body, { children: /* @__PURE__ */ K(D, { children: "Popover surface and border" }) }) }) }) })] }),
					/* @__PURE__ */ K(c, {
						onClick: () => t(!0),
						children: "Open dialog"
					}),
					/* @__PURE__ */ K(ae, {
						open: e,
						onClose: () => t(!1),
						onDelete: () => t(!1),
						headline: "Remove resource?",
						notificationText: "Review the dialog surface, border, and actions.",
						buttonText: "Remove"
					}),
					/* @__PURE__ */ q(l.Root, {
						size: "xs",
						children: [/* @__PURE__ */ K(l.Trigger, {
							asChild: !0,
							children: /* @__PURE__ */ K(c, { children: "Open drawer" })
						}), /* @__PURE__ */ q(_, { children: [/* @__PURE__ */ K(l.Backdrop, {}), /* @__PURE__ */ K(l.Positioner, { children: /* @__PURE__ */ q(l.Content, { children: [
							/* @__PURE__ */ K(l.Header, { children: /* @__PURE__ */ K(l.Title, { children: "Drawer" }) }),
							/* @__PURE__ */ K(l.Body, { children: "Panel content" }),
							/* @__PURE__ */ K(l.Footer, { children: /* @__PURE__ */ K(l.CloseTrigger, {
								asChild: !0,
								children: /* @__PURE__ */ K(c, { children: "Close drawer" })
							}) })
						] }) })] })]
					})
				]
			}),
			/* @__PURE__ */ q(f, { children: [/* @__PURE__ */ K(c, {
				variant: "primary",
				children: "Primary action"
			}), /* @__PURE__ */ K(c, { children: "Cancel" })] })
		]
	});
}
// extensions/pstdio-base-themes/stories/core-components.stories.tsx
var Z = {
	foundations: _e,
	buttons: fe,
	inputs: pe,
	navigation: ve,
	feedback: ye,
	overlays: be,
	composed: he
};
function xe(e) {
	let { section: t } = e, n = t === "all" ? Object.entries(Z) : [[t, Z[t]]];
	return /* @__PURE__ */ K(C, {
		"data-testid": "theme-canvas",
		gap: "xl",
		p: "md",
		bg: "bg",
		color: "fg",
		minH: "100vh",
		children: n.map(([e, t]) => /* @__PURE__ */ K(t, {}, e))
	});
}
var Q = {
	title: "Themes/Single theme",
	component: xe,
	args: { section: "all" },
	argTypes: { section: {
		control: "select",
		options: ["all", ...Object.keys(Z)]
	} }
}, Se = {}, $ = {
	globals: { theme: "solarized-light" },
	play: async ({ canvasElement: i, args: a, globals: o }) => {
		let s = e(i);
		if (await t(() => r(document.body.dataset.theme).toBe(o.theme)), a.section === "all" || a.section === "foundations") {
			for (let e of i.querySelectorAll("[data-theme-surface]")) {
				let t = getComputedStyle(e).backgroundColor;
				for (let n of e.querySelectorAll("p")) await r(X(getComputedStyle(n).color, t)).toBeGreaterThanOrEqual(4.5);
			}
			let e = i.querySelector("[data-theme-surface] p"), t = getComputedStyle(e, "::selection");
			await r(X(t.color, t.backgroundColor)).toBeGreaterThanOrEqual(4.5);
		}
		if (a.section === "all" || a.section === "buttons") {
			let e = s.getAllByRole("button", { name: "Default" })[0], n = s.getAllByRole("button", { name: "Hover" })[0];
			await r(getComputedStyle(e).backgroundColor).not.toBe(getComputedStyle(n).backgroundColor);
			for (let e of [
				"Default",
				"Hover",
				"Pressed"
			]) {
				let n = s.getAllByRole("button", { name: e })[0];
				await t(() => {
					let e = getComputedStyle(n);
					return r(X(e.color, e.backgroundColor)).toBeGreaterThanOrEqual(4.5);
				});
			}
			let i = s.getAllByRole("button", { name: "Hover" })[2];
			await t(() => r(getComputedStyle(i).backgroundColor).not.toBe("rgba(0, 0, 0, 0)"));
		}
		if (a.section === "all" || a.section === "inputs") {
			let e = s.getByRole("checkbox", { name: "Unchecked" });
			await n.click(e), await r(e).toBeChecked(), await n.click(e);
		}
		if (a.section === "all" || a.section === "navigation") {
			let e = s.getByTestId("navigation-panel"), t = s.getByTestId("panel-hover-row"), i = getComputedStyle(t).backgroundColor;
			await r(i).not.toBe("rgba(0, 0, 0, 0)"), await r(i).not.toBe(getComputedStyle(e).backgroundColor), await r(i).not.toBe(getComputedStyle(s.getByTestId("theme-canvas")).backgroundColor);
			let a = s.getByRole("tab", { name: "Advanced" });
			await n.click(a), await r(a).toHaveAttribute("aria-selected", "true"), await n.click(s.getByRole("tab", { name: "General" }));
		}
	}
}, Ce = {
	...$,
	globals: { theme: "solarized-dark" }
}, we = {
	...$,
	globals: { theme: "dracula" }
}, Te = {
	...$,
	globals: { theme: "monokai" }
};
export { Se as Core, we as DraculaChecks, $ as InteractionChecks, Te as MonokaiChecks, Ce as SolarizedDarkChecks, Q as default };
