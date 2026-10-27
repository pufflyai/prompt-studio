// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { _ as e, g as t, h as n } from "./lucide-react-DrMf1u5h.ts";
import { t as r } from "./check-Bgh538vW.ts";
import { t as i } from "./chevron-right-CRFNEcZT.ts";
import { t as a } from "./minus-BdT0RA0-.ts";
import { t as o } from "./pencil-DsB6zW8x.ts";
import { t as s } from "./plus-CYkLGSPS.ts";
import { t as c } from "./settings-2-CNFOcldp.ts";
import { t as l } from "./trash-2-C03vrbuo.ts";
import { t as u } from "./x-DqEAa6-d.ts";
import { h as d, l as f, n as p, o as m, r as h, s as g, t as _, u as v } from "./data-table-state-BSAfS2dI.ts";
import { t as y } from "./scroll-area-I7hjn89T.ts";
import { i as b } from "./collection-view-fields-D15M65ck.ts";
import { t as x } from "./checkbox-C3JJ0TWQ.ts";
import { c as S, t as C } from "./list-row-BhxGCvIh.ts";
import { n as w, t as T } from "./number-input-BAmIOgl0.ts";
import { n as E } from "./collection-view-filter-C1-8HUTj.ts";
import { n as D, r as O, t as k } from "./collection-view-bar-DZiXTxjX.ts";
import { t as A } from "./switch-CVOnzlSE.ts";
import { n as ee } from "./highlighted-text-CaWxQuWj.ts";
import { i as j, r as M } from "./collection-view-grouping-B8HGb2BH.ts";
import { t as N } from "./collection-page-Kq8b-Cu2.ts";
import { useDeferredValue as P, useEffect as F, useRef as I, useState as L } from "react";
import { Box as R, Button as z, Flex as B, Icon as V, IconButton as H, Menu as U, Popover as W, Portal as G, Spinner as K, Stack as q, Table as J, Text as Y, chakra as te } from "@chakra-ui/react";
import { jsx as X, jsxs as Z } from "react/jsx-runtime";
import { DEFAULT_DATA_TABLE_SETTINGS as Q } from "@pstdio/sdk/extensions";
// packages/ui/src/components/data-table/data-table-header.tsx
var $ = (e) => [], ne = (e) => {
	let { view: t, viewsSource: n, displayControl: r, actions: i } = e, a = t.deferredSearch.trim() !== "";
	return /* @__PURE__ */ X(k, {
		itemLabel: e.itemLabel,
		storageKey: t.storageKey,
		initialState: t.initialState,
		views: t.views.views,
		viewsSource: n,
		fields: t.attributes,
		optionsFor: $,
		search: t.search,
		onSearchChange: t.setSearch,
		searchResultLabel: a ? `${t.shownCount} of ${t.totalCount}` : void 0,
		displayControl: r,
		actions: i
	});
}, re = (e) => {
	let { showDivider: t = !1, wrapRows: n, onWrapRowsChange: r } = e;
	return /* @__PURE__ */ X(R, {
		borderBottomWidth: t ? "1px" : void 0,
		borderColor: "border.subtle",
		padding: "xs",
		children: /* @__PURE__ */ X(A, {
			checked: n,
			inputProps: { role: "switch" },
			width: "full",
			flexDirection: "row-reverse",
			justifyContent: "space-between",
			onCheckedChange: (e) => r(e.checked === !0),
			children: /* @__PURE__ */ X(Y, {
				as: "span",
				textStyle: "label/S/regular",
				children: "Wrap rows"
			})
		})
	});
}, ie = (e) => {
	let { compact: t = !1, wrapRows: n, onWrapRowsChange: r } = e, i = /* @__PURE__ */ X(W.Positioner, { children: /* @__PURE__ */ X(W.Content, {
		width: "min(240px, calc(100vw - 32px))",
		p: "0",
		bg: "bg",
		overflow: "hidden",
		children: /* @__PURE__ */ X(re, {
			wrapRows: n,
			onWrapRowsChange: r
		})
	}) });
	return /* @__PURE__ */ Z(W.Root, {
		positioning: {
			placement: t ? "bottom-start" : "bottom-end",
			offset: { mainAxis: 8 }
		},
		children: [/* @__PURE__ */ X(W.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ X(H, {
				"aria-label": "Display settings",
				variant: "ghost",
				size: t ? "2xs" : "sm",
				children: /* @__PURE__ */ X(V, {
					as: c,
					boxSize: "14px"
				})
			})
		}), /* @__PURE__ */ X(G, { children: i })]
	});
}, ae = (e) => {
	let { cancelLabel: t, saveLabel: n, onCancel: i, onSave: a } = e;
	return /* @__PURE__ */ Z(B, {
		gap: "2xs",
		flexShrink: "0",
		children: [/* @__PURE__ */ X(H, {
			type: "button",
			size: "2xs",
			variant: "ghost",
			"aria-label": n,
			onClick: a,
			children: /* @__PURE__ */ X(r, {})
		}), /* @__PURE__ */ X(H, {
			type: "button",
			size: "2xs",
			variant: "ghost",
			"aria-label": t,
			onClick: i,
			children: /* @__PURE__ */ X(u, {})
		})]
	});
}, oe = (e) => {
	let { accessibleName: t, textStyle: n, value: r, onCancel: i, onChange: a, onSave: o } = e, s = I(null), c = I(r);
	return F(() => {
		let e = s.current;
		if (!e) return;
		e.textContent = c.current, e.focus();
		let t = globalThis.getSelection(), n = document.createRange();
		n.selectNodeContents(e), t?.removeAllRanges(), t?.addRange(n);
	}, []), /* @__PURE__ */ X(te.div, {
		ref: s,
		role: "textbox",
		"aria-label": t,
		contentEditable: !0,
		suppressContentEditableWarning: !0,
		height: "10",
		width: "100%",
		paddingX: "xs",
		paddingY: "xs",
		overflow: "hidden",
		background: "transparent",
		border: "none",
		borderRadius: "0",
		outline: "none",
		textStyle: n,
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		onInput: (e) => a(e.currentTarget.textContent ?? ""),
		onKeyDown: (e) => {
			e.key === "Enter" && (e.preventDefault(), o()), e.key === "Escape" && i();
		}
	});
}, se = (e) => {
	let { accessibleName: t, draft: n, onCancel: r, onChange: i, onSave: a } = e;
	return /* @__PURE__ */ Z(R, {
		position: "absolute",
		inset: "0",
		width: "100%",
		height: "10",
		background: "bg.subtle",
		zIndex: "1",
		children: [/* @__PURE__ */ X(oe, {
			accessibleName: `Rename column ${t}`,
			textStyle: "label/S/medium",
			value: n,
			onChange: i,
			onSave: a,
			onCancel: r
		}), /* @__PURE__ */ X(R, {
			position: "absolute",
			top: "50%",
			right: "2xs",
			transform: "translateY(-50%)",
			background: "bg.subtle",
			children: /* @__PURE__ */ X(ae, {
				saveLabel: "Save column name",
				cancelLabel: "Cancel column rename",
				onSave: a,
				onCancel: r
			})
		})]
	});
}, ce = (e) => {
	let { anchorRef: t, customEditor: n, draft: r, onCancel: i, onChange: a, onSave: o } = e;
	return /* @__PURE__ */ X(W.Root, {
		open: !0,
		closeOnInteractOutside: !1,
		positioning: {
			placement: "bottom-start",
			offset: { mainAxis: -40 },
			getAnchorElement: () => t.current
		},
		children: /* @__PURE__ */ X(G, { children: /* @__PURE__ */ X(W.Positioner, { children: /* @__PURE__ */ Z(W.Content, {
			"data-table-cell-editor": !0,
			width: "calc(var(--reference-width) + 3rem)",
			minWidth: "calc(var(--reference-width) + 3rem)",
			maxWidth: "calc(100vw - 2rem)",
			padding: "0",
			overflow: "hidden",
			background: "bg",
			animation: "none",
			zIndex: "popover",
			children: [/* @__PURE__ */ X(y, {
				"data-table-cell-editor-body": !0,
				width: "100%",
				minHeight: "10",
				maxHeight: "48",
				contentProps: { minHeight: "10" },
				viewportProps: {
					maxHeight: "48",
					overscrollBehavior: "contain"
				},
				children: n ?? /* @__PURE__ */ X(oe, {
					accessibleName: "Edit cell",
					textStyle: "paragraph/S/regular",
					value: r,
					onChange: a,
					onSave: o,
					onCancel: i
				})
			}), /* @__PURE__ */ X(B, {
				"data-table-cell-editor-footer": !0,
				height: "8",
				flexShrink: "0",
				alignItems: "center",
				justifyContent: "flex-end",
				paddingX: "xs",
				borderTopWidth: "1px",
				borderColor: "border.subtle",
				background: "bg.subtle",
				children: /* @__PURE__ */ X(ae, {
					saveLabel: "Save cell",
					cancelLabel: "Cancel cell edit",
					onSave: o,
					onCancel: i
				})
			})]
		}) }) })
	});
}, le = (e) => e ? {
	height: void 0,
	maxHeight: void 0,
	overflowWrap: "anywhere",
	textOverflow: void 0,
	verticalAlign: "top",
	whiteSpace: "normal"
} : {
	height: "10",
	maxHeight: "10",
	overflowWrap: void 0,
	textOverflow: "ellipsis",
	verticalAlign: "middle",
	whiteSpace: "nowrap"
}, ue = (e) => {
	let { activeDraft: t = "", column: n, context: r, editMode: i, isActive: a, isReadOnly: o, wrapRows: s, onActivate: c, onCancel: l, onDraftChange: u, onSave: d } = e, f = I(null), p = !o && (i.isCellEditable?.(r) ?? !0), m = le(s), h;
	if (a) {
		let e = i.renderCellEditor?.({
			context: r,
			value: t,
			onChange: u
		});
		h = /* @__PURE__ */ X(ce, {
			anchorRef: f,
			draft: t,
			customEditor: e,
			onChange: u,
			onSave: d,
			onCancel: l
		});
	} else h = /* @__PURE__ */ X(R, {
		width: "100%",
		minHeight: "5",
		textAlign: "inherit",
		overflowWrap: m.overflowWrap,
		whiteSpace: m.whiteSpace,
		children: i.renderCell?.(r) ?? String(r.value ?? "")
	});
	return /* @__PURE__ */ X(J.Cell, {
		ref: f,
		"data-column-id": n.id,
		"data-editable": String(p),
		"data-editing": a ? "true" : void 0,
		padding: a ? "0" : "xs",
		height: m.height,
		maxHeight: m.maxHeight,
		position: "relative",
		overflow: a ? "visible" : "hidden",
		background: "bg",
		textAlign: n.alignment ?? "left",
		textStyle: "paragraph/S/regular",
		textOverflow: m.textOverflow,
		verticalAlign: m.verticalAlign,
		whiteSpace: m.whiteSpace,
		borderRightWidth: "1px",
		borderBottomWidth: "1px",
		borderColor: "border.subtle",
		cursor: p && !a ? "text" : void 0,
		tabIndex: p && !a ? 0 : void 0,
		onClick: p && !a ? c : void 0,
		onKeyDown: (e) => {
			!p || a || e.key !== "Enter" && e.key !== " " || (e.preventDefault(), c());
		},
		children: h
	});
}, de = (e) => {
	e.stopPropagation();
}, fe = (e) => {
	let { checked: t, indeterminate: n, onChange: i } = e;
	return /* @__PURE__ */ X(x, {
		checked: t || (n ? "indeterminate" : !1),
		"aria-label": "Select all",
		icon: /* @__PURE__ */ X(V, {
			as: n ? a : r,
			boxSize: "12px",
			strokeWidth: "3"
		}),
		onClick: de,
		onCheckedChange: (e) => i(e.checked === !0)
	});
}, pe = (e) => {
	let { checked: t, onChange: n } = e;
	return /* @__PURE__ */ X(J.Cell, {
		"data-column-id": "rowSelection",
		height: "10",
		padding: "xs",
		textAlign: "center",
		background: "bg",
		borderRightWidth: "1px",
		borderBottomWidth: "1px",
		borderColor: "border.subtle",
		children: /* @__PURE__ */ X(x, {
			checked: t,
			"aria-label": "Select row",
			icon: /* @__PURE__ */ X(V, {
				as: r,
				boxSize: "12px",
				strokeWidth: "3"
			}),
			onClick: de,
			onCheckedChange: (e) => n(e.checked === !0)
		})
	});
}, me = (e) => {
	let { activeCell: t, columns: n, data: r, editMode: i, enableSelection: a, isReadOnly: o, pageIndex: c, pageRows: u, pageSize: d, rowNumbers: f, selectedRowIds: p, showNewRow: m, wrapRows: h, onActivateCell: g, onAddRow: _, onCancelCell: v, onCommitCell: y, onDraftChange: b, onRemoveRow: x, onToggleRowSelection: C, rowIdFor: w } = e, T = h ? void 0 : "10", E = h ? "top" : "middle";
	return /* @__PURE__ */ Z(J.Body, { children: [u.map((e, s) => {
		let u = c * d + s, m = r.indexOf(e), _ = w(e, m), D = /* @__PURE__ */ Z(J.Row, {
			"data-document-row": "true",
			"data-selected": p.has(_) ? "true" : void 0,
			"aria-selected": p.has(_),
			height: T,
			background: "bg",
			children: [
				f ? /* @__PURE__ */ X(J.Cell, {
					"data-column-id": "rowIndex",
					height: T,
					padding: "xs",
					textAlign: "center",
					textStyle: "paragraph/S/regular",
					background: "bg.subtle",
					borderRightWidth: "1px",
					borderBottomWidth: "1px",
					borderColor: "border.subtle",
					verticalAlign: E,
					children: u + 1
				}) : null,
				a ? /* @__PURE__ */ X(pe, {
					checked: p.has(_),
					onChange: (e) => C(_, e)
				}) : null,
				n.map((n) => {
					let r = {
						row: e,
						rowId: _,
						columnId: n.id,
						value: e[n.id] ?? ""
					}, a = t?.rowId === _ && t.columnId === n.id;
					return /* @__PURE__ */ X(ue, {
						activeDraft: a ? t?.draft : void 0,
						column: n,
						context: r,
						editMode: i,
						isActive: a,
						isReadOnly: o,
						wrapRows: h,
						onActivate: () => g({
							rowId: _,
							columnId: n.id,
							draft: String(r.value ?? "")
						}),
						onDraftChange: (e) => b({
							rowId: _,
							columnId: n.id,
							draft: e
						}),
						onSave: y,
						onCancel: v
					}, n.id);
				}),
				o ? null : /* @__PURE__ */ X(J.Cell, {
					"data-column-id": "editControl",
					width: "min-content",
					height: T,
					position: "sticky",
					right: "0",
					zIndex: "1",
					background: "bg",
					borderLeftWidth: "1px",
					borderBottomWidth: "1px",
					borderColor: "border.subtle",
					verticalAlign: E
				})
			]
		}, _);
		return o ? D : /* @__PURE__ */ X(S, {
			contentMinWidth: "12rem",
			actions: [{
				key: "delete-row",
				label: "Delete row",
				icon: /* @__PURE__ */ X(V, {
					as: l,
					boxSize: "14px"
				}),
				onClick: () => x(_)
			}],
			children: D
		}, _);
	}), !o && m ? /* @__PURE__ */ X(J.Row, { children: /* @__PURE__ */ X(J.Cell, {
		colSpan: n.length + 1 + +!!f + +!!a,
		padding: "0",
		children: /* @__PURE__ */ Z(z, {
			size: "xs",
			variant: "ghost-static",
			width: "100%",
			justifyContent: "flex-start",
			paddingX: "xs",
			color: "fg.muted",
			onClick: _,
			children: [/* @__PURE__ */ X(V, { as: s }), "New row"]
		})
	}) }) : null] });
}, he = (e) => {
	let { activeHeader: t, columnIcons: n, columns: r, data: i, editMode: a, isReadOnly: c, rowNumbers: u, rowDisplayControl: f, selectionHeader: p, onAddColumn: m, onCancelHeaderEdit: h, onDeleteColumn: g, onHeaderDraftChange: _, onHeaderEdit: v, onSaveHeader: y } = e;
	return /* @__PURE__ */ X(J.Header, { children: /* @__PURE__ */ Z(J.Row, {
		height: "10",
		background: "bg.subtle",
		children: [
			u ? /* @__PURE__ */ X(J.ColumnHeader, {
				"data-column-id": "rowIndex",
				width: "fit-content",
				padding: f ? "2xs" : "xs",
				background: "bg.subtle",
				borderRightWidth: "1px",
				borderBottomWidth: "1px",
				borderColor: "border.subtle",
				children: f
			}) : null,
			p ? /* @__PURE__ */ X(J.ColumnHeader, {
				"data-column-id": "rowSelection",
				padding: "xs",
				textAlign: "center",
				background: "bg.subtle",
				borderRightWidth: "1px",
				borderBottomWidth: "1px",
				borderColor: "border.subtle",
				children: p
			}) : null,
			r.map((e, s) => {
				let p = t?.columnId === e.id, m = n?.[e.id] ?? d(i.map((t) => t[e.id])), b = /* @__PURE__ */ X(J.ColumnHeader, {
					"data-column-id": e.id,
					"data-data-column": "true",
					height: "10",
					padding: p ? "0" : "xs",
					position: "relative",
					overflow: "hidden",
					background: "bg.subtle",
					textAlign: e.alignment ?? "left",
					borderRightWidth: "1px",
					borderBottomWidth: "1px",
					borderColor: "border.subtle",
					cursor: c ? "default" : "context-menu",
					children: p ? /* @__PURE__ */ X(se, {
						accessibleName: e.label || "empty",
						draft: t.draft,
						onChange: _,
						onSave: y,
						onCancel: h
					}) : /* @__PURE__ */ Z(B, {
						alignItems: "center",
						gap: "1",
						minWidth: "0",
						overflow: "hidden",
						children: [
							m,
							/* @__PURE__ */ X(Y, {
								as: "div",
								textStyle: "label/S/medium",
								truncate: !0,
								children: a.renderHeader?.(e) ?? e.label
							}),
							!u && s === 0 ? f : null
						]
					})
				}, e.id);
				return c ? b : /* @__PURE__ */ X(S, {
					contentMinWidth: "12rem",
					actions: [{
						key: "edit-header",
						label: "Rename column",
						icon: /* @__PURE__ */ X(V, {
							as: o,
							boxSize: "14px"
						}),
						onClick: () => v(e)
					}, {
						key: "delete-column",
						label: "Delete column",
						icon: /* @__PURE__ */ X(V, {
							as: l,
							boxSize: "14px"
						}),
						isDisabled: r.length === 1,
						separatorBefore: !0,
						onClick: () => g(e.id)
					}],
					children: b
				}, e.id);
			}),
			c ? null : /* @__PURE__ */ X(J.ColumnHeader, {
				"data-column-id": "editControl",
				width: "min-content",
				padding: "2xs",
				textAlign: "center",
				position: "sticky",
				right: "0",
				zIndex: "3",
				background: "bg.subtle",
				borderLeftWidth: "1px",
				borderBottomWidth: "1px",
				borderColor: "border.subtle",
				children: /* @__PURE__ */ X(H, {
					size: "xs",
					variant: "ghost",
					"aria-label": "Insert column",
					onClick: m,
					children: /* @__PURE__ */ X(s, {})
				})
			})
		]
	}) });
};
// packages/ui/src/components/data-table/pagination-footer.tsx
function ge(a) {
	let { pageCount: o, pageIndex: s, pageSize: c, pageSizeOptions: l, onPageChange: u, onPageSizeChange: d } = a, f = Math.max(o, 1), p = a.navigationIndex ?? s, m = p > 0, h = p < f - 1;
	return /* @__PURE__ */ X(B, {
		flexShrink: "0",
		alignItems: "center",
		justifyContent: "flex-end",
		borderTop: "1px solid",
		borderColor: "border.subtle",
		paddingX: "xs",
		children: /* @__PURE__ */ Z(q, {
			alignItems: "center",
			direction: "row",
			justifyContent: "flex-end",
			paddingY: "xs",
			children: [
				a.loading ? /* @__PURE__ */ Z(q, {
					role: "status",
					"aria-live": "polite",
					direction: "row",
					alignItems: "center",
					gap: "xs",
					children: [/* @__PURE__ */ X(K, { size: "xs" }), /* @__PURE__ */ Z(Y, {
						textStyle: "label/S/regular",
						children: ["Loading page ", p + 1]
					})]
				}) : null,
				/* @__PURE__ */ Z(B, {
					alignItems: "center",
					gap: "xs",
					marginRight: "sm",
					children: [/* @__PURE__ */ X(Y, {
						textStyle: "label/S/regular",
						children: "Rows per page"
					}), /* @__PURE__ */ Z(U.Root, { children: [/* @__PURE__ */ X(U.Trigger, {
						asChild: !0,
						children: /* @__PURE__ */ X(z, {
							size: "xs",
							variant: "outline",
							children: c
						})
					}), /* @__PURE__ */ X(G, { children: /* @__PURE__ */ X(U.Positioner, { children: /* @__PURE__ */ X(U.Content, {
						bg: "bg",
						children: l.map((e) => /* @__PURE__ */ X(U.Item, {
							value: `${e}`,
							asChild: !0,
							children: /* @__PURE__ */ X(C, {
								asChild: !0,
								variant: "full-width",
								label: `${e}`,
								isSelected: e === c,
								endContent: e === c ? /* @__PURE__ */ X(V, {
									as: r,
									boxSize: "3.5"
								}) : void 0,
								onActivate: () => d(e)
							})
						}, e))
					}) }) })] })]
				}),
				/* @__PURE__ */ X(H, {
					size: "xs",
					"aria-label": "Go to first page",
					onClick: () => u(0),
					disabled: !m,
					children: /* @__PURE__ */ X(V, {
						as: t,
						boxSize: "14px"
					})
				}),
				/* @__PURE__ */ X(H, {
					size: "xs",
					"aria-label": "Go to previous page",
					onClick: () => u(p - 1),
					disabled: !m,
					children: /* @__PURE__ */ X(V, {
						as: e,
						boxSize: "14px"
					})
				}),
				/* @__PURE__ */ X(H, {
					size: "xs",
					"aria-label": "Go to next page",
					onClick: () => u(p + 1),
					disabled: !h,
					children: /* @__PURE__ */ X(V, {
						as: i,
						boxSize: "14px"
					})
				}),
				/* @__PURE__ */ X(H, {
					size: "xs",
					"aria-label": "Go to last page",
					onClick: () => u(f - 1),
					disabled: !h,
					children: /* @__PURE__ */ X(V, {
						as: n,
						boxSize: "14px"
					})
				}),
				/* @__PURE__ */ Z(B, {
					alignItems: "center",
					height: "100%",
					marginLeft: "sm",
					marginRight: "md",
					gap: "xs",
					children: [
						/* @__PURE__ */ X(Y, { children: "Page" }),
						/* @__PURE__ */ X(w, {
							margin: "2xs",
							width: "3rem",
							size: "xs",
							min: 1,
							max: f,
							value: `${s + 1}`,
							onValueChange: (e) => {
								let t = Number.isNaN(e.valueAsNumber) ? 1 : e.valueAsNumber;
								u(Math.min(f, Math.max(1, t)) - 1);
							},
							children: /* @__PURE__ */ X(T, { className: "nodrag" })
						}),
						/* @__PURE__ */ Z(Y, { children: ["of ", f] })
					]
				})
			]
		})
	});
}
// packages/ui/src/components/data-table/selection-toolbar.tsx
function _e(e) {
	let { selectedCount: t, totalCount: n, onClearSelection: r, onSelectAll: i, actions: a, selectedRows: o } = e, s = a.length === 1 ? a[0]?.label : "Actions";
	return /* @__PURE__ */ X(B, {
		position: "absolute",
		insetX: "sm",
		bottom: "sm",
		zIndex: "popover",
		justifyContent: "center",
		pointerEvents: "none",
		children: /* @__PURE__ */ Z(q, {
			role: "toolbar",
			"aria-label": "Selection actions",
			direction: "row",
			alignItems: "center",
			layerStyle: "floatingBar",
			pointerEvents: "auto",
			maxWidth: "100%",
			overflowX: "auto",
			children: [
				/* @__PURE__ */ X(H, {
					"aria-label": "clear-selection",
					onClick: r,
					size: "xs",
					children: /* @__PURE__ */ X(V, {
						as: u,
						boxSize: "16px"
					})
				}),
				/* @__PURE__ */ Z(Y, { children: [t, " rows selected"] }),
				t !== n && /* @__PURE__ */ Z(z, {
					size: "xs",
					onClick: i,
					children: [
						"Select all ",
						n,
						" rows"
					]
				}),
				a.length === 1 && a[0] ? /* @__PURE__ */ X(z, {
					size: "xs",
					onClick: () => a[0]?.onSelect(o),
					children: s
				}) : null,
				a.length > 1 ? /* @__PURE__ */ Z(U.Root, { children: [/* @__PURE__ */ X(U.Trigger, {
					asChild: !0,
					children: /* @__PURE__ */ X(z, {
						size: "xs",
						children: s
					})
				}), /* @__PURE__ */ X(G, { children: /* @__PURE__ */ X(U.Positioner, { children: /* @__PURE__ */ X(U.Content, {
					bg: "bg",
					children: a.map((e) => /* @__PURE__ */ X(U.Item, {
						value: e.label,
						asChild: !0,
						children: /* @__PURE__ */ X(C, {
							asChild: !0,
							variant: "full-width",
							tone: e.destructive ? "danger" : "default",
							label: e.label,
							icon: e.icon,
							onActivate: () => e.onSelect(o)
						})
					}, e.label))
				}) }) })] }) : null
			]
		})
	});
}
// packages/ui/src/components/data-table/use-data-table-view.ts
var ve = (e) => ({
	settings: {
		...Q,
		...e.defaultSettings
	},
	filter: e.defaultFilter,
	sorts: e.defaultSorts
}), ye = (e, t, n = {}) => O(e, ve(n), t), be = (e) => {
	let { data: t, hiddenColumns: n, getRowId: r, compactHeaders: i, columnRenderers: a, columnTypes: o, groupableColumns: s, filterableColumns: c } = e, l = new Set(n ?? []), u = Object.keys(t[0] || e.columnTypes || e.compactHeaders || {}).filter((e) => !l.has(e)), d = g({
		toolbarStorageKey: e.toolbarStorageKey,
		columnKeys: u
	}), f = ve(e), v = D({
		storageKey: d,
		initialState: f,
		viewsSource: e.viewsSource,
		defaultViews: e.defaultViews,
		defaultActiveViewId: e.defaultActiveViewId
	}), y = O(d, f, (e) => e), { settings: x, filter: S, sorts: C } = y, [w, T] = L(""), k = e.page?.request.search ?? w, A = e.page?.onSearchChange ?? T, F = P(k), I = m(u, x.columnOrder), R = I.filter((e) => !x.hiddenColumns.includes(e)), z = _(t, I, {
		compactHeaders: i,
		columnRenderers: a,
		columnTypes: o,
		groupableColumns: s,
		filterableColumns: c
	}), B = p(t, I, r, a), V = e.page ? B : E(B, S, z), H = e.page ? V : j(V, C, z), U = e.page ? H : ee(H, F, (e) => R.flatMap((t) => h(e.sourceRow[t], a?.[t]))), W = b(z, x.grouping), G = W?.groupable ? M(U, W, M(B, W).map((e) => e.key)) : void 0, K = G && W && e.page?.result ? N(G, e.page.result.groups, W) : G;
	return {
		...y,
		storageKey: d,
		initialState: f,
		views: v,
		search: k,
		deferredSearch: F,
		setSearch: A,
		attributes: z,
		rows: B,
		filteredRows: V,
		totalCount: e.page?.result?.total ?? V.length,
		shownCount: e.page?.result?.filteredTotal ?? U.length,
		shownRows: U,
		groups: K,
		orderedColumnKeys: I,
		visibleColumnKeys: R
	};
}, xe = (e) => `${e}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`, Se = (e) => {
	let { data: t, editMode: n, fullWidth: r = !1, initialPageSize: i = 30, pageSizeOptions: a = [
		10,
		20,
		30,
		50
	], isReadOnly: o = !0, getRowId: s, columnIcons: c, toolbarStorageKey: l } = e, [u, d] = L(0), [p, m] = L(() => Math.min(Math.max(i, 1), 50)), [h, g] = L(null), [_, b] = L(null), [x, S] = L(() => /* @__PURE__ */ new Set()), C = n?.columns ?? [], w = C.map((e) => e.id), T = be({
		...e,
		compactHeaders: Object.fromEntries(C.map((e) => [e.id, e.label])),
		hiddenColumns: Object.keys(t[0] ?? {}).filter((e) => !w.includes(e))
	}), E = T.settings.wrapRows, D = T.settings.rowNumbers, O = (e) => T.setSettings({ wrapRows: e }), k = T.shownRows, A = k.map((e) => e.sourceRow), ee = [...new Set(a.filter((e) => e > 0 && e <= 50))], j = Math.max(Math.ceil(A.length / p), 1), M = A.slice(u * p, (u + 1) * p), N = "fit-content";
	r && (N = o ? "100%" : "calc(100% + var(--chakra-spacing-10))");
	let P = v(e), I = f(e);
	if (F(() => {
		u < j || d(j - 1);
	}, [j, u]), F(() => {
		let e = new Set(k.map((e) => e.id));
		S((t) => {
			let n = new Set([...t].filter((t) => e.has(t)));
			return n.size === t.size && [...n].every((e) => t.has(e)) ? t : n;
		});
	}, [k]), !n) return null;
	let z = (e, t) => s?.(e, t) ?? String(e.id ?? t), V = () => {
		h && (n.onDataChange(t.map((e, t) => z(e, t) === h.rowId ? {
			...e,
			[h.columnId]: h.draft
		} : e)), g(null));
	}, H = (e, t) => {
		n.onColumnsChange(C.map((n) => n.id === e ? {
			...n,
			...t,
			id: n.id
		} : n));
	}, U = () => {
		_ && (H(_.columnId, { label: _.draft }), b(null));
	}, W = () => {
		let e = xe("column");
		n.onColumnsChange([...C, {
			id: e,
			label: `Column ${C.length + 1}`,
			alignment: null
		}]);
	}, G = (e) => {
		C.length !== 1 && (n.onColumnsChange(C.filter((t) => t.id !== e)), _?.columnId === e && b(null));
	}, K = () => {
		let e = Object.fromEntries(C.map((e) => [e.id, ""]));
		e.id = xe("row"), n.onDataChange([...t, e]);
	}, q = (e) => {
		m(Math.min(e, 50)), d(0);
	}, Y = (e) => {
		n.onDataChange(t.filter((t, n) => z(t, n) !== e));
	}, te = (e, t) => {
		S((n) => {
			let r = new Set(n);
			return t ? r.add(e) : r.delete(e), r;
		});
	}, Q = k.length > 0 && x.size === k.length, $ = k.filter((e) => x.has(e.id)).map((e) => e.sourceRow), re = /* @__PURE__ */ X(ie, {
		compact: !l,
		wrapRows: E,
		onWrapRowsChange: O
	});
	return /* @__PURE__ */ Z(B, {
		direction: "column",
		width: "100%",
		gap: "2xs",
		children: [
			l ? /* @__PURE__ */ X(ne, {
				view: T,
				viewsSource: e.viewsSource,
				displayControl: re
			}) : null,
			/* @__PURE__ */ Z(R, {
				position: "relative",
				width: "100%",
				children: [/* @__PURE__ */ X(y, {
					"data-table-scroll-area": !0,
					maxWidth: "100%",
					showHorizontalScrollbar: !0,
					showVerticalScrollbar: !1,
					viewportProps: { overflowY: "hidden" },
					children: /* @__PURE__ */ Z(J.Root, {
						"data-edit-mode": "true",
						size: "sm",
						tableLayout: "fixed",
						width: N,
						borderWidth: "1px",
						borderColor: "border.subtle",
						children: [
							/* @__PURE__ */ Z("colgroup", { children: [
								D ? /* @__PURE__ */ X(R, {
									as: "col",
									width: "9"
								}) : null,
								P ? /* @__PURE__ */ X(R, {
									as: "col",
									width: "9"
								}) : null,
								C.map((e) => /* @__PURE__ */ X("col", {}, e.id)),
								o ? null : /* @__PURE__ */ X(R, {
									as: "col",
									width: "10"
								})
							] }),
							/* @__PURE__ */ X(he, {
								activeHeader: _,
								columnIcons: c,
								columns: C,
								data: t,
								editMode: n,
								isReadOnly: o,
								rowNumbers: D,
								rowDisplayControl: l ? void 0 : re,
								onAddColumn: W,
								onCancelHeaderEdit: () => b(null),
								onDeleteColumn: G,
								onHeaderDraftChange: (e) => b((t) => t && {
									...t,
									draft: e
								}),
								onHeaderEdit: (e) => b({
									columnId: e.id,
									draft: e.label
								}),
								onSaveHeader: U,
								selectionHeader: P ? /* @__PURE__ */ X(fe, {
									checked: Q,
									indeterminate: x.size > 0 && !Q,
									onChange: (e) => S(e ? new Set(k.map((e) => e.id)) : /* @__PURE__ */ new Set())
								}) : void 0
							}),
							/* @__PURE__ */ X(me, {
								activeCell: h,
								columns: C,
								data: t,
								editMode: n,
								enableSelection: P,
								isReadOnly: o,
								pageIndex: u,
								pageRows: M,
								pageSize: p,
								rowNumbers: D,
								selectedRowIds: x,
								showNewRow: u === j - 1,
								wrapRows: E,
								onActivateCell: g,
								onAddRow: K,
								onCancelCell: () => g(null),
								onCommitCell: V,
								onDraftChange: g,
								onRemoveRow: Y,
								onToggleRowSelection: te,
								rowIdFor: z
							})
						]
					})
				}), P && $.length > 0 ? /* @__PURE__ */ X(_e, {
					selectedCount: $.length,
					totalCount: k.length,
					onClearSelection: () => S(/* @__PURE__ */ new Set()),
					onSelectAll: () => S(new Set(k.map((e) => e.id))),
					actions: I,
					selectedRows: $
				}) : null]
			}),
			j > 1 ? /* @__PURE__ */ X(ge, {
				pageCount: j,
				pageIndex: u,
				pageSize: p,
				pageSizeOptions: ee,
				onPageChange: d,
				onPageSizeChange: q
			}) : null
		]
	});
};
export { ge as a, _e as i, be as n, ne as o, ye as r, Se as t };
