// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./chevron-down-ZmPqsMG0.ts";
import { t as n } from "./grip-vertical-C8TSneyx.ts";
import { t as r } from "./plus-CYkLGSPS.ts";
import { t as i } from "./trash-2-C03vrbuo.ts";
import { S as a, b as o, l as s, s as c, t as l, x as u } from "./core.esm-cje5eyjm.ts";
import { t as d } from "./list-row-BhxGCvIh.ts";
import { t as f } from "./icon-color-picker-B4kA53R8.ts";
import { a as p, i as m, n as h, t as g } from "./sortable.esm-R8iGneY7.ts";
import { t as _ } from "./delete-confirmation-modal-CYhD_8An.ts";
import { useState as v } from "react";
import { Badge as y, Button as b, Editable as x, Flex as S, HStack as C, Icon as w, IconButton as T, Menu as E, Stack as D, Text as O, chakra as k } from "@chakra-ui/react";
import { Fragment as A, jsx as j, jsxs as M } from "react/jsx-runtime";
// packages/ui/src/components/tag-editor/tag-editor-heading.tsx
var N = (e) => {
	let { children: t, hasChanges: n } = e;
	return /* @__PURE__ */ M(C, {
		gap: "3xs",
		minWidth: "0",
		children: [/* @__PURE__ */ j(O, {
			textStyle: "label/L/medium",
			truncate: !0,
			children: t
		}), n ? /* @__PURE__ */ j(O, {
			textStyle: "label/L/medium",
			color: "fg.muted",
			"aria-label": "Unsaved changes",
			children: "*"
		}) : null]
	});
}, P = (e) => e.length === 0 ? "None" : e.length === 1 ? e[0].label : `${e[0].label} +${e.length - 1}`, F = (n) => {
	let { actions: r, disabled: i, label: a, options: o, optionName: s, onChange: c } = n, l = o.filter((e) => r.includes(e.value)), u = (e) => {
		c(r.includes(e) ? r.filter((t) => t !== e) : [...r, e]);
	};
	return /* @__PURE__ */ M(E.Root, {
		closeOnSelect: !1,
		children: [/* @__PURE__ */ j(E.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ M(b, {
				size: "2xs",
				variant: "ghost",
				gap: "xs",
				color: l.length === 0 ? "fg.subtle" : "fg",
				disabled: i,
				"aria-label": `${a} for ${s}`,
				children: [
					l[0]?.icon,
					P(l),
					/* @__PURE__ */ j(w, {
						as: t,
						boxSize: "icon-2xs"
					})
				]
			})
		}), /* @__PURE__ */ j(E.Positioner, { children: /* @__PURE__ */ j(E.Content, {
			minW: "tag-action-menu",
			bg: "bg",
			children: o.map((t) => /* @__PURE__ */ j(E.Item, {
				value: t.value,
				asChild: !0,
				children: /* @__PURE__ */ j(d, {
					asChild: !0,
					variant: "full-width",
					id: t.value,
					label: t.label,
					icon: t.icon,
					isSelected: r.includes(t.value),
					endContent: r.includes(t.value) ? /* @__PURE__ */ j(w, {
						as: e,
						boxSize: "icon-xs"
					}) : void 0,
					onActivate: () => u(t.value)
				})
			}, t.value))
		}) })]
	});
}, I = (e) => {
	let { actionOptions: t, actionsLabel: r = "Actions", colorOptions: o, iconOptions: s, value: c, isSaving: l, readOnly: u, showDefault: d, showIcons: p, onActionsChange: h, onColorChange: g, onDelete: _, onIconChange: v, onNameChange: b } = e, C = l || u, { attributes: E, listeners: D, setNodeRef: O, transform: k, transition: A, isDragging: N } = m({
		id: c.id,
		disabled: C
	});
	return /* @__PURE__ */ M(S, {
		ref: O,
		style: {
			transform: a.Transform.toString(k),
			transition: A
		},
		className: "group",
		height: "tag-editor-row",
		alignItems: "center",
		gap: "compact",
		px: "xs",
		borderBottomWidth: "1px",
		borderColor: "border.subtle",
		bg: N ? "bg.elevated" : "transparent",
		borderRadius: N ? "compact" : "none",
		borderWidth: N ? "1px" : void 0,
		boxShadow: N ? "lg" : void 0,
		_hover: { bg: N ? "bg.elevated" : "bg.muted" },
		children: [
			/* @__PURE__ */ j(S, {
				cursor: u ? "default" : "grab",
				color: "fg.subtle",
				_groupHover: { color: "fg.muted" },
				"aria-label": `Reorder ${c.name}`,
				...E,
				...D,
				children: /* @__PURE__ */ j(w, {
					as: n,
					boxSize: "icon-xs"
				})
			}),
			/* @__PURE__ */ j(f, {
				color: c.color,
				colorOptions: o,
				icon: c.icon,
				iconOptions: s,
				showIcons: p,
				onColorChange: g,
				onIconChange: v,
				disabled: C,
				"aria-label": `Change ${c.name} appearance`
			}),
			/* @__PURE__ */ M(S, {
				flex: "1",
				minWidth: "0",
				alignItems: "center",
				gap: "xs",
				children: [/* @__PURE__ */ M(x.Root, {
					minWidth: "0",
					defaultValue: c.name,
					defaultEdit: c.isNew,
					selectOnFocus: !0,
					disabled: C,
					onValueCommit: (e) => {
						let t = e.value.trim();
						t && t !== c.name && b(t);
					},
					children: [/* @__PURE__ */ j(x.Preview, { textStyle: "paragraph/S/regular" }), /* @__PURE__ */ j(x.Input, { textStyle: "paragraph/S/regular" })]
				}, c.name), d && c.isDefault ? /* @__PURE__ */ j(y, {
					size: "sm",
					variant: "subtle",
					colorPalette: "blue",
					children: "Default"
				}) : null]
			}),
			t ? /* @__PURE__ */ j(S, {
				width: "tag-editor-commands",
				justifyContent: "flex-end",
				children: /* @__PURE__ */ j(F, {
					actions: c.actions ?? [],
					disabled: C,
					label: r,
					optionName: c.name,
					options: t,
					onChange: h
				})
			}) : null,
			/* @__PURE__ */ j(T, {
				size: "xs",
				variant: "destructive-ghost",
				onClick: _,
				disabled: C || c.isDefault,
				"aria-label": `Delete ${c.name}`,
				children: /* @__PURE__ */ j(w, {
					as: i,
					boxSize: "icon-xs"
				})
			})
		]
	});
}, L = (e) => e.length > 0 ? Math.max(...e.map((e) => e.sortOrder)) + 1 : 0, R = (e) => {
	let { title: t, hasChanges: n, isSaving: r, onTitleChange: i } = e;
	return i ? /* @__PURE__ */ M(x.Root, {
		defaultValue: t,
		disabled: r,
		selectOnFocus: !0,
		onValueCommit: (e) => {
			let n = e.value.trim();
			n && n !== t && i(n);
		},
		children: [/* @__PURE__ */ j(x.Preview, { textStyle: "label/L/medium" }), /* @__PURE__ */ j(x.Input, { textStyle: "label/L/medium" })]
	}, t) : /* @__PURE__ */ j(N, {
		hasChanges: n,
		children: t
	});
}, z = k("button", { base: {
	display: "flex",
	alignItems: "center",
	gap: "xs",
	height: "tag-editor-add-row",
	paddingInline: "xs",
	color: "fg.muted",
	borderRadius: "compact",
	cursor: "pointer",
	_hover: {
		bg: "bg.muted",
		color: "fg"
	},
	_disabled: {
		cursor: "not-allowed",
		opacity: .5,
		_hover: {
			bg: "transparent",
			color: "fg.muted"
		}
	}
} }), B = (e) => {
	let { valueLabel: t, actionsLabel: n } = e;
	return /* @__PURE__ */ M(S, {
		alignItems: "center",
		gap: "compact",
		paddingInline: "xs",
		height: "tag-editor-add-row",
		bg: "bg.subtle",
		borderBottomWidth: "1px",
		borderColor: "border.subtle",
		children: [
			/* @__PURE__ */ j(S, {
				width: "tag-editor-lead",
				flexShrink: "0"
			}),
			/* @__PURE__ */ j(O, {
				flex: "1",
				minWidth: "0",
				textStyle: "label/XS/caps",
				color: "fg.subtle",
				children: t
			}),
			n ? /* @__PURE__ */ j(O, {
				width: "tag-editor-commands",
				textAlign: "right",
				textStyle: "label/XS/caps",
				color: "fg.subtle",
				children: n
			}) : null,
			/* @__PURE__ */ j(S, {
				width: "tag-editor-trailing",
				flexShrink: "0"
			})
		]
	});
}, V = (n) => {
	let { label: r, values: i, disabled: a, onSelect: o } = n, s = i.find((e) => e.isDefault);
	return /* @__PURE__ */ M(S, {
		alignItems: "center",
		gap: "sm",
		paddingInline: "xs",
		paddingBlock: "xs",
		bg: "bg.subtle",
		borderTopWidth: "1px",
		borderColor: "border.subtle",
		children: [/* @__PURE__ */ j(O, {
			textStyle: "paragraph/S/regular",
			color: "fg.muted",
			children: r
		}), /* @__PURE__ */ M(E.Root, { children: [/* @__PURE__ */ j(E.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ M(b, {
				size: "2xs",
				variant: "ghost",
				gap: "xs",
				disabled: a,
				"aria-label": r,
				children: [s?.name ?? "None", /* @__PURE__ */ j(w, {
					as: t,
					boxSize: "icon-2xs"
				})]
			})
		}), /* @__PURE__ */ j(E.Positioner, { children: /* @__PURE__ */ j(E.Content, {
			minW: "tag-action-menu",
			bg: "bg",
			children: i.map((t) => /* @__PURE__ */ j(E.Item, {
				value: t.id,
				asChild: !0,
				children: /* @__PURE__ */ j(d, {
					asChild: !0,
					variant: "full-width",
					id: t.id,
					label: t.name,
					isSelected: t.isDefault,
					endContent: t.isDefault ? /* @__PURE__ */ j(w, {
						as: e,
						boxSize: "icon-xs"
					}) : void 0,
					onActivate: () => o(t)
				})
			}, t.id))
		}) })] })]
	});
}, H = (e) => {
	let { title: t, description: n, headerActions: i, values: a, onValuesChange: d, onDeleteValue: f, onSetDefault: m, onTitleChange: y, hasChanges: b, isSaving: x, readOnly: C, addLabel: T = "Add option", addName: E = "New option", actionOptions: k, actionsLabel: N, defaultValueLabel: P = "Default value", colorOptions: F, defaultAddColor: H = "blue", defaultAddIcon: U = null, deleteButtonText: W = "Delete tag", deleteHeadline: G = "Delete tag?", deleteNotificationText: K = (e) => `This will delete "${e.name}".`, iconOptions: q, showDefault: J, showIcons: Y = !0, framed: X, showColumnHeaders: ee, valueColumnLabel: te = "Name" } = e, [Z, Q] = v(null), ne = u(o(c, { activationConstraint: { distance: 5 } })), $ = (e, t) => {
		let n = [...a];
		n[e] = {
			...n[e],
			...t
		}, d(n);
	};
	return /* @__PURE__ */ M(A, { children: [/* @__PURE__ */ M(D, {
		gap: "2xs",
		children: [t || i ? /* @__PURE__ */ M(S, {
			minHeight: "tag-editor-row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "xs",
			children: [/* @__PURE__ */ M(D, {
				gap: "3xs",
				minWidth: "0",
				children: [t ? /* @__PURE__ */ j(R, {
					title: t,
					hasChanges: b,
					isSaving: x,
					onTitleChange: y
				}) : null, n ? /* @__PURE__ */ j(O, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					children: n
				}) : null]
			}), i]
		}) : null, /* @__PURE__ */ M(D, {
			gap: "none",
			borderWidth: X ? "1px" : void 0,
			borderColor: X ? "border.subtle" : void 0,
			borderRadius: X ? "md" : void 0,
			overflow: X ? "hidden" : void 0,
			children: [
				ee ? /* @__PURE__ */ j(B, {
					valueLabel: te,
					actionsLabel: k ? N : void 0
				}) : null,
				/* @__PURE__ */ j(l, {
					sensors: ne,
					collisionDetection: s,
					onDragEnd: C ? void 0 : (e) => {
						let { active: t, over: n } = e;
						if (!n || t.id === n.id) return;
						let r = a.findIndex((e) => e.id === t.id), i = a.findIndex((e) => e.id === n.id);
						r < 0 || i < 0 || d(h(a, r, i).map((e, t) => ({
							...e,
							sortOrder: t
						})));
					},
					children: /* @__PURE__ */ j(g, {
						items: a.map((e) => e.id),
						strategy: p,
						children: a.map((e, t) => /* @__PURE__ */ j(I, {
							value: e,
							isSaving: x,
							readOnly: C,
							showDefault: J,
							showIcons: Y,
							actionOptions: k,
							actionsLabel: N,
							colorOptions: F,
							iconOptions: q,
							onNameChange: (e) => $(t, { name: e }),
							onColorChange: (e) => $(t, { color: e }),
							onIconChange: (e) => $(t, { icon: e }),
							onActionsChange: (e) => $(t, { actions: e }),
							onDelete: () => Q(e)
						}, e.id))
					})
				}),
				C ? null : /* @__PURE__ */ M(z, {
					type: "button",
					disabled: x,
					onClick: () => {
						d([...a, {
							id: `new-${crypto.randomUUID()}`,
							name: E,
							color: H,
							icon: U,
							sortOrder: L(a),
							isNew: !0
						}]);
					},
					children: [/* @__PURE__ */ j(w, {
						as: r,
						boxSize: "icon-xs"
					}), /* @__PURE__ */ j(O, {
						textStyle: "paragraph/S/regular",
						children: T
					})]
				}),
				J && a.length > 0 ? /* @__PURE__ */ j(V, {
					label: P,
					values: a,
					disabled: x || C,
					onSelect: (e) => m?.(e)
				}) : null
			]
		})]
	}), /* @__PURE__ */ j(_, {
		open: !!Z,
		onClose: () => Q(null),
		onDelete: () => {
			Z && (f ? f(Z) : d(a.filter((e) => e.id !== Z.id)), Q(null));
		},
		headline: G,
		notificationText: Z ? K(Z) : "",
		buttonText: W
	})] });
};
export { N as n, H as t };
