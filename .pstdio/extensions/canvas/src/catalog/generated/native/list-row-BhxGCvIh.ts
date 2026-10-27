// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./chevron-down-ZmPqsMG0.ts";
import { t as n } from "./chevron-right-CRFNEcZT.ts";
import { t as r } from "./search-FHo0INnP.ts";
import { t as i } from "./scroll-area-I7hjn89T.ts";
import { t as a } from "./tooltip-BweQW627.ts";
import { t as o } from "./header-8InG5j3w.ts";
import { Fragment as s, forwardRef as c, useEffect as l, useId as u, useRef as d, useState as f } from "react";
import { Box as p, HStack as m, Icon as h, IconButton as g, Input as _, InputGroup as v, Menu as y, Portal as b, Stack as x, Text as S, Tooltip as C, chakra as w, useMenu as T, useMenuContext as ee, useRecipe as E } from "@chakra-ui/react";
import { Fragment as D, jsx as O, jsxs as k } from "react/jsx-runtime";
// packages/ui/src/components/overlays/resource-menu-items.tsx
var A = (t) => {
	let { action: r, onSelect: i } = t;
	return r.items && !r.isDisabled ? /* @__PURE__ */ k(y.Root, {
		positioning: {
			placement: "right-start",
			gutter: 2
		},
		closeOnSelect: !1,
		children: [/* @__PURE__ */ O(y.TriggerItem, {
			asChild: !0,
			children: /* @__PURE__ */ O(Z, {
				asChild: !0,
				variant: "full-width",
				label: r.label,
				icon: r.icon,
				endContent: /* @__PURE__ */ O(n, { size: 14 })
			})
		}), /* @__PURE__ */ O(M, {
			actions: r.items,
			onSelect: i
		})]
	}) : /* @__PURE__ */ O(y.Item, {
		value: r.key,
		disabled: r.isDisabled,
		closeOnSelect: r.closeOnSelect,
		onSelect: () => i(r),
		asChild: !0,
		children: /* @__PURE__ */ O(Z, {
			asChild: !0,
			variant: "full-width",
			label: r.label,
			icon: r.icon,
			endContent: r.isSelected ? /* @__PURE__ */ k(m, {
				gap: "xs",
				children: [r.endContent, /* @__PURE__ */ O(h, {
					as: e,
					boxSize: "3.5"
				})]
			}) : r.endContent,
			disabled: r.isDisabled
		})
	});
}, j = (e) => {
	let { actions: t, onSelect: n } = e, r = /* @__PURE__ */ new Map();
	for (let e of t) {
		let t = e.group?.id ?? "ungrouped", n = r.get(t) ?? {
			label: e.group?.label,
			actions: []
		};
		n.actions.push(e), r.set(t, n);
	}
	return [...r.entries()].map(([e, t], r) => /* @__PURE__ */ k(s, { children: [r > 0 ? /* @__PURE__ */ O(y.Separator, {}) : null, /* @__PURE__ */ k(y.ItemGroup, { children: [t.label ? /* @__PURE__ */ O(y.ItemGroupLabel, { children: t.label }) : null, t.actions.map((e, t) => /* @__PURE__ */ k(s, { children: [e.separatorBefore && t > 0 ? /* @__PURE__ */ O(y.Separator, {}) : null, /* @__PURE__ */ O(A, {
		action: e,
		onSelect: n
	})] }, e.key))] })] }, e));
}, M = (e) => /* @__PURE__ */ O(b, { children: /* @__PURE__ */ O(y.Positioner, { children: /* @__PURE__ */ O(y.Content, { children: /* @__PURE__ */ O(j, { ...e }) }) }) }), N = (e) => {
	let { actions: t, contentBackground: n, contentMinWidth: r, onSelect: a } = e, o = ee();
	return /* @__PURE__ */ O(b, { children: /* @__PURE__ */ O(y.Positioner, { children: /* @__PURE__ */ O(y.Content, {
		minW: r,
		bg: n,
		maxH: "var(--available-height)",
		children: /* @__PURE__ */ O(i, {
			flex: "1",
			minH: "0",
			viewportProps: {
				overscrollBehavior: "contain",
				tabIndex: -1
			},
			children: o.open ? /* @__PURE__ */ O(j, {
				actions: t,
				onSelect: a
			}) : null
		})
	}) }) });
}, P = (e) => {
	let t = d(null);
	return {
		onSelect: (n) => {
			n.onSelect?.(), n.closeOnSelect ?? e ?? !0 ? t.current = n : n.onClick?.();
		},
		onExitComplete: () => {
			let e = t.current;
			t.current = null, e?.onClick?.();
		}
	};
}, F = (e) => {
	let { actions: t, children: n, contentMinWidth: r = "17.5rem", contentBackground: i = "bg", positioning: a = { placement: "bottom-start" }, closeOnSelect: o } = e, { onSelect: s, onExitComplete: c } = P(o);
	return t.length === 0 ? n : /* @__PURE__ */ k(y.Root, {
		positioning: a,
		closeOnSelect: o,
		onExitComplete: c,
		children: [/* @__PURE__ */ O(y.Trigger, {
			asChild: !0,
			children: n
		}), /* @__PURE__ */ O(N, {
			actions: t,
			contentMinWidth: r,
			contentBackground: i,
			onSelect: s
		})]
	});
}, I = (e) => {
	let { actions: t, children: n, contentMinWidth: r = "17.5rem", contentBackground: i = "bg", positioning: a = { placement: "bottom-start" }, closeOnSelect: o, keepMountedWhenEmpty: s = !1 } = e, { onSelect: c, onExitComplete: l } = P(o), u = d(null), f = d({
		x: 0,
		y: 0,
		width: 0,
		height: 0
	}), p = T({
		positioning: {
			...a,
			strategy: "fixed",
			getAnchorRect: () => f.current
		},
		closeOnSelect: o,
		onEscapeKeyDown: () => {
			let e = u.current;
			u.current = null;
			let t = document.activeElement;
			e && requestAnimationFrame(() => {
				(document.activeElement === t || document.activeElement === document.body) && e.focus({ preventScroll: !0 });
			});
		}
	}), m = p.api.getContextTriggerProps();
	return t.length === 0 && !s ? /* @__PURE__ */ O(D, { children: n }) : /* @__PURE__ */ k(D, { children: [/* @__PURE__ */ O(w.div, {
		asChild: !0,
		...m,
		onPointerDown: (e) => {
			t.length !== 0 && e.pointerType !== "mouse" && (u.current = null, e.stopPropagation(), f.current = {
				x: e.clientX,
				y: e.clientY,
				width: 0,
				height: 0
			}, m.onPointerDown?.(e));
		},
		onKeyDown: (e) => {
			if (e.defaultPrevented || t.length === 0 || e.key !== "ContextMenu" && !(e.shiftKey && e.key === "F10")) return;
			e.preventDefault(), e.stopPropagation();
			let n = e.currentTarget.getBoundingClientRect();
			e.currentTarget.dispatchEvent(new MouseEvent("contextmenu", {
				bubbles: !0,
				cancelable: !0,
				clientX: n.left,
				clientY: n.bottom
			})), u.current = e.target;
		},
		onContextMenu: (e) => {
			u.current = null, t.length > 0 && !e.defaultPrevented && (f.current = {
				x: e.clientX,
				y: e.clientY,
				width: 0,
				height: 0
			}, e.stopPropagation(), m.onContextMenu?.(e));
		},
		children: n
	}), /* @__PURE__ */ O(y.RootProvider, {
		value: p,
		lazyMount: !0,
		unmountOnExit: !0,
		onExitComplete: l,
		children: t.length > 0 ? /* @__PURE__ */ O(N, {
			actions: t,
			contentMinWidth: r,
			contentBackground: i,
			onSelect: c
		}) : null
	})] });
}, te = (e) => {
	let { item: t } = e;
	return t.icon ? /* @__PURE__ */ O(p, {
		color: "fg.muted",
		flexShrink: 0,
		display: "inline-flex",
		children: typeof t.icon == "function" ? /* @__PURE__ */ O(h, {
			as: t.icon,
			boxSize: "14px"
		}) : t.icon
	}) : null;
}, L = (e) => {
	let { children: t, items: n, onOpenChange: r, onSelect: i, open: a, placement: o = "right-start", triggerId: c } = e, l = d(null);
	return /* @__PURE__ */ k(y.Root, {
		ids: { trigger: c },
		open: a,
		positioning: {
			placement: o,
			offset: { mainAxis: 4 }
		},
		onOpenChange: (e) => r(e.open),
		onExitComplete: () => {
			let e = l.current;
			l.current = null, e?.onClick?.();
		},
		children: [/* @__PURE__ */ O(y.Trigger, {
			asChild: !0,
			children: t
		}), /* @__PURE__ */ O(b, { children: /* @__PURE__ */ O(y.Positioner, { children: /* @__PURE__ */ O(y.Content, {
			minW: "200px",
			bg: "bg",
			children: n.some((e) => e.group) ? /* @__PURE__ */ O(j, {
				actions: n.map((e) => ({
					key: e.id,
					label: e.label,
					group: e.group,
					icon: typeof e.icon == "function" ? /* @__PURE__ */ O(h, {
						as: e.icon,
						boxSize: "4"
					}) : e.icon,
					endContent: e.endContent,
					isDisabled: e.disabled || e.readOnly,
					separatorBefore: e.separatorBefore,
					onClick: () => i(e)
				})),
				onSelect: (e) => {
					l.current = e;
				}
			}) : n.map((e) => /* @__PURE__ */ k(s, { children: [e.separatorBefore ? /* @__PURE__ */ O(y.Separator, {}) : null, /* @__PURE__ */ O(y.Item, {
				value: e.id,
				disabled: e.disabled || e.readOnly,
				_disabled: e.readOnly ? {
					opacity: 1,
					cursor: "default"
				} : void 0,
				onClick: () => {
					e.readOnly || i(e);
				},
				children: /* @__PURE__ */ k(m, {
					gap: "2",
					minW: "0",
					w: "full",
					justify: "space-between",
					alignItems: "center",
					children: [/* @__PURE__ */ k(m, {
						gap: "2",
						minW: "0",
						flex: "1",
						alignItems: e.description ? "flex-start" : "center",
						children: [/* @__PURE__ */ O(te, { item: e }), /* @__PURE__ */ k(x, {
							gap: "0",
							minW: "0",
							children: [/* @__PURE__ */ O(S, {
								textStyle: "label/S/regular",
								truncate: !0,
								children: e.label
							}), e.description ? /* @__PURE__ */ O(S, {
								textStyle: "label/XS",
								color: "fg.menu-item.secondary",
								truncate: !0,
								children: e.description
							}) : null]
						})]
					}), e.endContent ? /* @__PURE__ */ O(p, {
						flexShrink: 0,
						children: e.endContent
					}) : null]
				})
			})] }, e.id))
		}) }) })]
	});
}, R = (e) => e.map((e) => ({
	key: e.id,
	label: e.label,
	commandId: e.commandId,
	group: e.group,
	icon: typeof e.icon == "function" ? /* @__PURE__ */ O(h, {
		as: e.icon,
		boxSize: "16px"
	}) : e.icon,
	endContent: e.endContent,
	isDisabled: e.disabled,
	separatorBefore: e.separatorBefore,
	onClick: () => e.onAction?.()
})), z = (e) => {
	let { children: t, item: n, menuOpen: r, onMenuOpenChange: i, onMenuSelect: a } = e, o = u();
	if (n.menuItems && n.menuItems.length > 0) return /* @__PURE__ */ O(L, {
		triggerId: n.id,
		items: n.menuItems,
		open: r,
		placement: n.menuPlacement,
		onOpenChange: i,
		onSelect: a,
		children: t
	});
	let s = t.props.id ?? o, c = n.tooltip ? /* @__PURE__ */ O(C.Trigger, {
		asChild: !0,
		id: s,
		children: t
	}) : t, l = n.contextMenuItems && n.contextMenuItems.length > 0 ? /* @__PURE__ */ O(I, {
		actions: R(n.contextMenuItems),
		children: c
	}) : c;
	return n.tooltip ? /* @__PURE__ */ k(C.Root, {
		openDelay: 380,
		closeDelay: 100,
		ids: { trigger: s },
		children: [l, /* @__PURE__ */ O(b, { children: /* @__PURE__ */ O(C.Positioner, { children: /* @__PURE__ */ O(C.Content, { children: n.tooltip }) }) })]
	}) : l;
}, B = (e) => {
	e.button === 0 && (e.preventDefault(), e.target instanceof Element && e.target.closest("button, [role=button]")?.focus());
}, ne = (e) => {
	let { inputRef: t, value: n, placeholder: i, onValueChange: a, onKeyDown: s } = e;
	return /* @__PURE__ */ O(o, {
		variant: "input",
		borderBottomWidth: "1px",
		borderColor: "border.subtle",
		flexShrink: 0,
		children: /* @__PURE__ */ O(v, {
			startElement: /* @__PURE__ */ O(r, { size: 14 }),
			width: "full",
			children: /* @__PURE__ */ O(_, {
				ref: t,
				mx: "xs",
				variant: "borderless",
				value: n,
				placeholder: i,
				"aria-label": i,
				autoComplete: "off",
				onChange: (e) => a(e.target.value),
				onKeyDown: (e) => {
					s?.(e), s && e.key === "Escape" || e.stopPropagation();
				}
			})
		})
	});
}, re = (t) => {
	let { item: n, multiple: r } = t, i = n.variant === "compact" ? "3" : "3.5", a = r ? /* @__PURE__ */ k(m, {
		gap: "xs",
		children: [n.secondaryLabel, n.isSelected ? /* @__PURE__ */ O(h, {
			as: e,
			boxSize: "3.5"
		}) : null]
	}) : void 0;
	!r && n.isSelected && (a = /* @__PURE__ */ O(h, {
		as: e,
		boxSize: "3.5"
	}));
	let o = /* @__PURE__ */ O(p, {
		bg: "transparent",
		h: "auto",
		p: "0",
		_hover: { bg: "transparent" },
		_focus: { bg: "transparent" },
		_active: { bg: "transparent" },
		children: /* @__PURE__ */ O(Z, {
			asChild: !0,
			id: n.id,
			role: "presentation",
			variant: n.variant ?? "full-width",
			disabled: n.isDisabled,
			tooltip: n.tooltipLabel,
			description: r ? void 0 : n.secondaryLabel,
			label: r ? /* @__PURE__ */ k(m, {
				minW: "0",
				gap: "xs",
				children: [n.icon ? /* @__PURE__ */ O(h, {
					as: n.icon,
					boxSize: i,
					color: n.iconColor ?? "fg.muted"
				}) : null, /* @__PURE__ */ O(S, {
					textStyle: "label/S/regular",
					truncate: !0,
					children: n.label
				})]
			}) : n.label,
			icon: !r && n.icon ? /* @__PURE__ */ O(h, {
				as: n.icon,
				boxSize: i,
				color: n.iconColor ?? "fg.muted"
			}) : void 0,
			endContent: a
		})
	});
	return r ? /* @__PURE__ */ O(y.CheckboxItem, {
		value: n.id,
		checked: !!n.isSelected,
		disabled: n.isDisabled,
		onCheckedChange: n.onSelect,
		asChild: !0,
		children: o
	}) : /* @__PURE__ */ O(y.Item, {
		value: n.id,
		disabled: n.isDisabled,
		onSelect: n.onSelect,
		asChild: !0,
		children: o
	});
}, ie = (e, t) => {
	let n = t.trim().toLowerCase();
	return n ? e.filter((e) => [e.label, e.searchText].filter(Boolean).join(" ").toLowerCase().includes(n)) : e;
}, ae = (e, t) => !e || !t ? !1 : e !== t, oe = (e, t, n) => !e || !t ? n : {
	items: t.items,
	filterItems: t.filterItems ?? n.filterItems,
	showSearch: t.showSearch ?? n.showSearch,
	searchPlaceholder: t.searchPlaceholder ?? n.searchPlaceholder,
	emptyState: t.emptyState ?? n.emptyState,
	contentTestId: t.contentTestId ?? n.contentTestId,
	closeOnSelect: !1,
	listId: "parent"
}, V = (e) => {
	let { trigger: n, items: r, searchPlaceholder: a, emptyState: s, filterItems: c = ie, listId: u, header: p, width: m = "260px", maxListHeight: g = "18rem", showSearch: _ = !0, closeOnSelect: v = !0, lazyMount: x = !1, open: S, positioning: C, onOpenChange: w, onFocusOutside: T, contentTestId: ee, portalled: E = !0, portalContainer: D, parentList: A, multiple: j = !1 } = e, M = !!A, [N, P] = f(!1), [F, I] = f(""), [te, L] = f("child"), R = d(null), z = S ?? N, B = M && te === "parent", V = oe(B, A, {
		items: r,
		filterItems: c,
		showSearch: _,
		searchPlaceholder: a,
		emptyState: s,
		contentTestId: ee,
		closeOnSelect: v,
		listId: M ? "child" : u ?? ""
	}), H = V.filterItems(V.items, F), U = d(V.listId);
	l(() => {
		z && ae(U.current, V.listId) && I(""), U.current = V.listId;
	}, [z, V.listId]), l(() => {
		if (!z || !V.showSearch) return;
		let e = setTimeout(() => R.current?.focus(), 0);
		return () => clearTimeout(e);
	}, [z, V.showSearch]);
	let se = (e) => {
		S === void 0 && P(e.open), I(""), e.open && M && L("child"), w?.(e);
	}, W = (e) => {
		if (!B || !A) return;
		let t = A.items.find((t) => t.id === e.value);
		t && (A.onSelect?.(t), L("child"));
	}, G = A ? /* @__PURE__ */ O(o, {
		as: "div",
		role: "menuitem",
		"aria-label": A.ariaLabel,
		"aria-disabled": A.disabled || void 0,
		tabIndex: A.disabled ? -1 : 0,
		variant: "narrow",
		px: "0",
		borderBottomWidth: "1px",
		borderColor: "border.subtle",
		flexShrink: 0,
		onPointerDownCapture: (e) => e.stopPropagation(),
		onClickCapture: (e) => {
			e.stopPropagation(), !A.disabled && L((e) => e === "child" ? "parent" : "child");
		},
		children: /* @__PURE__ */ O(Z, {
			asChild: !0,
			role: "presentation",
			variant: "full-width",
			id: "__parent-toggle",
			label: A.selectedLabel,
			icon: A.selectedIcon ? /* @__PURE__ */ O(h, {
				as: A.selectedIcon,
				boxSize: "14px"
			}) : void 0,
			disabled: A.disabled,
			endContent: A.disabled ? void 0 : /* @__PURE__ */ O(h, {
				as: t,
				boxSize: "14px"
			})
		})
	}) : null, K = A ? G : p, q = !!K && !V.showSearch, ce = V.showSearch ? /* @__PURE__ */ O(ne, {
		inputRef: R,
		value: F,
		placeholder: V.searchPlaceholder,
		onValueChange: I
	}) : null, J = /* @__PURE__ */ O(y.Positioner, { children: /* @__PURE__ */ k(y.Content, {
		w: m,
		bg: "bg",
		gap: "0",
		p: "0",
		children: [
			K,
			ce,
			q ? /* @__PURE__ */ O(y.Separator, { margin: "0" }) : null,
			/* @__PURE__ */ O(i, {
				maxH: g,
				"data-testid": V.contentTestId,
				viewportProps: { overscrollBehavior: "contain" },
				p: "0",
				gap: "0",
				children: H.length > 0 ? H.map((e) => /* @__PURE__ */ O(re, {
					item: e,
					multiple: j && !B
				}, e.id)) : V.emptyState
			})
		]
	}) });
	return /* @__PURE__ */ k(y.Root, {
		lazyMount: x,
		closeOnSelect: V.closeOnSelect,
		open: S,
		positioning: C,
		onOpenChange: se,
		onFocusOutside: T,
		onSelect: M ? W : void 0,
		children: [/* @__PURE__ */ O(y.Trigger, {
			asChild: !0,
			children: n
		}), /* @__PURE__ */ O(b, {
			disabled: !E,
			container: D,
			children: J
		})]
	});
}, H = (e) => {
	let { action: t } = e, n = (t.menuItems ?? []).map((e) => ({
		id: e.id,
		label: e.label,
		searchText: [e.label, e.description].filter(Boolean).join(" "),
		tooltipLabel: e.description,
		variant: "full-width",
		isDisabled: e.disabled || e.readOnly,
		onSelect: () => e.onAction?.()
	}));
	return /* @__PURE__ */ O(V, {
		trigger: /* @__PURE__ */ O(g, {
			variant: "ghost",
			size: "2xs",
			"aria-label": t.label,
			disabled: t.disabled,
			children: t.icon
		}),
		items: n,
		searchPlaceholder: t.searchPlaceholder ?? "Search...",
		emptyState: /* @__PURE__ */ O(y.Item, {
			value: "empty",
			asChild: !0,
			children: /* @__PURE__ */ O(Z, {
				asChild: !0,
				variant: "full-width",
				label: t.emptyMenuLabel ?? "No results found",
				disabled: !0
			})
		}),
		onFocusOutside: (e) => e.preventDefault()
	});
}, U = (e, t) => e.tooltip ? /* @__PURE__ */ O(a, {
	content: e.tooltip,
	children: t
}, e.id) : /* @__PURE__ */ O(s, { children: t }, e.id), se = (e) => {
	let { actions: t, alwaysVisible: n = !1, context: r } = e, i = E({ key: "listRowAccessory" });
	return t.length === 0 ? null : /* @__PURE__ */ O(m, {
		gap: "0",
		css: i({ visibility: n ? "always" : "hover" }),
		onClick: (e) => e.stopPropagation(),
		onPointerDown: (e) => e.stopPropagation(),
		onMouseDown: B,
		onKeyDown: (e) => e.stopPropagation(),
		children: t.map((e) => e.menuItems && e.menuItems.length >= 8 ? /* @__PURE__ */ O(H, { action: e }, e.id) : e.menuItems && e.menuItems.length > 0 ? U(e, /* @__PURE__ */ k(y.Root, { children: [/* @__PURE__ */ O(y.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ O(g, {
				variant: "ghost",
				size: "2xs",
				"aria-label": e.label,
				disabled: e.disabled,
				children: e.icon
			})
		}), /* @__PURE__ */ O(b, { children: /* @__PURE__ */ O(y.Positioner, { children: /* @__PURE__ */ O(y.Content, {
			minW: "160px",
			bg: "bg",
			children: e.menuItems.map((e) => /* @__PURE__ */ k(s, { children: [e.separatorBefore ? /* @__PURE__ */ O(y.Separator, {}) : null, /* @__PURE__ */ O(a, {
				content: e.description,
				disabled: !e.description,
				children: /* @__PURE__ */ O(y.Item, {
					value: e.id,
					disabled: e.disabled || e.readOnly,
					onClick: () => {
						e.readOnly || e.onAction?.();
					},
					children: /* @__PURE__ */ k(m, {
						gap: "2",
						minW: "0",
						w: "full",
						justify: "space-between",
						children: [/* @__PURE__ */ k(m, {
							gap: "2",
							minW: "0",
							children: [e.icon ? /* @__PURE__ */ O(p, { children: e.icon }) : null, /* @__PURE__ */ O(p, {
								minW: "0",
								children: e.label
							})]
						}), e.endContent ? /* @__PURE__ */ O(p, {
							flexShrink: 0,
							children: e.endContent
						}) : null]
					})
				})
			})] }, e.id))
		}) }) })] })) : U(e, /* @__PURE__ */ O(g, {
			variant: "ghost",
			size: "2xs",
			"aria-label": e.label,
			disabled: e.disabled,
			"aria-pressed": e.pressed,
			onClick: (t) => {
				t.stopPropagation(), e.onAction?.(r);
			},
			children: e.icon
		})))
	});
}, W = (e, n = !1) => {
	let r = e.contextMenuItems ?? [];
	if (r.length === 0 || !n) return e.actions ?? [];
	let i = e.actions?.flatMap((t) => t.menuItems?.length ? t.menuItems.map((e) => ({
		...e,
		disabled: t.disabled || e.disabled
	})) : [{
		id: t.id,
		label: t.label,
		icon: t.icon,
		disabled: t.disabled,
		onAction: () => t.onAction?.({ nodeId: e.id })
	}]) ?? [], a = new Set(i.map((e) => e.id)), o = r.filter((e) => !a.has(e.id)).map((e, t) => ({
		...e,
		separatorBefore: e.separatorBefore || t === 0 && i.length > 0
	}));
	return [{
		id: "resource-actions",
		label: "Resource actions",
		icon: /* @__PURE__ */ O(h, {
			as: t,
			boxSize: "14px"
		}),
		menuItems: [...i, ...o]
	}];
}, G = {
	collection: "compact",
	tree: "1"
}, K = /* @__PURE__ */ new Set([
	"compact",
	"collection",
	"full-width",
	"tree",
	"empty-state"
]), q = (e) => e.isEmptyStateVariant ? "fg.menu-item.secondary" : e.isDisabled ? "fg.muted" : e.tone === "danger" ? "red.500" : "fg", ce = (e) => {
	let { label: t, textStyle: n, color: r, labelId: i } = e;
	return typeof t == "string" ? /* @__PURE__ */ O(S, {
		id: i,
		textStyle: n,
		color: r,
		truncate: !0,
		children: t
	}) : /* @__PURE__ */ O(p, {
		id: i,
		minW: "0",
		maxW: "full",
		overflow: "hidden",
		color: r,
		children: t
	});
}, J = (e) => {
	let { id: t, description: n, textStyle: r, color: i, marginLeft: a } = e;
	return n ? typeof n == "string" ? /* @__PURE__ */ O(S, {
		id: t,
		ml: a,
		textStyle: r,
		color: i,
		truncate: !0,
		children: n
	}) : /* @__PURE__ */ O(p, {
		id: t,
		ml: a,
		minW: "0",
		maxW: "full",
		overflow: "hidden",
		children: n
	}) : null;
}, le = (e) => {
	let { isExpanded: t, isDisabled: r, showChevron: i, onToggleExpand: a } = e, o = E({ key: "treeChevron" });
	return /* @__PURE__ */ k(D, { children: [i && a ? /* @__PURE__ */ O(g, {
		"aria-label": t ? "Collapse group" : "Expand group",
		"aria-expanded": t,
		variant: "ghost",
		size: "2xs",
		disabled: r,
		onClick: (e) => {
			e.stopPropagation(), a();
		},
		onMouseDown: B,
		onKeyDown: (e) => e.stopPropagation(),
		children: /* @__PURE__ */ O(h, {
			as: n,
			boxSize: "12px",
			css: o(),
			"data-open": t
		})
	}) : null, i && !a ? /* @__PURE__ */ O(p, {
		color: "fg.muted",
		flexShrink: 0,
		display: "flex",
		alignItems: "center",
		children: /* @__PURE__ */ O(h, {
			as: n,
			boxSize: "12px",
			css: o(),
			"data-open": t
		})
	}) : null] });
}, Y = (e) => {
	let { item: t, isExpanded: n, showChevron: r, isDisabled: i, variant: o, tone: s, labelId: c, onToggleExpand: l } = e, u = o === "empty-state", d = K.has(o ?? ""), f = d ? "label/S/regular" : "label/M/regular", h = d ? "label/XS" : "label/S/regular", g = d ? "0" : "2px", _ = o === "tree" || o === "collection" ? "16px" : "14px", v = G[o ?? ""] ?? "2", y = q({
		isEmptyStateVariant: u,
		isDisabled: i,
		tone: s
	}), b = t.iconColor ?? (s === "danger" ? "red.500" : "fg.muted"), S = s === "danger" ? "red.400" : "fg.menu-item.secondary";
	return /* @__PURE__ */ k(m, {
		gap: "2",
		minW: "0",
		flex: "1",
		overflow: "hidden",
		alignItems: "center",
		children: [
			/* @__PURE__ */ O(le, {
				showChevron: r,
				isExpanded: n,
				isDisabled: i,
				onToggleExpand: l
			}),
			t.startContent ? /* @__PURE__ */ O(p, {
				flexShrink: 0,
				display: "flex",
				alignItems: "center",
				children: t.startContent
			}) : null,
			/* @__PURE__ */ k(x, {
				gap: "0",
				minW: "0",
				flex: "1",
				children: [/* @__PURE__ */ k(m, {
					gap: v,
					minW: "0",
					alignItems: "center",
					children: [
						t.icon ? /* @__PURE__ */ O(p, {
							color: b,
							flexShrink: 0,
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							boxSize: _,
							fontSize: _,
							lineHeight: "1",
							css: { "& > svg": {
								width: _,
								height: _
							} },
							children: t.icon
						}) : null,
						t.indicator ? /* @__PURE__ */ O(a, {
							content: t.indicator.tooltip,
							disabled: !t.indicator.tooltip,
							children: /* @__PURE__ */ O(p, {
								color: t.indicator.color ?? "fg.muted",
								flexShrink: 0,
								children: t.indicator.icon
							})
						}) : null,
						/* @__PURE__ */ O(ce, {
							labelId: c,
							label: t.label,
							textStyle: f,
							color: y
						})
					]
				}), /* @__PURE__ */ O(J, {
					id: `${c}-description`,
					description: t.description,
					textStyle: h,
					color: S,
					marginLeft: g
				})]
			})
		]
	});
}, ue = (e) => {
	let { labelId: t, item: n, isDisabled: r, isExpanded: i, showChevron: a, tone: o = "default", variant: s = "default", showContextMenuTrigger: c, onToggleExpand: l } = e, u = W(n, c);
	return /* @__PURE__ */ k(D, { children: [
		/* @__PURE__ */ O(Y, {
			labelId: t,
			item: n,
			isExpanded: i,
			showChevron: a,
			isDisabled: r,
			tone: o,
			variant: s,
			onToggleExpand: l
		}),
		n.endContent ? /* @__PURE__ */ O(p, {
			id: `${t}-end`,
			color: "fg.muted",
			flexShrink: 0,
			display: "flex",
			alignItems: "center",
			children: n.endContent
		}) : null,
		u.length > 0 ? /* @__PURE__ */ O(se, {
			actions: u,
			context: { nodeId: n.id },
			alwaysVisible: n.actionsVisibility === "always" || c && (n.contextMenuItems?.length ?? 0) > 0
		}) : null
	] });
}, de = (e) => {
	if (!(e <= 0)) return `calc(var(--chakra-spacing-1) + ${e} * 12px)`;
}, X = (e) => e === "compact" || e === "full-width" || e === "empty-state", fe = (e, t) => e === "collection" && !t ? {
	rowHeight: "collection-row",
	minHeight: void 0
} : X(e) && !t ? {
	rowHeight: "1.75rem",
	minHeight: void 0
} : {
	rowHeight: "auto",
	minHeight: e === "default" ? "2.25rem" : "1.75rem"
}, pe = (e) => ({
	bg: e.isSelected ? e.selectedBg : "transparent",
	_hover: e.variant === "empty-state" ? { bg: "transparent" } : e.isSelected ? { bg: e.selectedBg } : e.tone === "danger" ? {
		outline: "1px solid",
		outlineColor: "red.500",
		outlineOffset: "-1px"
	} : { bg: e.hoverBg },
	_active: e.variant === "empty-state" ? { bg: "transparent" } : { bg: e.selectedBg }
}), me = (e, t) => t ? `${e} ${e}-end` : e, he = (e) => {
	let t = e.isDisabled ? "not-allowed" : "pointer";
	return {
		"aria-labelledby": e.rootProps["aria-label"] ? void 0 : me(e.labelId, e.hasEndContent),
		"aria-describedby": e.hasDescription ? `${e.labelId}-description` : void 0,
		...e.rootProps,
		role: e.rowRole,
		"aria-selected": e.rootProps["aria-selected"] ?? (e.rowRole === "option" ? e.isSelected : void 0),
		"aria-expanded": e.showChevron ? e.isExpanded : void 0,
		className: e.className ? `group ${e.className}` : "group",
		width: "full",
		minWidth: "0",
		maxWidth: "full",
		height: e.rowHeight,
		minHeight: e.minHeight,
		display: "flex",
		position: "relative",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "xs",
		px: "sm",
		py: e.verticalPadding,
		pl: e.paddingLeft,
		borderRadius: e.variant === "full-width" || e.variant === "collection" ? "0" : "xs",
		...e.rowRole?.startsWith("menuitem") ? {} : pe(e),
		cursor: e.variant === "empty-state" ? "default" : t,
		overflow: "hidden",
		textAlign: "left",
		color: "inherit",
		textDecoration: "none"
	};
}, Z = c((e, t) => {
	let { id: n, label: r, description: i, icon: a, iconColor: o, indicator: s, endContent: c, startContent: l, actionsVisibility: d, tooltip: p, disabled: m, isContainer: h, isNavigable: g, href: _, navigationIntent: v, menuItems: y, menuPlacement: b, contextMenuItems: x, actions: S, children: C, onActivate: T, depth: ee = 0, isSelected: E = !1, isExpanded: D = !1, showExpandToggle: k = !1, expandOnClick: A = !0, showContextMenuTrigger: j = !1, variant: M = "default", tone: N = "default", selectedBg: P = "bg.active", hoverBg: F = "bg.hover", asChild: I = !1, className: te, role: L, onToggleExpand: R, onPointerMove: B, draggable: ne, onDragStart: re, onDragOver: ie, onDragEnd: ae, onDrop: oe, onClick: V, onKeyDown: H, ...U } = e, [se, W] = f(!1), G = u(), K = {
		id: n,
		label: r,
		description: i,
		icon: a,
		iconColor: o,
		indicator: s,
		endContent: c,
		startContent: l,
		actionsVisibility: d,
		tooltip: p,
		disabled: m,
		isContainer: h,
		isNavigable: g,
		href: _,
		navigationIntent: v,
		menuItems: y,
		menuPlacement: b,
		contextMenuItems: x,
		actions: S,
		children: C,
		onActivate: T
	}, q = {
		draggable: ne,
		onDragStart: re,
		onDragOver: ie,
		onDragEnd: ae,
		onDrop: oe
	}, ce = (K.children?.length ?? 0) > 0 || K.isContainer === !0, J = (K.menuItems?.length ?? 0) > 0, le = (K.actions?.length ?? 0) > 0 || (K.contextMenuItems?.length ?? 0) > 0, Y = k && ce, X = K.disabled === !0, pe = () => {
		X || J || (Y && A ? R?.() : T?.());
	}, me = (e) => {
		V?.(e), !e.defaultPrevented && (X ? e.preventDefault() : J ? W((e) => !e) : pe());
	}, Z = (e) => {
		H?.(e), e.defaultPrevented || e.target !== e.currentTarget || e.key !== "Enter" && e.key !== " " || (e.preventDefault(), !X && (J ? W((e) => !e) : pe()));
	}, ge = K.description !== void 0, _e = de(ee), ve = M === "default" || ge ? "xs" : "2xs", ye = { onClick: me }, { rowHeight: be, minHeight: xe } = fe(M, ge), Se = L ?? (J ? "button" : "option"), Q = he({
		rootProps: {
			...U,
			id: n
		},
		labelId: G,
		hasDescription: ge,
		hasEndContent: !!K.endContent,
		rowRole: Se,
		className: te,
		isSelected: E,
		isExpanded: D,
		showChevron: Y,
		rowHeight: be,
		minHeight: xe,
		verticalPadding: ve,
		paddingLeft: _e,
		selectedBg: P,
		hoverBg: F,
		tone: N,
		isDisabled: X,
		variant: M
	}), $ = /* @__PURE__ */ O(ue, {
		labelId: G,
		item: K,
		isExpanded: D,
		showChevron: Y,
		isDisabled: X,
		tone: N,
		variant: M,
		showContextMenuTrigger: j,
		onToggleExpand: A ? void 0 : R
	}), Ce = (e) => /* @__PURE__ */ O(z, {
		item: K,
		menuOpen: se,
		onMenuOpenChange: W,
		onMenuSelect: (e) => {
			W(!1), e.onAction?.();
		},
		children: e
	});
	return I ? Ce(/* @__PURE__ */ O(w.div, {
		ref: t,
		...Q,
		...q,
		...ye,
		onKeyDown: H,
		onPointerMove: B,
		children: $
	})) : K.href && !Y && !X && !J ? Ce(/* @__PURE__ */ O(w.a, {
		ref: t,
		href: K.href,
		...Q,
		...q,
		onClick: me,
		onKeyDown: H,
		onPointerMove: B,
		children: $
	})) : Ce(le || Y && !A ? /* @__PURE__ */ O(w.div, {
		ref: t,
		"aria-disabled": X || void 0,
		...Q,
		...q,
		...ye,
		tabIndex: U.tabIndex ?? 0,
		onKeyDown: Z,
		onPointerMove: B,
		children: $
	}) : /* @__PURE__ */ O(w.button, {
		ref: t,
		type: "button",
		disabled: X,
		...Q,
		...q,
		...ye,
		onKeyDown: H,
		onPointerMove: B,
		children: $
	}));
});
export { ne as a, I as c, ie as i, H as n, R as o, V as r, F as s, Z as t };
