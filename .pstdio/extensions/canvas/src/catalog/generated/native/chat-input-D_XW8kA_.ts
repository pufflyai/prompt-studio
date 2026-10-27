// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-up-DUoQ-jFn.ts";
import { t } from "./pause-C8r-dHaS.ts";
import { t as n } from "./scroll-area-I7hjn89T.ts";
import { t as r } from "./tooltip-BweQW627.ts";
import { n as i, r as a, t as o } from "./prompt-input-CCkHsRH6.ts";
import { r as s } from "./chat-question-navigation-DvO6NA0-.ts";
import { a as c, i as l, n as u, o as d, r as f, t as p } from "./use-question-prompt-state-DLGduPR4.ts";
import { useEffect as m, useRef as h, useState as g } from "react";
import { Box as _, Button as v, Flex as y, HStack as b, IconButton as x, Kbd as S, Text as C, defineSlotRecipe as w, useSlotRecipe as ee } from "@chakra-ui/react";
import { Fragment as T, jsx as E, jsxs as D } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-input-history.ts
var O = (e) => {
	let t = [];
	for (let n = e.length - 1; n >= 0; n--) {
		let r = e[n];
		if (r.role !== "user") continue;
		let i = r.parts.flatMap((e) => e.type === "text" ? [e.text] : []).join("");
		i.trim() && t.push(i);
	}
	return t;
}, k = (e, t, n, r) => r === 0 ? null : e === null ? t === "previous" && n === "" ? { index: 0 } : null : t === "previous" ? { index: Math.min(e + 1, r - 1) } : { index: e === 0 ? null : e - 1 }, A = w({
	className: "ps-chat-composer",
	slots: ["input", "workspace"],
	base: {
		input: {
			position: "relative",
			width: "full",
			padding: "xs",
			bg: "bg",
			borderRadius: "xs",
			_focusWithin: {
				outline: "{borders.accent-light}",
				outlineOffset: "-1px"
			}
		},
		workspace: {
			display: "flex",
			flexDirection: "column",
			gap: "0"
		}
	},
	variants: {
		attachedToTop: { true: { input: { borderTopRadius: "0" } } },
		workspace: { true: { workspace: {
			padding: "2xs",
			borderRadius: "xs",
			bg: "bg.muted"
		} } }
	}
}), j = (e = "") => JSON.stringify(i(e)), M = (e) => e.trim().length > 0, te = (e) => {
	let { canSubmit: t, isDisabled: n, text: r } = e;
	return n || !t || !M(r) ? "none" : "submit";
}, ne = (e) => {
	let { canInterrupt: t, canSubmit: n, hasQuestionPrompt: r, isDisabled: i, streaming: a, text: o } = e;
	return i ? "none" : n && M(o) ? "submit" : a && !r && t ? "interrupt" : "none";
}, N = (e, t = 200) => e.length > 0 && e.split(/\r\n|\r|\n/).length > t, re = (e) => {
	let { onAttachFiles: t, onAttachText: n, textAttachmentPasteLineThreshold: r } = e;
	return {
		onDragOver: (e) => {
			t && Array.from(e.dataTransfer.types).includes("Files") && e.preventDefault();
		},
		onDropCapture: (e) => {
			let n = Array.from(e.dataTransfer.files ?? []);
			n.length !== 0 && t && (e.preventDefault(), t(n));
		},
		onPasteCapture: (e) => {
			let i = Array.from(e.clipboardData.files ?? []);
			if (i.length > 0 && t) {
				e.preventDefault(), t(i);
				return;
			}
			let a = e.clipboardData.getData("text/plain");
			n && N(a, r) && (e.preventDefault(), n(a));
		}
	};
}, P = (n) => {
	let { title: i, shortcut: a, canInterrupt: o, ...s } = n, c = s["aria-label"] ?? i, l = o ? /* @__PURE__ */ E(t, {
		size: 16,
		strokeWidth: 2,
		fill: "currentColor"
	}) : /* @__PURE__ */ E(e, {
		size: 16,
		strokeWidth: 2
	}), u = /* @__PURE__ */ E(x, {
		"data-testid": "send-message-button",
		size: "xs",
		variant: "primary",
		"aria-label": c,
		title: i,
		...s,
		children: l
	});
	return i ? /* @__PURE__ */ E(r, {
		content: a ? /* @__PURE__ */ D(T, { children: [
			i,
			" ",
			/* @__PURE__ */ E(S, {
				fontSize: "xs",
				children: a
			})
		] }) : i,
		closeDelay: 50,
		children: u
	}) : u;
}, F = (e) => {
	let { actions: t, submitActions: r, questionPrompt: i, skipDisabled: a, skipTitle: o, onSkip: s, buttonAction: c, submitTitle: l, submitLabel: u, messageTitle: d, runAction: f } = e;
	return /* @__PURE__ */ D(b, {
		gap: "1",
		minH: "7",
		align: "center",
		children: [
			/* @__PURE__ */ E(n, {
				flex: "1",
				minW: "0",
				showVerticalScrollbar: !1,
				showHorizontalScrollbar: !0,
				children: /* @__PURE__ */ E(b, {
					gap: "1",
					width: "max-content",
					minH: "7",
					children: t
				})
			}),
			r,
			i ? /* @__PURE__ */ E(v, {
				size: "xs",
				variant: "ghost",
				disabled: a,
				title: o,
				onClick: s,
				children: "Skip"
			}) : null,
			u ? /* @__PURE__ */ E(v, {
				size: "xs",
				variant: "primary",
				disabled: c === "none",
				onClick: () => f(c),
				children: u
			}) : /* @__PURE__ */ E(P, {
				canInterrupt: c === "interrupt",
				title: c === "interrupt" ? "Stop Response" : l ?? d,
				shortcut: c === "submit" ? "Enter" : void 0,
				onClick: () => f(c),
				disabled: c === "none"
			})
		]
	});
}, I = async (e) => {
	await e.onSubmit(e.text, e.response ? [] : e.attachments, e.response), e.response || e.onClearAttachments?.();
}, L = (e) => {
	let { prompt: t, actions: n, disabled: r, onSubmit: i } = e, a = p(t), o = s(), [c, m] = g(!1), _ = h(!1), y = async (e = !1) => {
		if (_.current || r || !e && a.hasMissingRequiredAnswer) return;
		_.current = !0, m(!0);
		let n = {
			selectedOptions: a.selectedOptionsByQuestion,
			customAnswers: a.customAnswersByQuestion
		}, o = e ? f : a.responseText, s = e ? l(t) : d(t, a.buildAnswers());
		a.reset();
		try {
			await i(o, s);
		} catch {
			a.restore(n.selectedOptions, n.customAnswers), _.current = !1, m(!1);
		}
	};
	return /* @__PURE__ */ D(T, { children: [/* @__PURE__ */ E(u, {
		isEditable: !r && !c,
		questionPrompt: t,
		selectedOptionsByQuestion: a.selectedOptionsByQuestion,
		customAnswersByQuestion: a.customAnswersByQuestion,
		onToggleOption: a.toggleOption,
		onToggleOther: a.toggleOther,
		onCustomAnswerChange: a.setCustomAnswer
	}), /* @__PURE__ */ E(F, {
		actions: /* @__PURE__ */ D(T, { children: [t.delivery === "async" && o ? /* @__PURE__ */ E(v, {
			size: "xs",
			variant: "ghost",
			disabled: c,
			onClick: o.close,
			children: "Back to message"
		}) : null, n] }),
		questionPrompt: !0,
		skipDisabled: r || c,
		skipTitle: "Skip this question and let the agent continue",
		onSkip: () => void y(!0),
		buttonAction: r || c || a.hasMissingRequiredAnswer || !a.responseText ? "none" : "submit",
		messageTitle: "Send answer",
		runAction: (e) => {
			e === "submit" && y();
		}
	})] });
}, R = (e) => {
	let { decision: t, disabled: n } = e, [r, i] = g(!1), a = h(!1), o = async (e) => {
		let r = t.actions.find((t) => t.id === e);
		if (!(a.current || n || t.pending || !r || r.disabled)) {
			a.current = !0, i(!0);
			try {
				await t.onAction(e);
			} catch {} finally {
				a.current = !1, i(!1);
			}
		}
	};
	return /* @__PURE__ */ D(y, {
		"aria-label": "Plan decision",
		align: "center",
		justify: "space-between",
		gap: "xs",
		wrap: "wrap",
		children: [
			t.controls,
			t.model ? /* @__PURE__ */ E(C, {
				textStyle: "label/S/regular",
				minH: "7",
				display: "flex",
				alignItems: "center",
				children: t.model
			}) : null,
			/* @__PURE__ */ E(b, {
				gap: "xs",
				marginStart: "auto",
				wrap: "wrap",
				justify: "end",
				children: t.actions.map((e) => /* @__PURE__ */ E(v, {
					size: "xs",
					variant: e.variant,
					disabled: n || r || t.pending || e.disabled,
					onClick: () => void o(e.id),
					children: e.label
				}, e.id))
			})
		]
	});
}, ie = (e) => {
	let { request: t, question: n, decision: r, actions: i, disabled: a, onSubmit: o } = e;
	return t?.kind === "decision" && r ? /* @__PURE__ */ E(R, {
		decision: r,
		disabled: a
	}, r.id) : t?.kind === "question" && n ? /* @__PURE__ */ E(L, {
		prompt: n,
		actions: i,
		disabled: a,
		onSubmit: o
	}, c(n)) : null;
}, ae = (e, t) => {
	let [n, r] = g(e || t !== 0), [i, a] = g({
		autoFocus: e,
		focusSignal: t
	});
	return (i.autoFocus !== e || i.focusSignal !== t) && (a({
		autoFocus: e,
		focusSignal: t
	}), (e && !i.autoFocus || t !== 0 && t !== i.focusSignal) && r(!0)), {
		requested: n,
		request: () => r(!0),
		complete: () => r(!1)
	};
}, oe = (e) => {
	let { recentUserMessages: t, text: n, blocked: r, resetKey: i, onChange: a } = e, o = h(null), s = h(null), c = t, l = JSON.stringify(c), u = JSON.stringify([
		l,
		i,
		r
	]), d = h(u);
	m(() => {
		d.current !== u && (d.current = u, s.current = null);
	}, [u]);
	let f = () => {
		s.current = null;
	}, p = (e) => {
		s.current !== null && e !== c[s.current] && f(), a(e);
	}, g = (e) => {
		if (r) return !1;
		let t = k(s.current, e, n, c.length);
		if (!t) return !1;
		s.current = t.index;
		let i = t.index === null ? "" : c[t.index];
		return o.current?.setEditorValue(i), !0;
	};
	return {
		editorRef: o,
		reset: f,
		change: p,
		recallPrevious: () => g("previous"),
		recallNext: () => g("next")
	};
}, se = (e) => {
	let [t, n] = g(e), [r, i] = g(e), [o, s] = g(0), [c, l] = g(() => a(e)), u = (e) => {
		i(e), s((e) => e + 1);
	};
	if (t !== e) {
		n(e);
		let t = a(e);
		t !== a(r) && (u(e), l(t));
	}
	return {
		editorKey: o,
		editorState: r,
		remountEditor: u,
		setEditorState: i,
		setText: l,
		text: c
	};
}, z = (e, t, n) => {
	let r = [];
	return e && r.push({
		kind: "question",
		id: e.callId ?? c(e)
	}), t && r.push({
		kind: "decision",
		id: t.id
	}), r.find((e) => e.kind === n?.kind && e.id === n.id) ?? r[0];
}, ce = (e, t) => {
	let [n, r] = g(), i = z(e, t, n);
	return (i?.kind !== n?.kind || i?.id !== n?.id) && r(i), i;
}, le = (e) => {
	let { placeholder: t } = e;
	return t ? /* @__PURE__ */ E(C, {
		textStyle: "label/M/regular",
		color: "fg.subtle",
		pointerEvents: "none",
		position: "absolute",
		top: "0",
		children: t
	}) : null;
}, B = (e) => {
	let { defaultState: t, recentUserMessages: r = [], onSubmit: i = () => {}, onInterrupt: a, onAttachFiles: s, onAttachText: c, textAttachmentPasteLineThreshold: l = 200, streaming: u = !1, attachedResources: d = [], onClearAttachments: f, isDisabled: p = !1, submitDisabled: m = !1, onChange: h, placeholder: v, attachmentList: b, actions: x, submitActions: S, attachmentActions: C, attachedToTop: w = !1, questionPrompt: O, decision: k, autoFocus: M = !1, focusSignal: N = 0, submitTitle: P, submitLabel: L, initialSelection: R, onSelectionChange: z, onEditorStateChange: B, retainTextUntilAcknowledged: V = !1, commands: ue = [] } = e, H = ce(O, k), U = !!H, de = ee({ recipe: A })({ attachedToTop: w }), [W, G] = g(!1), { editorKey: K, editorState: fe, remountEditor: pe, setEditorState: me, setText: he, text: q } = se(t), J = ae(M, N), Y = oe({
		recentUserMessages: r,
		text: q,
		blocked: p || W || U,
		resetKey: String(K),
		onChange: (e) => {
			he(e), h?.(e);
		}
	}), ge = (e) => {
		let t = e.target;
		t instanceof Element && e.currentTarget.contains(t) && (t.closest("button, input, textarea, select, a, label, [role=button], [role=combobox]") || U || J.request());
	}, X = (e) => {
		pe(j(e)), Y.change(e);
	}, _e = !p && !W && !m && !U, Z = {
		canInterrupt: !U && !!a,
		canSubmit: !m && !U,
		hasQuestionPrompt: U,
		isDisabled: p || W,
		streaming: u,
		text: q
	}, ve = ne(Z), ye = u ? "Queue message" : "Send message", be = async () => {
		if (!_e || !q.trim()) return;
		let e = q;
		Y.reset(), G(!0), V || X("");
		try {
			await I({
				text: q.trim(),
				attachments: d,
				onSubmit: i,
				onClearAttachments: f
			});
		} catch {
			V || X(e);
		} finally {
			G(!1), J.request();
		}
	}, Q = (e) => {
		e === "interrupt" && a?.(), e === "submit" && be();
	}, $ = re({
		onAttachFiles: s,
		onAttachText: c,
		textAttachmentPasteLineThreshold: l
	});
	return /* @__PURE__ */ E(_, {
		className: "ps-chat-composer__input",
		css: de.input,
		onPasteCapture: U ? void 0 : $.onPasteCapture,
		onDropCapture: U ? void 0 : $.onDropCapture,
		onDragOver: U ? void 0 : $.onDragOver,
		onClick: ge,
		children: /* @__PURE__ */ D(y, {
			direction: "column",
			color: "fg",
			gap: "xs",
			children: [
				/* @__PURE__ */ E(ie, {
					request: H,
					question: O,
					decision: k,
					actions: x,
					disabled: p,
					onSubmit: (e, t) => I({
						text: e,
						response: t,
						attachments: d,
						onSubmit: i,
						onClearAttachments: f
					})
				}),
				/* @__PURE__ */ D(_, {
					display: U ? "none" : void 0,
					children: [b ? /* @__PURE__ */ E(_, {
						mb: "xs",
						children: b
					}) : null, /* @__PURE__ */ E(n, {
						maxH: "10rem",
						showHorizontalScrollbar: !1,
						contentProps: { pr: "2xs" },
						children: /* @__PURE__ */ E(y, {
							minH: "7",
							align: "center",
							children: /* @__PURE__ */ E(o, {
								ref: Y.editorRef,
								onRecallPrevious: Y.recallPrevious,
								onRecallNext: Y.recallNext,
								defaultState: fe,
								initialSelection: R,
								onSelectionChange: z,
								isEditable: !p && !W && !U,
								focusRequested: J.requested,
								onFocusRequestComplete: J.complete,
								placeholder: /* @__PURE__ */ E(le, { placeholder: v }),
								onChange: (e, t) => {
									me(JSON.stringify(t)), B?.(e, JSON.stringify(t)), Y.change(e);
								},
								onSubmit: () => Q(te(Z)),
								commands: ue
							}, K)
						})
					})]
				}),
				U ? null : /* @__PURE__ */ E(F, {
					actions: /* @__PURE__ */ D(T, { children: [C, x] }),
					questionPrompt: !1,
					skipDisabled: !1,
					skipTitle: "",
					onSkip: () => {},
					buttonAction: ve,
					submitTitle: P,
					submitLabel: L,
					submitActions: S,
					messageTitle: ye,
					runAction: Q
				})
			]
		})
	});
};
export { O as i, j as n, A as r, B as t };
