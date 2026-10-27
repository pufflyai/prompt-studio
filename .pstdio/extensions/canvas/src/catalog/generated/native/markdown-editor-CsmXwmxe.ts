// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./rolldown-runtime-CwxnZyOB.ts";
import { p as t, r as n, s as r } from "./lucide-react-DrMf1u5h.ts";
import { t as i } from "./check-Bgh538vW.ts";
import { t as a } from "./minus-BdT0RA0-.ts";
import { t as o } from "./pencil-DsB6zW8x.ts";
import { t as s } from "./trash-2-C03vrbuo.ts";
import { t as c } from "./x-DqEAa6-d.ts";
import { t as l } from "./tooltip-BweQW627.ts";
import { B as u, D as d, G as f, H as p, Q as m, T as h, V as g, W as _, a as v, d as y, i as ee, it as te, n as ne, nt as re, o as ie, r as ae, rt as b, t as oe, tt as x, y as S } from "./list-marker-width-plugin-BDROuhXk.ts";
import { $ as C, Bt as w, D as se, Dt as ce, J as T, Lt as le, M as ue, N as de, Nn as fe, Qt as pe, Sn as E, Xn as me, Yt as D, b as he, bn as O, g as k, h as A, it as ge, jt as j, lt as _e, m as M, n as ve, qn as N, qt as P, r as ye, rn as F, zn as be } from "./rich-text-theme-C7PhYVHR.ts";
import { t as I } from "./LexicalComposerContext.prod-C-LZ0eF8.ts";
import { a as xe, i as Se, n as Ce, r as L, t as we } from "./FloatingTextFormatToolbarPlugin-DBNEl3w4.ts";
import { i as Te, r as Ee, t as De } from "./TreeViewPlugin-CkVdbwL2.ts";
import { n as Oe, t as ke } from "./markdown-C92hFHal.ts";
import { n as Ae, t as je } from "./LexicalHistoryPlugin.prod-jaXHN1zU.ts";
import { useEffect as R, useLayoutEffect as Me, useRef as z, useState as B } from "react";
import { Box as V, Button as H, Dialog as U, Field as W, Flex as G, Icon as Ne, IconButton as K, Input as q, Link as Pe, Stack as Fe, Text as J } from "@chakra-ui/react";
import { Fragment as Ie, jsx as Y, jsxs as X } from "react/jsx-runtime";
import * as Le from "react-dom";
import { createPortal as Re } from "react-dom";
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalAutoFocusPlugin.prod.mjs
function ze({ defaultSelection: e }) {
	let [t] = I();
	return R(() => {
		t.focus(() => {
			let e = document.activeElement, n = t.getRootElement();
			n === null || e !== null && n.contains(e) || n.focus({ preventScroll: !0 });
		}, { defaultSelection: e });
	}, [e, t]), null;
}
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalCheckListPlugin.prod.mjs
function Be() {
	let [e] = I();
	return R(() => m(e), [e]), null;
}
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalMarkdownShortcutPlugin.prod.mjs
var Ve = [{
	dependencies: [te],
	export: (e) => se(e) ? "***" : null,
	regExp: /^(---|\*\*\*|___)\s?$/,
	replace: (e, t, n, r) => {
		let i = b();
		r || e.getNextSibling() != null ? e.replace(i) : e.insertBefore(i), i.selectNext();
	},
	type: "element"
}, ...u];
function He({ transformers: e = Ve }) {
	let [t] = I();
	return R(() => g(t, e), [t, e]), null;
}
// packages/ui/src/components/rich-text/shared/plugins/LinkEditorPlugin/link-editor-content.tsx
function Ue(e) {
	let { isActive: t, isLinkEditMode: n, editedLinkUrl: r, editedLinkUrlIsValid: a, linkUrl: u, href: d, inputRef: f, onEditedLinkUrlChange: p, onInputKeyDown: m, onClose: h, onSubmit: g, onEdit: _, onRemove: v } = e;
	return t ? n ? /* @__PURE__ */ X(Fe, {
		className: "link-editor-content",
		direction: "row",
		gap: "1",
		alignItems: "center",
		p: "1",
		children: [
			/* @__PURE__ */ Y(q, {
				ref: f,
				className: "link-editor-url-field",
				size: "sm",
				fontSize: "sm",
				value: r,
				placeholder: "https://",
				"aria-label": "Link URL",
				"aria-invalid": !a,
				onChange: (e) => {
					p(e.target.value);
				},
				onKeyDown: m
			}),
			/* @__PURE__ */ Y(l, {
				content: "Cancel",
				children: /* @__PURE__ */ Y(K, {
					variant: "ghost",
					size: "xs",
					"aria-label": "Cancel link edit",
					onMouseDown: Z,
					onClick: h,
					children: /* @__PURE__ */ Y(c, { size: 14 })
				})
			}),
			/* @__PURE__ */ Y(l, {
				content: "Confirm",
				children: /* @__PURE__ */ Y(K, {
					variant: "ghost",
					size: "xs",
					"aria-label": "Confirm link edit",
					disabled: !a,
					onMouseDown: Z,
					onClick: g,
					children: /* @__PURE__ */ Y(i, { size: 14 })
				})
			})
		]
	}) : /* @__PURE__ */ X(Fe, {
		className: "link-editor-content",
		direction: "row",
		gap: "1",
		alignItems: "center",
		p: "1",
		children: [
			/* @__PURE__ */ Y(Pe, {
				href: d,
				target: "_blank",
				rel: "noopener noreferrer",
				className: "link-editor-url-field",
				fontSize: "sm",
				textDecoration: "underline",
				px: "2",
				truncate: !0,
				children: u
			}),
			/* @__PURE__ */ Y(l, {
				content: "Edit link",
				children: /* @__PURE__ */ Y(K, {
					variant: "ghost",
					size: "xs",
					"aria-label": "Edit link",
					onMouseDown: Z,
					onClick: _,
					children: /* @__PURE__ */ Y(o, { size: 14 })
				})
			}),
			/* @__PURE__ */ Y(l, {
				content: "Remove link",
				children: /* @__PURE__ */ Y(K, {
					variant: "destructive-ghost",
					size: "xs",
					"aria-label": "Remove link",
					onMouseDown: Z,
					onClick: v,
					children: /* @__PURE__ */ Y(s, { size: 14 })
				})
			})
		]
	}) : null;
}
function Z(e) {
	e.preventDefault();
}
// packages/ui/src/components/rich-text/shared/plugins/LinkEditorPlugin/utils/link-edit-state.ts
function We(e, t, n) {
	return e && t && n === "";
}
// packages/ui/src/components/rich-text/shared/plugins/LinkEditorPlugin/utils/selection-link-url.ts
function Ge(e) {
	let t = L(e), n = P(t, A);
	return n ? n.getURL() : A(t) ? t.getURL() : "";
}
// packages/ui/src/components/rich-text/shared/plugins/LinkEditorPlugin/utils/url.ts
var Ke = /* @__PURE__ */ new Set([
	"http:",
	"https:",
	"mailto:",
	"sms:",
	"tel:"
]);
function Q(e) {
	try {
		let t = new URL(e);
		if (!Ke.has(t.protocol)) return "about:blank";
	} catch {
		return e;
	}
	return e;
}
function qe(e) {
	try {
		let t = new URL(e);
		return Ke.has(t.protocol) ? t.protocol === "http:" || t.protocol === "https:" ? t.hostname !== "" : t.pathname.trim() !== "" : !1;
	} catch {
		return !1;
	}
}
// packages/ui/src/components/rich-text/shared/plugins/LinkEditorPlugin/LinkEditorPlugin.tsx
var Je = 8;
function Ye({ editor: e, isLink: t, setIsLink: n, anchorElem: r, isLinkEditMode: i, setIsLinkEditMode: a }) {
	let o = z(null), s = z(null), c = z(() => void 0), [l, u] = B(""), [d, f] = B("https://"), [p, m] = B(null), h = t || i, g = qe(d);
	c.current = () => {
		let n = E();
		if (j(n)) {
			let e = Ge(n);
			u(e), We(i, t, e) && v(), i && e !== "" && f(e);
		}
		let s = o.current, c = window.getSelection(), l = document.activeElement;
		if (s === null) return;
		let d = e.getRootElement(), p = c !== null && c.rangeCount > 0;
		if (n !== null && c !== null && p && d?.contains(c.anchorNode) && e.isEditable()) {
			let e = c.getRangeAt(0).getBoundingClientRect(), t = new DOMRect(e.left, e.top, 0, e.height);
			Ce(t, s, r, Je, void 0, "above", "viewport"), m(n);
		} else s.contains(l) || (d !== null && Ce(null, s, r, void 0, void 0, "legacy", "viewport"), m(null), a(!1), u(""));
	}, R(() => {
		let t = r.parentElement, n = () => {
			e.getEditorState().read(() => {
				c.current();
			});
		};
		return window.addEventListener("resize", n), t && t.addEventListener("scroll", n), () => {
			window.removeEventListener("resize", n), t && t.removeEventListener("scroll", n);
		};
	}, [r.parentElement, e]), R(() => le(e.registerUpdateListener(({ editorState: e }) => {
		e.read(() => {
			c.current();
		});
	}), e.registerCommand(be, () => (c.current(), !0), 1), e.registerCommand(C, () => t ? (n(!1), !0) : !1, 3)), [
		e,
		n,
		t
	]), R(() => {
		e.getEditorState().read(() => {
			c.current();
		});
	}, [e]), Me(() => {
		h && e.getEditorState().read(() => {
			c.current();
		});
	}, [e, h]), R(() => {
		i && s.current && s.current.focus();
	}, [i]);
	let _ = (e) => {
		e.key === "Enter" ? (e.preventDefault(), y()) : e.key === "Escape" && (e.preventDefault(), v());
	}, v = () => {
		f("https://"), a(!1);
	}, y = () => {
		p !== null && g && (e.update(() => {
			ce(p);
		}), e.dispatchCommand(k, Q(d)), e.update(() => {
			let e = E();
			if (j(e)) {
				let t = L(e).getParent();
				if (M(t)) {
					let e = he(t.getURL(), {
						rel: t.__rel,
						target: t.__target,
						title: t.__title
					});
					t.replace(e, !0);
				}
			}
		}), v());
	};
	return /* @__PURE__ */ Y(V, {
		ref: o,
		zIndex: "tooltip",
		className: `link-editor ${h ? "active" : ""}`,
		children: /* @__PURE__ */ Y(Ue, {
			isActive: h,
			isLinkEditMode: i,
			editedLinkUrl: d,
			editedLinkUrlIsValid: g,
			linkUrl: l,
			href: Q(l),
			inputRef: s,
			onEditedLinkUrlChange: f,
			onInputKeyDown: _,
			onClose: v,
			onSubmit: y,
			onEdit: () => {
				f(l), a(!0);
			},
			onRemove: () => {
				e.dispatchCommand(k, null);
			}
		})
	});
}
function Xe(e, t, n, r) {
	let [i, a] = B(e), [o, s] = B(!1);
	return R(() => {
		function t() {
			let e = E();
			if (j(e)) {
				let t = L(e), n = P(t, A), r = P(t, M);
				if (!(n || r)) {
					s(!1);
					return;
				}
				e.getNodes().filter((e) => !pe(e)).find((e) => {
					let t = P(e, A), i = P(e, M), a = M(i) && i.getIsUnlinked();
					return n && !n.is(t) || t && !t.is(n) || r && !r.is(i) || i && (!i.is(r) || a);
				}) ? s(!1) : s(!0);
			}
		}
		return le(e.registerUpdateListener(({ editorState: e }) => {
			e.read(() => {
				t();
			});
		}), e.registerCommand(be, (e, n) => (t(), a(n), !1), 4), e.registerCommand(fe, (e) => {
			let t = E();
			if (j(t)) {
				let n = L(t), r = P(n, A);
				if (A(r) && (e.metaKey || e.ctrlKey)) return window.open(Q(r.getURL()), "_blank", "noopener,noreferrer"), !0;
			}
			return !1;
		}, 1), e.registerCommand(Se, (e) => (r(e), !0), 1));
	}, [e, r]), Re(/* @__PURE__ */ Y(Ye, {
		editor: i,
		isLink: o,
		anchorElem: t,
		setIsLink: s,
		isLinkEditMode: n,
		setIsLinkEditMode: r
	}), document.body);
}
function Ze({ anchorElem: e = document.body }) {
	let [t, n] = B(!1), [r] = I();
	return Xe(r, e, t, n);
}
// packages/ui/src/components/rich-text/shared/plugins/LinkEditorPlugin/LinkPlugin.tsx
function Qe() {
	return /* @__PURE__ */ Y(x, { validateUrl: qe });
}
// packages/ui/src/components/rich-text/markdown-editor/plugins/markdown-section-navigation.ts
var $e = (e) => e.trim().replace(/\s+/g, " "), et = (e, t) => {
	let n = e.map($e), r = /* @__PURE__ */ new Map(), i = [];
	for (let e of t) {
		let t = $e(e.heading), a = e.occurrence ?? r.get(t) ?? 0;
		r.set(t, a + 1);
		let o = 0;
		for (let [r, s] of n.entries()) if (s === t) {
			if (o === a) {
				i.push({
					id: e.id,
					headingIndex: r
				});
				break;
			}
			o += 1;
		}
	}
	return i.sort((e, t) => e.headingIndex - t.headingIndex);
}, tt = (e, t) => {
	let n = e[0]?.id;
	for (let r of e) {
		if (r.top > t) break;
		n = r.id;
	}
	return n;
}, nt = (e) => {
	let t = e.parentElement;
	for (; t;) {
		let e = getComputedStyle(t).overflowY;
		if ([
			"auto",
			"scroll",
			"overlay"
		].includes(e)) return t;
		t = t.parentElement;
	}
	return null;
}, rt = (e) => {
	let { anchors: t, targetId: n, onActiveSectionChange: r } = e, [i] = I(), a = z(r);
	return a.current = r, R(() => {
		let e = () => {}, r = requestAnimationFrame(() => {
			let r = i.getRootElement();
			if (!r) return;
			let o = Array.from(r.querySelectorAll("h1, h2, h3, h4, h5, h6")), s = et(o.map((e) => e.textContent ?? ""), t).map((e) => ({
				id: e.id,
				element: o[e.headingIndex]
			}));
			for (let e of s) e.element.dataset.markdownSectionId = e.id;
			let c = s.find((e) => e.id === n);
			if (!c) {
				console.warn(`[markdown section] Unknown section id: ${n}`), a.current?.(null);
				return;
			}
			c.element.tabIndex = -1, c.element.scrollIntoView({ block: "start" }), c.element.focus({ preventScroll: !0 });
			let l = nt(r), u, d = () => {
				let e = l?.getBoundingClientRect().top ?? 0, t = tt(s.map((t) => ({
					id: t.id,
					top: t.element.getBoundingClientRect().top - e
				})), 8);
				t && t !== u && (u = t, a.current?.(t));
			}, f = l ?? window;
			f.addEventListener("scroll", d, { passive: !0 }), d(), e = () => {
				f.removeEventListener("scroll", d);
			};
		});
		return () => {
			cancelAnimationFrame(r), e();
		};
	}, [
		t,
		i,
		n
	]), null;
}, it = (e) => ({
	columns: [{
		id: `${e}-column-1`,
		label: "Column 1",
		alignment: null
	}, {
		id: `${e}-column-2`,
		label: "Column 2",
		alignment: null
	}],
	rows: [{
		id: `${e}-row-1`,
		cells: {
			[`${e}-column-1`]: "",
			[`${e}-column-2`]: ""
		}
	}]
}), at = [
	{
		id: "table",
		label: "Table",
		icon: n
	},
	{
		id: "image",
		label: "Image",
		icon: r
	},
	{
		id: "code",
		label: "Code block",
		icon: t
	},
	{
		id: "divider",
		label: "Divider",
		icon: a
	}
], ot = (e) => {
	let t = E();
	if (!j(t)) return null;
	let n = t.anchor.getNode();
	if (!T(n.getParent()) || n.getPreviousSibling()) return null;
	let r = /^\/([a-z ]*)$/i.exec(e);
	return r ? {
		leadOffset: 0,
		matchingString: r[1] ?? "",
		replaceableString: r[0]
	} : null;
}, st = () => `table-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`, $ = (e, t) => {
	let n = e?.getParent();
	if (!T(n)) return;
	n.replace(t);
	let r = O();
	t.insertAfter(r), r.select();
}, ct = (e) => {
	let { options: t, selectedIndex: n, onSelect: r, onHighlight: i } = e;
	return R(() => {
		document.getElementById(`slash-command-${n}`)?.scrollIntoView({ block: "nearest" });
	}, [n]), /* @__PURE__ */ X(V, {
		role: "listbox",
		"aria-label": "Insert content",
		position: "absolute",
		zIndex: "popover",
		layerStyle: "modal",
		minWidth: "13rem",
		overflow: "hidden",
		paddingY: "2xs",
		children: [
			/* @__PURE__ */ Y(J, {
				paddingX: "sm",
				paddingY: "2xs",
				color: "fg.muted",
				textStyle: "label/S/medium",
				children: "Insert"
			}),
			t.length === 0 ? /* @__PURE__ */ Y(J, {
				padding: "sm",
				color: "fg.muted",
				textStyle: "paragraph/S/regular",
				children: "No matching commands"
			}) : null,
			t.map((e, t) => {
				let a = n === t;
				return /* @__PURE__ */ X(G, {
					ref: e.setRefElement,
					id: `slash-command-${t}`,
					role: "option",
					"aria-selected": a,
					alignItems: "center",
					gap: "xs",
					paddingX: "sm",
					paddingY: "xs",
					cursor: "pointer",
					background: a ? "bg.active" : "transparent",
					_hover: { background: a ? "bg.active" : "bg.hover" },
					onMouseEnter: () => i(t),
					onPointerDown: (e) => e.preventDefault(),
					onClick: () => r(e, t),
					children: [/* @__PURE__ */ Y(Ne, {
						as: e.icon,
						boxSize: "16px",
						flexShrink: 0
					}), /* @__PURE__ */ Y(J, {
						minWidth: "0",
						truncate: !0,
						textStyle: "label/M/medium",
						children: e.label
					})]
				}, e.id);
			})
		]
	});
}, lt = () => {
	let [e] = I(), [t, n] = B(null), [r, i] = B(null), [a, o] = B(""), [s, c] = B("Image"), l = at.filter((e) => !t || e.label.toLowerCase().includes(t.toLowerCase())).map((e) => ({
		...e,
		key: e.id,
		setRefElement: () => {}
	})), u = () => {
		r && e.update(() => {
			let e = N(r);
			T(e) && e.selectStart();
		}, { tag: D }), i(null), setTimeout(() => e.focus(), 0);
	};
	return /* @__PURE__ */ X(Ie, { children: [/* @__PURE__ */ Y(Ae, {
		onQueryChange: n,
		triggerFn: ot,
		options: l,
		onSelectOption: (e, t, n) => {
			if (e.id === "image") {
				let e = t?.getParent(), r = E();
				if (!T(e) || !j(r)) return;
				F(D), r.anchor.set(e.getKey(), 0, "element"), r.removeText(), o(""), c("Image"), i(e.getKey()), n();
			} else F(D), e.id === "table" && $(t, S(it(st()))), e.id === "code" && $(t, p()), e.id === "divider" && $(t, b()), n();
		},
		menuRenderFn: (e, t) => e.current ? Le.createPortal(/* @__PURE__ */ Y(ct, {
			options: t.options,
			selectedIndex: t.selectedIndex,
			onHighlight: t.setHighlightedIndex,
			onSelect: (e, n) => {
				t.setHighlightedIndex(n), t.selectOptionAndCleanUp(e);
			}
		}), e.current) : null
	}), /* @__PURE__ */ X(U.Root, {
		open: !!r,
		finalFocusEl: () => e.getRootElement(),
		onOpenChange: (e) => {
			!e.open && r && u();
		},
		children: [/* @__PURE__ */ Y(U.Backdrop, {}), /* @__PURE__ */ Y(U.Positioner, { children: /* @__PURE__ */ Y(U.Content, {
			asChild: !0,
			children: /* @__PURE__ */ X("form", {
				onSubmit: (t) => {
					t.preventDefault(), r && a.trim() && (e.update(() => {
						let e = N(r);
						if (T(e)) {
							e.splice(0, 0, [h(a.trim(), s.trim() || "Image")]);
							let t = O();
							e.insertAfter(t), t.select();
						}
					}, { tag: D }), i(null), setTimeout(() => e.focus(), 0));
				},
				children: [
					/* @__PURE__ */ Y(U.Header, { children: /* @__PURE__ */ Y(U.Title, { children: "Insert image" }) }),
					/* @__PURE__ */ Y(U.Body, { children: /* @__PURE__ */ X(G, {
						direction: "column",
						gap: "sm",
						children: [/* @__PURE__ */ X(W.Root, {
							required: !0,
							children: [/* @__PURE__ */ Y(W.Label, { children: "Image URL" }), /* @__PURE__ */ Y(q, {
								autoFocus: !0,
								value: a,
								onChange: (e) => o(e.target.value)
							})]
						}), /* @__PURE__ */ X(W.Root, { children: [/* @__PURE__ */ Y(W.Label, { children: "Alt text" }), /* @__PURE__ */ Y(q, {
							value: s,
							onChange: (e) => c(e.target.value)
						})] })]
					}) }),
					/* @__PURE__ */ X(U.Footer, { children: [/* @__PURE__ */ Y(H, {
						type: "button",
						variant: "ghost",
						onClick: u,
						children: "Cancel"
					}), /* @__PURE__ */ Y(H, {
						type: "submit",
						variant: "primary",
						disabled: !a.trim(),
						children: "Insert image"
					})] })
				]
			})
		}) })]
	})] });
}, ut = () => {
	let [e] = I(), [t] = B(() => ({
		current: {
			editor: e,
			editorState: e.getEditorState()
		},
		redoStack: [],
		undoStack: []
	}));
	return R(() => {
		t.current = {
			editor: e,
			editorState: e.getEditorState()
		};
	}, [e, t]), R(() => e.registerCommand(w, (t) => {
		let n = t.target;
		return n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement || !t.ctrlKey && !t.metaKey || t.key.toLowerCase() !== "z" ? !1 : (t.preventDefault(), e.dispatchCommand(t.shiftKey ? ge : me, void 0), !0);
	}, 3), [e]), /* @__PURE__ */ Y(je, { externalHistoryState: t });
}, dt = /* @__PURE__ */ e({ MarkdownEditor: () => pt }), ft = "markdown-initial-import";
function pt(e) {
	let { autoFocus: t = !1, debug: n = !1, defaultState: r = "", fullWidth: i = !1, isEditable: a = !1, padding: o, placeholder: s, scrollable: c = !0, sectionNavigation: l, resolveMarkdownUrl: u, onActiveSectionChange: p, onChange: m } = e, { frontmatter: h, body: g } = ke(r), te = a && !!m, b = z(null), x = z(null);
	x.current ??= Oe(g, u);
	let S = x.current, [C, w] = B(null);
	return R(() => {
		w(b.current);
	}, []), /* @__PURE__ */ Y(G, {
		ref: b,
		className: "rich-text",
		justifyContent: "space-between",
		width: "100%",
		maxWidth: "100%",
		height: c ? "100%" : "auto",
		position: "relative",
		direction: "column",
		overflow: "visible",
		children: /* @__PURE__ */ Y(d, {
			resolver: u,
			children: /* @__PURE__ */ X(de, {
				initialConfig: {
					namespace: "MARKDOWN_EDITOR",
					nodes: ee,
					editorState: () => {
						F(ft), S.importToLexical();
					},
					onError: (e) => console.error(e),
					editable: a,
					theme: v
				},
				children: [
					a ? /* @__PURE__ */ Y(lt, {}) : null,
					l ? /* @__PURE__ */ Y(rt, {
						anchors: l.anchors,
						targetId: l.targetId,
						onActiveSectionChange: p
					}) : null,
					t ? /* @__PURE__ */ Y(ze, {}) : null,
					/* @__PURE__ */ Y(ut, {}),
					/* @__PURE__ */ Y(Qe, {}),
					/* @__PURE__ */ Y(f, {}),
					/* @__PURE__ */ Y(oe, {}),
					a ? /* @__PURE__ */ Y(_, { maxIndent: 7 }) : null,
					/* @__PURE__ */ Y(Be, {}),
					a ? /* @__PURE__ */ Y(He, { transformers: ie }) : null,
					/* @__PURE__ */ Y(re, {}),
					/* @__PURE__ */ Y(ne, {}),
					/* @__PURE__ */ Y(ae, {}),
					/* @__PURE__ */ Y(xe, { anchorElem: C }),
					/* @__PURE__ */ Y(y, {}),
					/* @__PURE__ */ Y(ye, {
						contentEditable: /* @__PURE__ */ Y(ve, {
							fullWidth: i,
							padding: o,
							layerStyle: "markdownEditorInset",
							scrollable: c
						}),
						placeholder: s ? /* @__PURE__ */ Y(G, {
							position: "absolute",
							layerStyle: "markdownEditorInset",
							padding: o,
							top: "0",
							left: "0",
							right: "0",
							pointerEvents: "none",
							userSelect: "none",
							justifyContent: "center",
							children: /* @__PURE__ */ Y(V, {
								width: "100%",
								maxWidth: "45rem",
								color: "fg.muted",
								textStyle: "paragraph/M/regular",
								children: s
							})
						}) : null,
						ErrorBoundary: ue
					}),
					a && C ? /* @__PURE__ */ X(Ie, { children: [/* @__PURE__ */ Y(we, { anchorElem: C }), /* @__PURE__ */ Y(Ze, { anchorElem: C })] }) : null,
					te ? /* @__PURE__ */ Y(Te, {
						ignoreSelectionChange: !0,
						ignoreHistoryMergeTagChange: !1,
						onChange: (e, t, n) => {
							n.has(ft) || e.read(() => {
								let e = _e(), t = S.exportFromLexical(e);
								m?.(h + t);
							});
						}
					}) : null,
					/* @__PURE__ */ Y(Ee, { isEditable: a }),
					n && /* @__PURE__ */ Y(De, {})
				]
			})
		})
	});
}
export { dt as n, pt as t };
