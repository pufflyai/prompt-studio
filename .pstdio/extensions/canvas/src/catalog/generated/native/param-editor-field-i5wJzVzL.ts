// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-down-ZmPqsMG0.ts";
import { t } from "./circle-alert-DphG-Ztw.ts";
import { t as n } from "./circle-check-QpR5K4qp.ts";
import { t as r } from "./clock-3-9usms91c.ts";
import { t as i } from "./paperclip-CoBJq1oI.ts";
import { t as a } from "./plus-CYkLGSPS.ts";
import { t as o } from "./x-DqEAa6-d.ts";
import { n as s } from "./resource-badge-Cd8iYFfh.ts";
import { t as c } from "./icon-options-BaFkbkcp.ts";
import { t as l } from "./param-editor-label-BDQjmLHj.ts";
import { n as u, t as d } from "./number-input-BAmIOgl0.ts";
import { t as f } from "./switch-CVOnzlSE.ts";
import { n as p, t as m } from "./action-input-C37MJkHd.ts";
import { t as h } from "./param-editor-read-only-value-c3lD-see.ts";
import { t as g } from "./color-input-CUqRZDIf.ts";
import { t as _ } from "./lazy-markdown-editor-4KH7GIyW.ts";
import { t as v } from "./slider-D0nsFAm5.ts";
import { t as y } from "./chip-f4wDKYyh.ts";
import { n as b, t as x } from "./selection-menu-DxyS5y7W.ts";
import { t as S } from "./selection-input-C8HKweBU.ts";
import { useEffect as C, useRef as w, useState as T } from "react";
import { Badge as E, Box as D, Button as O, Flex as k, Grid as A, Group as j, HStack as M, Icon as N, IconButton as P, Image as F, Input as I, Popover as L, Spinner as ee, Stack as R, Text as z, Textarea as B, Wrap as V, chakra as te } from "@chakra-ui/react";
import { jsx as H, jsxs as U } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/inputs/boolean-input.tsx
var ne = (e) => {
	let { id: t, name: n, description: r, defaultValue: i, onChange: a, readOnly: o, hideLabel: s, fullWidth: c, size: l = "sm" } = e, [u, d] = T(i);
	return C(() => {
		d(i);
	}, [i]), o ? /* @__PURE__ */ H(p, {
		name: n,
		description: r,
		hideLabel: s,
		fullWidth: c,
		orientation: "inline",
		children: /* @__PURE__ */ H(h, { children: String(u) })
	}) : /* @__PURE__ */ H(p, {
		name: n,
		description: r,
		hideLabel: s,
		fullWidth: c,
		orientation: "inline",
		children: /* @__PURE__ */ H(f, {
			size: l,
			checked: u,
			inputProps: { "aria-label": n },
			onCheckedChange: (e) => {
				d(e.checked), a(t, e.checked);
			}
		})
	});
}, re = /^(\d{4})-(\d{2})-(\d{2})$/, ie = (e) => {
	let t = re.exec(e);
	if (t) {
		let [, e, n, r] = t;
		return new Intl.DateTimeFormat(void 0, { dateStyle: "medium" }).format(new Date(Number(e), Number(n) - 1, Number(r)));
	}
	let n = new Date(e);
	return Number.isNaN(n.getTime()) ? e : new Intl.DateTimeFormat(void 0, {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(n);
}, ae = (e) => {
	let { id: t, defaultValue: n, name: r, min: i, max: a, onChange: o, description: s, readOnly: c, hideLabel: u = !1, fullWidth: d = !1, size: f = "sm" } = e, [p, m] = T(n), g = w(null), _ = (e) => {
		g.current && clearTimeout(g.current), g.current = setTimeout(() => o(t, e), 540);
	};
	C(() => {
		m(n);
	}, [n]);
	let v = (e) => {
		m(e), _(e);
	};
	if (c) {
		let e = /* @__PURE__ */ H(h, { children: ie(p) });
		return d ? /* @__PURE__ */ U(D, { children: [!u && /* @__PURE__ */ H(D, {
			mb: "xs",
			children: /* @__PURE__ */ H(l, {
				name: r,
				description: s
			})
		}), e] }) : /* @__PURE__ */ H(D, { children: /* @__PURE__ */ U(k, {
			alignItems: "center",
			justifyContent: "space-between",
			minHeight: "2rem",
			gap: "xs",
			children: [!u && /* @__PURE__ */ H(l, {
				name: r,
				description: s
			}), e]
		}) });
	}
	return /* @__PURE__ */ H(D, { children: d ? /* @__PURE__ */ U(D, { children: [!u && /* @__PURE__ */ H(D, {
		mb: "xs",
		children: /* @__PURE__ */ H(l, {
			name: r,
			description: s
		})
	}), /* @__PURE__ */ H(I, {
		className: "nodrag",
		readOnly: c,
		width: "100%",
		size: f,
		type: "date",
		placeholder: u ? r : void 0,
		value: p,
		min: i,
		max: a,
		onChange: (e) => v(e.target.value),
		onKeyUp: (e) => {
			e.key === "Enter" && e.currentTarget.blur();
		}
	})] }) : /* @__PURE__ */ U(k, {
		alignItems: "center",
		justifyContent: "space-between",
		minHeight: "2rem",
		gap: "xs",
		children: [!u && /* @__PURE__ */ H(l, {
			name: r,
			description: s
		}), /* @__PURE__ */ H(I, {
			className: "nodrag",
			readOnly: c,
			width: "8.75rem",
			size: f,
			type: "date",
			placeholder: u ? r : void 0,
			value: p,
			min: i,
			max: a,
			onChange: (e) => v(e.target.value),
			onKeyUp: (e) => {
				e.key === "Enter" && e.currentTarget.blur();
			}
		})]
	}) });
}, oe = (e) => {
	let { id: t, defaultValue: n, name: r, onChange: i, description: a, readOnly: o, hideLabel: s = !1, size: c = "sm" } = e, [u, d] = T(n), [f, p] = T(!1), m = w(null), g = (e) => {
		m.current && clearTimeout(m.current), m.current = setTimeout(() => i(t, e), 540);
	};
	C(() => {
		d(n);
	}, [n]);
	let _ = (e) => {
		d(e), g(e);
	};
	return o ? /* @__PURE__ */ H(D, {
		position: "relative",
		flex: "1",
		minW: "12.5rem",
		children: /* @__PURE__ */ U(k, {
			alignItems: "center",
			justifyContent: "space-between",
			minHeight: "2rem",
			gap: "xs",
			children: [!s && /* @__PURE__ */ H(l, {
				name: r,
				description: a
			}), /* @__PURE__ */ H(h, {
				preserveWhitespace: !0,
				children: u
			})]
		})
	}) : /* @__PURE__ */ H(D, {
		position: "relative",
		flex: "1",
		minW: "12.5rem",
		children: /* @__PURE__ */ H(D, {
			position: "relative",
			minHeight: "2rem",
			children: f ? /* @__PURE__ */ U(D, {
				position: "absolute",
				top: "0",
				left: "0",
				right: "0",
				zIndex: "10",
				bg: "bg",
				borderWidth: "1px",
				borderStyle: "solid",
				borderColor: "border",
				borderRadius: "lg",
				p: "2",
				transition: "border-color 0.2s ease-in-out",
				boxShadow: "none",
				_hover: { borderColor: "border.accent-light" },
				_active: { borderColor: "border.accent-light" },
				_focusWithin: {
					borderColor: "border.accent-light",
					boxShadow: "none"
				},
				children: [!s && /* @__PURE__ */ H(D, {
					mb: "sm",
					children: /* @__PURE__ */ H(l, {
						name: r,
						description: a
					})
				}), /* @__PURE__ */ H(B, {
					"aria-label": r,
					className: "nodrag",
					readOnly: o,
					width: "100%",
					size: c,
					placeholder: s ? r : void 0,
					value: u,
					onChange: (e) => _(e.target.value),
					onBlur: () => {
						u.trim().length === 0 && p(!1);
					},
					onKeyDown: (e) => {
						e.key === "Escape" && (p(!1), e.preventDefault());
					},
					rows: 3,
					resize: "vertical",
					autoFocus: !0
				})]
			}) : /* @__PURE__ */ U(k, {
				alignItems: "center",
				justifyContent: "space-between",
				height: "2rem",
				gap: "xs",
				children: [!s && /* @__PURE__ */ H(l, {
					name: r,
					description: a
				}), /* @__PURE__ */ H(I, {
					"aria-label": r,
					className: "nodrag",
					readOnly: o,
					flex: "1",
					maxW: "12.5rem",
					size: c,
					type: "text",
					placeholder: s ? r : void 0,
					value: u,
					onClick: () => {
						o || p(!0);
					},
					onChange: (e) => _(e.target.value),
					onKeyUp: (e) => {
						e.key === "Enter" && e.currentTarget.blur();
					}
				})]
			})
		})
	});
}, se = (e) => {
	let { id: t, name: n, description: r, defaultValue: i, placeholder: a, onChange: o, readOnly: s, presentation: c = "stacked", size: u = "sm" } = e, [d, f] = T(i), [p, m] = T(!1);
	C(() => {
		f(i);
	}, [i]);
	let g = (e) => {
		f(e), o(t, e);
	}, v = (e) => /* @__PURE__ */ H(D, {
		borderWidth: "1px",
		borderColor: "border",
		borderRadius: "xs",
		minH: "7rem",
		minW: "0",
		overflow: "visible",
		width: "full",
		children: /* @__PURE__ */ H(_, {
			defaultState: e,
			isEditable: !s,
			placeholder: a,
			scrollable: !1,
			onChange: g
		})
	});
	return c === "horizontal" ? s ? /* @__PURE__ */ H(D, {
		position: "relative",
		flex: "1",
		minW: "12.5rem",
		children: /* @__PURE__ */ H(k, {
			alignItems: "center",
			minHeight: "2rem",
			children: /* @__PURE__ */ H(h, {
				preserveWhitespace: !0,
				children: d
			})
		})
	}) : /* @__PURE__ */ H(D, {
		position: "relative",
		flex: "1",
		minW: "12.5rem",
		children: /* @__PURE__ */ H(D, {
			position: "relative",
			minHeight: "2rem",
			children: p ? /* @__PURE__ */ H(D, {
				position: "absolute",
				top: "0",
				left: "0",
				right: "0",
				zIndex: "10",
				bg: "bg",
				borderWidth: "1px",
				borderColor: "border",
				borderRadius: "lg",
				p: "2",
				transition: "border-color 0.2s ease-in-out",
				_hover: { borderColor: "border.accent-light" },
				_focusWithin: { borderColor: "border.accent-light" },
				onKeyDown: (e) => {
					e.key === "Escape" && (m(!1), e.preventDefault());
				},
				children: v(d)
			}) : /* @__PURE__ */ H(I, {
				className: "nodrag",
				flex: "1",
				maxW: "12.5rem",
				size: u,
				type: "text",
				placeholder: n,
				value: d,
				onClick: () => {
					m(!0);
				},
				onChange: (e) => g(e.target.value)
			})
		})
	}) : /* @__PURE__ */ U(R, {
		gap: "xs",
		minW: "0",
		width: "full",
		children: [/* @__PURE__ */ H(l, {
			name: n,
			description: r
		}), v(d)]
	});
}, W = (e) => {
	let { id: t, defaultValue: n, name: r, step: i = 1, min: a, max: o, onChange: s, description: c, readOnly: f, hideLabel: p = !1, hideSlider: m = !1, fullWidth: g = !1, size: _ = "sm" } = e, [y, b] = T(n), x = a !== void 0 && o !== void 0 && !m, S = g && !x, E = w(null), O = w(null), A = (e) => {
		E.current && clearTimeout(E.current), O.current = e, E.current = setTimeout(() => {
			O.current = null, s(t, e);
		}, 540);
	}, j = () => {
		if (O.current === null) return;
		E.current && clearTimeout(E.current);
		let e = O.current;
		O.current = null, s(t, e);
	};
	if (C(() => {
		b(n);
	}, [n]), f) {
		let e = /* @__PURE__ */ H(h, { children: y });
		return g ? /* @__PURE__ */ U(D, { children: [!p && /* @__PURE__ */ H(D, {
			mb: "xs",
			children: /* @__PURE__ */ H(l, {
				name: r,
				description: c
			})
		}), e] }) : /* @__PURE__ */ H(D, { children: /* @__PURE__ */ U(k, {
			alignItems: "center",
			justifyContent: "space-between",
			minHeight: "2rem",
			gap: "xs",
			children: [!p && /* @__PURE__ */ H(l, {
				name: r,
				description: c
			}), e]
		}) });
	}
	return /* @__PURE__ */ U(D, { children: [S ? /* @__PURE__ */ U(D, { children: [!p && /* @__PURE__ */ H(D, {
		mb: "xs",
		children: /* @__PURE__ */ H(l, {
			name: r,
			description: c
		})
	}), /* @__PURE__ */ H(u, {
		disabled: f,
		width: "100%",
		size: _,
		value: `${y}`,
		step: i,
		min: a,
		max: o,
		onValueChange: (e) => {
			let t = Number.isNaN(e.valueAsNumber) ? a ?? 0 : e.valueAsNumber;
			b(t), A(t);
		},
		children: /* @__PURE__ */ H(d, {
			className: "nodrag",
			readOnly: f,
			placeholder: p ? r : void 0,
			onBlur: j,
			onKeyUp: (e) => {
				e.key === "Enter" && e.currentTarget.blur();
			}
		})
	})] }) : /* @__PURE__ */ U(k, {
		alignItems: "center",
		justifyContent: "space-between",
		minHeight: "2rem",
		gap: "xs",
		children: [!p && /* @__PURE__ */ H(l, {
			name: r,
			description: c
		}), /* @__PURE__ */ H(u, {
			disabled: f,
			width: "5rem",
			size: _,
			value: `${y}`,
			step: i,
			min: a,
			max: o,
			onValueChange: (e) => {
				let t = Number.isNaN(e.valueAsNumber) ? a ?? 0 : e.valueAsNumber;
				b(t), A(t);
			},
			children: /* @__PURE__ */ H(d, {
				className: "nodrag",
				readOnly: f,
				placeholder: p ? r : void 0,
				onBlur: j,
				onKeyUp: (e) => {
					e.key === "Enter" && e.currentTarget.blur();
				}
			})
		})]
	}), x && /* @__PURE__ */ H(v, {
		disabled: f,
		value: [y],
		step: i,
		min: a,
		max: o,
		onValueChange: (e) => {
			b(e.value[0]);
		},
		onValueChangeEnd: (e) => {
			s(t, e.value[0]);
		}
	})] });
}, ce = (e) => /* @__PURE__ */ H(N, {
	as: c(e.icon),
	boxSize: "14px",
	color: e.color ? `${e.color}.500` : "fg.muted"
}), le = (e) => window.open(e, "_blank", "noreferrer"), ue = (e) => void navigator.clipboard?.writeText(e).catch(() => void 0), de = (e) => {
	let { option: t, onOpenResource: n, onRemove: r } = e;
	if (!(t.href || t.ref || t.copyText)) return /* @__PURE__ */ H(y, { children: t.name });
	let i;
	return t.href && t.href.length > 0 ? i = () => le(t.href) : t.ref && n ? i = () => n(t.ref) : t.copyText && (i = () => ue(t.copyText)), /* @__PURE__ */ H(s, {
		fileName: t.name,
		icon: ce(t),
		size: "md",
		onSelect: i ? () => i() : void 0,
		onRemove: r ? () => r() : void 0
	});
}, G = (e) => {
	let { options: t, onOpenResource: n, onRemove: r, emptyText: i } = e;
	return t.length === 0 ? /* @__PURE__ */ H(z, {
		textStyle: "label/S/regular",
		color: "fg.muted",
		children: i ?? "None"
	}) : /* @__PURE__ */ H(V, {
		gap: "2xs",
		children: t.map((e) => /* @__PURE__ */ H(de, {
			option: e,
			onOpenResource: n,
			onRemove: r ? () => r(e.id) : void 0
		}, e.id))
	});
}, fe = (e) => Array.isArray(e) ? e : e ? [e] : [], pe = (e, t) => e.map((e) => t.find((t) => t.id === e)).filter((e) => !!e), K = (e) => {
	let { fullWidth: t, label: n, control: r, presentation: i } = e;
	return i === "horizontal" ? /* @__PURE__ */ U(R, {
		gap: "2xs",
		alignItems: "start",
		minW: "0",
		children: [n, r]
	}) : t ? /* @__PURE__ */ U(D, { children: [/* @__PURE__ */ H(D, {
		mb: "xs",
		children: n
	}), r] }) : /* @__PURE__ */ U(k, {
		alignItems: "center",
		justifyContent: "space-between",
		minHeight: "2rem",
		gap: "xs",
		children: [n, r]
	});
}, q = (e) => {
	let { triggerLabel: t, options: n, selectedIds: r, multiSelect: i, triggerVariant: a, triggerAriaLabel: o, size: s, onToggle: c } = e;
	return /* @__PURE__ */ H(x, {
		triggerLabel: t,
		options: n,
		selectedIds: r,
		multiSelect: i,
		reselectable: !0,
		triggerVariant: a,
		triggerAriaLabel: o,
		size: s,
		onToggle: c
	});
}, me = (e) => {
	let { id: t, name: n, description: r, defaultValue: i, options: o, onChange: s, onOpenResource: c, readOnly: u, editable: d = !1, multiSelect: f = !1, placeholder: p, emptyText: m, fullWidth: h = !1, presentation: g = "stacked", size: _ = "sm" } = e, [v, y] = T(i);
	C(() => {
		y(i);
	}, [i]);
	let x = (e) => {
		y(e), s(t, e);
	}, S = fe(v), w = pe(S, o), E = d && !u, D = /* @__PURE__ */ H(l, {
		name: n,
		description: r,
		compact: g === "horizontal"
	});
	if (!E) return /* @__PURE__ */ H(K, {
		fullWidth: h,
		label: D,
		presentation: g,
		control: /* @__PURE__ */ H(G, {
			options: w,
			onOpenResource: c,
			emptyText: m
		})
	});
	let O = (e) => {
		if (f) {
			let t = S.includes(e) ? S.filter((t) => t !== e) : [...S, e];
			x(t);
			return;
		}
		let t = S.includes(e) ? "" : e;
		x(t);
	}, A = (e) => {
		let t = S.filter((t) => t !== e);
		x(t);
	};
	if (f) {
		let e = /* @__PURE__ */ U(k, {
			gap: "2xs",
			alignItems: "center",
			flexWrap: "wrap",
			minW: "0",
			children: [w.length > 0 ? /* @__PURE__ */ H(G, {
				options: w,
				onOpenResource: c,
				onRemove: A,
				emptyText: m
			}) : null, /* @__PURE__ */ H(q, {
				triggerLabel: /* @__PURE__ */ H(N, {
					as: a,
					boxSize: "12px"
				}),
				options: o,
				selectedIds: S,
				multiSelect: !0,
				triggerVariant: "icon",
				triggerAriaLabel: p ?? `Add ${n}`,
				size: _,
				onToggle: O
			})]
		});
		return /* @__PURE__ */ H(K, {
			fullWidth: h,
			label: D,
			control: e,
			presentation: g
		});
	}
	let j = w[0], M = j ? /* @__PURE__ */ U(k, {
		align: "center",
		gap: "2xs",
		minW: "0",
		children: [b(j, "14px"), j.name]
	}) : p ?? "Select";
	return /* @__PURE__ */ H(K, {
		fullWidth: h,
		label: D,
		presentation: g,
		control: /* @__PURE__ */ H(q, {
			triggerLabel: M,
			options: o,
			selectedIds: S,
			multiSelect: !1,
			size: _,
			onToggle: O
		})
	});
}, J = (e) => {
	let { id: t, defaultValue: n, name: r, onChange: i, description: a, readOnly: o, singleLine: s = !0, hideLabel: c = !1, fullWidth: u = !1, size: d = "sm" } = e, [f, p] = T(n), m = w(null), g = (e) => {
		m.current && clearTimeout(m.current), m.current = setTimeout(() => i(t, e), 540);
	};
	C(() => {
		p(n);
	}, [n]);
	let _ = (e) => {
		p(e), g(e);
	}, v = () => {
		m.current && (clearTimeout(m.current), m.current = null, i(t, f));
	};
	if (o) {
		let e = /* @__PURE__ */ H(h, {
			preserveWhitespace: !s,
			children: f
		});
		return s && !u ? /* @__PURE__ */ H(D, { children: /* @__PURE__ */ U(k, {
			alignItems: "center",
			justifyContent: "space-between",
			minHeight: "2rem",
			gap: "xs",
			children: [!c && /* @__PURE__ */ H(l, {
				name: r,
				description: a
			}), e]
		}) }) : /* @__PURE__ */ U(D, {
			width: "full",
			minW: "0",
			children: [!c && /* @__PURE__ */ H(D, {
				mb: "xs",
				children: /* @__PURE__ */ H(l, {
					name: r,
					description: a
				})
			}), e]
		});
	}
	return /* @__PURE__ */ H(D, {
		width: "full",
		minW: "0",
		children: s && !u ? /* @__PURE__ */ U(k, {
			alignItems: "center",
			justifyContent: "space-between",
			minHeight: "2rem",
			gap: "xs",
			children: [!c && /* @__PURE__ */ H(l, {
				name: r,
				description: a
			}), /* @__PURE__ */ H(I, {
				"aria-label": r,
				className: "nodrag",
				readOnly: o,
				flex: "1",
				maxW: "12.5rem",
				size: d,
				type: "text",
				placeholder: c ? r : void 0,
				value: f,
				onChange: (e) => _(e.target.value),
				onBlur: v,
				onKeyUp: (e) => {
					e.key === "Enter" && e.currentTarget.blur();
				}
			})]
		}) : /* @__PURE__ */ U(D, { children: [!c && /* @__PURE__ */ H(D, {
			mb: "xs",
			children: /* @__PURE__ */ H(l, {
				name: r,
				description: a
			})
		}), s ? /* @__PURE__ */ H(I, {
			"aria-label": r,
			className: "nodrag",
			readOnly: o,
			width: "100%",
			size: d,
			type: "text",
			placeholder: c ? r : void 0,
			value: f,
			onChange: (e) => _(e.target.value),
			onBlur: v,
			onKeyUp: (e) => {
				e.key === "Enter" && e.currentTarget.blur();
			}
		}) : /* @__PURE__ */ H(B, {
			"aria-label": r,
			className: "nodrag",
			readOnly: o,
			width: "100%",
			size: d,
			placeholder: c ? r : void 0,
			value: f,
			onChange: (e) => _(e.target.value),
			onBlur: v,
			rows: 3,
			resize: "vertical"
		})] })
	});
}, he = [
	"top-left",
	"top",
	"top-right",
	"left",
	"center",
	"right",
	"bottom-left",
	"bottom",
	"bottom-right"
], ge = (e) => {
	let { id: t, name: n, description: r, defaultValue: i, onChange: a, readOnly: o, fullWidth: s } = e, [c, l] = T(i);
	C(() => {
		l(i);
	}, [i]);
	let u = (e) => {
		l(e), a(t, e);
	};
	if (o) return /* @__PURE__ */ H(p, {
		name: n,
		description: r,
		fullWidth: s,
		children: /* @__PURE__ */ H(h, { children: c })
	});
	let d = /* @__PURE__ */ H(A, {
		templateColumns: "repeat(3, 1.5rem)",
		gap: "1px",
		width: "fit-content",
		bg: "border.subtle",
		p: "1px",
		borderRadius: "sm",
		overflow: "hidden",
		children: he.map((e) => {
			let t = e === c;
			return /* @__PURE__ */ H(P, {
				"aria-label": e,
				"aria-pressed": t,
				size: "2xs",
				variant: "ghost",
				bg: t ? "fg" : "bg",
				_hover: { bg: t ? "fg" : "bg.muted" },
				borderRadius: "0",
				onClick: () => u(e),
				children: /* @__PURE__ */ H(D, {
					boxSize: "0.375rem",
					borderRadius: "full",
					bg: t ? "bg" : "fg.muted"
				})
			}, e);
		})
	});
	return /* @__PURE__ */ H(p, {
		name: n,
		description: r,
		orientation: s ? "stacked" : "inline",
		children: d
	});
}, _e = (e) => e.type.startsWith("image/"), ve = (e) => e < 1024 ? `${e.toString()} B` : e < 1048576 ? `${Math.round(e / 1024).toString()} KB` : `${(e / 1048576).toFixed(1)} MB`, Y = (e) => {
	let { file: t, removeLabel: n, disabled: r, onRemove: i } = e, [a, s] = T(null);
	C(() => {
		if (!_e(t)) return;
		let e = URL.createObjectURL(t);
		return s(e), () => URL.revokeObjectURL(e);
	}, [t]);
	let c = /* @__PURE__ */ H(z, {
		as: "span",
		textStyle: "label/XS/medium",
		lineClamp: 1,
		maxW: "180px",
		children: t.name
	});
	return /* @__PURE__ */ U(E, {
		variant: "chip",
		gap: "2xs",
		pr: "2xs",
		children: [
			a ? /* @__PURE__ */ U(L.Root, {
				positioning: { placement: "top" },
				children: [/* @__PURE__ */ H(L.Trigger, {
					asChild: !0,
					children: /* @__PURE__ */ H(te.button, {
						type: "button",
						cursor: "pointer",
						minW: "0",
						display: "inline-flex",
						children: c
					})
				}), /* @__PURE__ */ H(L.Positioner, { children: /* @__PURE__ */ H(L.Content, {
					w: "auto",
					p: "2xs",
					bg: "bg",
					children: /* @__PURE__ */ H(F, {
						src: a,
						alt: t.name,
						maxW: "240px",
						maxH: "240px",
						borderRadius: "sm"
					})
				}) })]
			}) : c,
			/* @__PURE__ */ H(z, {
				as: "span",
				textStyle: "label/XS/regular",
				color: "fg.subtle",
				children: ve(t.size)
			}),
			/* @__PURE__ */ H(P, {
				size: "2xs",
				variant: "ghost",
				"aria-label": n,
				disabled: r,
				onClick: i,
				children: /* @__PURE__ */ H(o, { size: 12 })
			})
		]
	});
}, ye = (e, t) => `${e.name}-${e.size.toString()}-${e.lastModified.toString()}-${t.toString()}`, be = (e, t, n) => {
	let r = n ? t.length : 0, i = e.map((e, t) => ({
		id: ye(e, r + t),
		file: e,
		status: "queued"
	}));
	return n ? [...t, ...i] : i.slice(0, 1);
}, xe = (e) => {
	let t = [
		"uploading",
		"error",
		"queued",
		"complete"
	].find((t) => e.some((e) => e.status === t)) ?? "empty";
	return {
		state: t,
		count: t === "empty" ? 0 : e.filter((e) => e.status === t).length
	};
}, Se = {
	queued: r,
	complete: n,
	error: t
}, Ce = (e) => {
	let { values: t } = e, n = xe(t);
	if (n.state === "empty") return null;
	let r = n.count === 1 ? "file" : "files", i = {
		queued: `${n.count.toString()} ${r} queued`,
		uploading: `Uploading ${n.count.toString()} ${r}`,
		complete: `${n.count.toString()} ${r} uploaded`,
		error: `${n.count.toString()} ${r} failed`,
		empty: ""
	}, a = n.state === "uploading" ? /* @__PURE__ */ H(ee, {
		boxSize: "12px",
		borderWidth: "1px"
	}) : /* @__PURE__ */ H(N, {
		as: Se[n.state],
		boxSize: "12px"
	});
	return /* @__PURE__ */ U(k, {
		alignItems: "center",
		gap: "2xs",
		color: n.state === "error" ? "fg.error" : "fg.muted",
		children: [a, /* @__PURE__ */ H(z, {
			textStyle: "label/XS/medium",
			children: i[n.state]
		})]
	});
}, we = (e) => {
	let { readOnly: t, values: n, onRemove: r } = e;
	return n.length === 0 ? null : /* @__PURE__ */ U(R, {
		gap: "2xs",
		minW: "0",
		children: [/* @__PURE__ */ H(Ce, { values: n }), /* @__PURE__ */ H(V, {
			gap: "2xs",
			children: n.map((e) => /* @__PURE__ */ H(Y, {
				file: e.file,
				disabled: t,
				removeLabel: `Remove ${e.file.name}`,
				onRemove: () => r(e.id)
			}, e.id))
		})]
	});
}, Te = (e) => {
	let { id: t, name: n, description: r, defaultValue: a, accept: o, multiple: s = !0, uploadLabel: c = "Attach files", onChange: l, readOnly: u, presentation: d = "stacked" } = e, [f, m] = T(a), h = w(null);
	C(() => {
		m(a);
	}, [a]);
	let g = (e) => {
		m(e), l(t, e);
	}, _ = (e) => g(f.filter((t) => t.id !== e)), v = u ? null : /* @__PURE__ */ U(O, {
		size: "xs",
		variant: "ghost",
		flexShrink: 0,
		onClick: () => h.current?.click(),
		children: [/* @__PURE__ */ H(N, {
			as: i,
			boxSize: "14px"
		}), c]
	}), y = /* @__PURE__ */ H("input", {
		ref: h,
		hidden: !0,
		type: "file",
		accept: o,
		multiple: s,
		onChange: (e) => {
			g(be(Array.from(e.currentTarget.files ?? []), f, s)), e.currentTarget.value = "";
		}
	});
	return d === "horizontal" ? /* @__PURE__ */ U(k, {
		alignItems: "center",
		gap: "sm",
		minW: "0",
		width: "full",
		children: [
			y,
			v,
			/* @__PURE__ */ H(we, {
				readOnly: u,
				values: f,
				onRemove: _
			})
		]
	}) : /* @__PURE__ */ H(p, {
		name: n,
		description: r,
		orientation: "stacked",
		children: /* @__PURE__ */ U(R, {
			alignItems: "start",
			gap: "xs",
			minW: "0",
			children: [
				y,
				v,
				/* @__PURE__ */ H(we, {
					readOnly: u,
					values: f,
					onRemove: _
				})
			]
		})
	});
}, X = (e, t, n) => {
	let r = Math.min(t, n), i = Math.max(t, n);
	return e < r ? r : e > i ? i : e;
}, Ee = (e, t, n = 0) => t > 0 ? n + Math.round((e - n) / t) * t : e, De = (e, t) => {
	let n = Number.isInteger(e) ? `${e}` : `${Number(e.toFixed(3))}`;
	return t ? `${n}${t}` : n;
}, Z = (e, t, n, r) => {
	let i = X(e[0], t, n), a = X(e[1], t, n), o = Math.min(i, a), s = Math.max(i, a);
	return r && r > 0 && (o = X(Ee(o, r, t), t, n), s = X(Ee(s, r, t), t, n)), [o, s];
}, Oe = (e) => {
	let { count: t } = e;
	if (!t || t < 2) return null;
	let n = Array.from({ length: t }, (e, n) => n / (t - 1));
	return /* @__PURE__ */ H(k, {
		justifyContent: "space-between",
		mt: "2xs",
		"aria-hidden": "true",
		children: n.map((e) => /* @__PURE__ */ H(D, {
			width: "1px",
			height: "0.375rem",
			bg: "border.subtle"
		}, e))
	});
}, ke = (t) => {
	let { id: n, name: r, description: i, defaultValue: a, min: o, max: s, step: c = 1, unit: l, markerCount: u, onChange: d, readOnly: f, fullWidth: m, presentation: g = "stacked" } = t, [_, y] = T(() => Z(a, o, s, c));
	C(() => {
		y(Z(a, o, s, c));
	}, [
		a,
		o,
		s,
		c
	]);
	let b = `${De(_[0], l)} – ${De(_[1], l)}`, x = g === "horizontal";
	if (f) return x ? /* @__PURE__ */ H(h, { children: b }) : /* @__PURE__ */ H(p, {
		name: r,
		description: i,
		fullWidth: m,
		children: /* @__PURE__ */ H(h, { children: b })
	});
	let S = /* @__PURE__ */ H(z, {
		textStyle: "label/S/regular",
		color: "fg.muted",
		whiteSpace: "nowrap",
		children: b
	}), w = /* @__PURE__ */ U(D, { children: [/* @__PURE__ */ H(v, {
		size: "sm",
		value: _,
		min: o,
		max: s,
		step: c,
		onValueChange: (e) => y(Z(e.value, o, s, c)),
		onValueChangeEnd: (e) => {
			let t = Z(e.value, o, s, c);
			y(t), d(n, t);
		}
	}), /* @__PURE__ */ H(Oe, { count: u })] });
	return x ? /* @__PURE__ */ U(L.Root, {
		positioning: {
			placement: "bottom-start",
			offset: { mainAxis: 4 }
		},
		children: [/* @__PURE__ */ H(L.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ U(O, {
				size: "xs",
				variant: "ghost",
				"aria-label": `${r}: ${b}`,
				children: [b, /* @__PURE__ */ H(N, {
					as: e,
					boxSize: "14px"
				})]
			})
		}), /* @__PURE__ */ H(L.Positioner, { children: /* @__PURE__ */ H(L.Content, {
			width: "60",
			padding: "sm",
			background: "bg",
			children: /* @__PURE__ */ U(R, {
				gap: "xs",
				children: [/* @__PURE__ */ U(k, {
					alignItems: "center",
					justifyContent: "space-between",
					gap: "xs",
					children: [/* @__PURE__ */ H(z, {
						textStyle: "label/S/medium",
						children: r
					}), S]
				}), w]
			})
		}) })]
	}) : /* @__PURE__ */ H(p, {
		name: r,
		description: i,
		orientation: "stacked",
		labelTrailing: S,
		children: w
	});
}, Ae = (e) => {
	let { id: t, name: n, description: r, defaultValue: i, options: a, variant: o = "default", onChange: s, readOnly: c, fullWidth: l, presentation: u = "stacked" } = e, [d, f] = T(i);
	C(() => {
		f(i);
	}, [i]);
	let m = (e) => {
		f(e), s(t, e);
	}, g = a.find((e) => e.id === d)?.name ?? d, _ = u === "horizontal";
	if (c) return /* @__PURE__ */ H(p, {
		name: n,
		description: r,
		hideLabel: _,
		fullWidth: l,
		children: /* @__PURE__ */ H(h, { children: g })
	});
	if (_) return /* @__PURE__ */ H(x, {
		triggerLabel: g,
		options: a,
		selectedIds: [d],
		multiSelect: !1,
		onToggle: m
	});
	let v = /* @__PURE__ */ H(j, {
		attached: !0,
		width: "full",
		borderWidth: "1px",
		borderColor: "border",
		borderRadius: "xs",
		overflow: "hidden",
		transition: "border-color 0.2s ease-in-out",
		_hover: { borderColor: "border.accent-light" },
		_active: { borderColor: "border.accent-light" },
		_focusWithin: {
			borderColor: "border.accent-light",
			boxShadow: "none"
		},
		children: a.map((e) => {
			let t = e.id === d;
			return /* @__PURE__ */ U(O, {
				flex: "1",
				size: "xs",
				variant: t ? "subtle" : "ghost",
				borderRadius: "0",
				"aria-pressed": t,
				onClick: () => m(e.id),
				children: [o === "dots" ? /* @__PURE__ */ H(D, {
					boxSize: "0.5rem",
					borderRadius: "full",
					bg: e.indicatorColor ?? "fg.muted",
					mr: "1"
				}) : null, e.name]
			}, e.id);
		})
	});
	return /* @__PURE__ */ H(p, {
		name: n,
		description: r,
		orientation: "stacked",
		children: v
	});
}, je = (e) => {
	let { children: t, ...n } = e;
	return /* @__PURE__ */ H(k, {
		alignItems: "center",
		gap: "xs",
		minW: "0",
		...n,
		children: t
	});
}, Me = (e, t) => t.min === void 0 && t.max === void 0 ? e : X(e, t.min ?? -Infinity, t.max ?? Infinity), Ne = (e, t, n, r = {}) => {
	let i = Me(n, r);
	return t === "x" ? {
		x: i,
		y: e.y
	} : {
		x: e.x,
		y: i
	};
}, Pe = (e) => {
	let { label: t, fieldId: n, value: r, min: i, max: a, step: o, onCommit: s } = e;
	return /* @__PURE__ */ U(k, {
		alignItems: "center",
		gap: "1",
		flexShrink: 0,
		children: [/* @__PURE__ */ H(z, {
			textStyle: "label/XS/regular",
			color: "fg.muted",
			width: "1rem",
			flexShrink: 0,
			children: t
		}), /* @__PURE__ */ H(W, {
			id: n,
			name: t,
			description: "",
			defaultValue: r,
			min: i,
			max: a,
			step: o,
			hideLabel: !0,
			hideSlider: !0,
			onChange: (e, t) => s(t)
		})]
	});
}, Fe = (e) => {
	let { id: t, name: n, description: r, defaultValue: i, xLabel: a = "X", yLabel: o = "Y", min: s, max: c, step: l = 1, onChange: u, readOnly: d } = e, [f, m] = T(i);
	C(() => {
		m(i);
	}, [i]);
	let g = (e, n) => {
		let r = Ne(f, e, n, {
			min: s,
			max: c
		});
		m(r), u(t, r);
	};
	return d ? /* @__PURE__ */ H(p, {
		name: n,
		description: r,
		children: /* @__PURE__ */ H(h, { children: `${f.x}, ${f.y}` })
	}) : /* @__PURE__ */ H(p, {
		name: n,
		description: r,
		orientation: "stacked",
		children: /* @__PURE__ */ U(je, { children: [/* @__PURE__ */ H(Pe, {
			label: a,
			fieldId: `${t}.x`,
			value: f.x,
			min: s,
			max: c,
			step: l,
			onCommit: (e) => g("x", e)
		}), /* @__PURE__ */ H(Pe, {
			label: o,
			fieldId: `${t}.y`,
			value: f.y,
			min: s,
			max: c,
			step: l,
			onCommit: (e) => g("y", e)
		})] })
	});
}, Q = (e, t, n) => e[t] === void 0 ? n : e[t], Ie = (e) => {
	let { param: t, defaultValues: n, onChange: r, readOnly: i, fullWidth: a, presentation: o } = e, s = {
		id: t.id,
		readOnly: i || t.readOnly,
		onChange: r,
		fullWidth: o !== "horizontal" && a
	};
	switch (t.type) {
		case "range": return /* @__PURE__ */ H(ke, {
			...s,
			name: t.name,
			description: t.description,
			defaultValue: Q(n, t.id, t.defaultValue),
			min: t.min,
			max: t.max,
			step: t.step,
			unit: t.unit,
			markerCount: t.markerCount,
			presentation: o
		});
		case "segmented": return /* @__PURE__ */ H(Ae, {
			...s,
			name: t.name,
			description: t.description,
			defaultValue: Q(n, t.id, t.defaultValue),
			options: t.options,
			variant: t.variant,
			presentation: o
		});
		case "actions": return /* @__PURE__ */ H(m, {
			...s,
			name: t.name,
			description: t.description,
			defaultValue: Q(n, t.id, t.defaultValue),
			options: t.options,
			presentation: o
		});
		case "anchorGrid": return o === "horizontal" ? null : /* @__PURE__ */ H(ge, {
			...s,
			name: t.name,
			description: t.description,
			defaultValue: Q(n, t.id, t.defaultValue)
		});
		case "vector": return /* @__PURE__ */ H(Fe, {
			...s,
			name: t.name,
			description: t.description,
			defaultValue: Q(n, t.id, t.defaultValue),
			xLabel: t.xLabel,
			yLabel: t.yLabel,
			min: t.min,
			max: t.max,
			step: t.step
		});
		case "fileUpload": return /* @__PURE__ */ H(Te, {
			id: t.id,
			name: t.name,
			description: t.description,
			defaultValue: Q(n, t.id, t.defaultValue),
			accept: t.accept,
			multiple: t.multiple,
			uploadLabel: t.uploadLabel,
			readOnly: s.readOnly,
			presentation: o,
			onChange: r
		});
	}
}, Le = (e) => e.type === "fileUpload" || e.type === "text" && e.singleLine === !1, Re = (e) => e.type !== "anchorGrid", $ = (e) => e === null || e === "" ? "Not provided" : String(e), ze = (e) => {
	let { value: t } = e;
	if (Array.isArray(t)) return t.length === 0 ? /* @__PURE__ */ H(h, {
		color: "fg.muted",
		children: "None"
	}) : /* @__PURE__ */ H(M, {
		gap: "2xs",
		flexWrap: "wrap",
		children: t.map((e, t) => /* @__PURE__ */ H(E, {
			variant: "subtle",
			colorPalette: "gray",
			children: $(e)
		}, `${String(e)}-${t}`))
	});
	if (typeof t == "object" && t) {
		let e = t.type === "image" ? [{
			src: t.src,
			alt: t.alt
		}] : t.images;
		return /* @__PURE__ */ H(M, {
			gap: "2xs",
			flexWrap: "wrap",
			children: e.map((e) => /* @__PURE__ */ H(F, {
				src: e.src,
				alt: e.alt,
				width: "96px",
				height: "72px",
				borderRadius: "sm",
				borderWidth: "1px",
				borderColor: "border.subtle",
				objectFit: "cover"
			}, `${e.src}-${e.alt}`))
		});
	}
	return typeof t == "boolean" ? /* @__PURE__ */ H(h, { children: $(t) }) : /* @__PURE__ */ H(h, {
		color: t === null || t === "" ? "fg.muted" : "fg",
		children: $(t)
	});
}, Be = (e) => {
	let { param: t, fullWidth: n } = e;
	return /* @__PURE__ */ H(p, {
		name: t.name,
		description: t.description,
		fullWidth: n,
		children: /* @__PURE__ */ H(ze, { value: t.value })
	});
}, Ve = (e) => {
	let { param: t, fullWidth: n } = e;
	return n ? /* @__PURE__ */ U(D, { children: [/* @__PURE__ */ H(D, {
		mb: "xs",
		children: /* @__PURE__ */ H(l, {
			name: t.name,
			description: t.description
		})
	}), /* @__PURE__ */ H(h, { children: t.value })] }) : /* @__PURE__ */ U(k, {
		alignItems: "center",
		justifyContent: "space-between",
		minHeight: "2rem",
		gap: "xs",
		children: [/* @__PURE__ */ H(l, {
			name: t.name,
			description: t.description
		}), /* @__PURE__ */ H(h, { children: t.value })]
	});
}, He = (e) => {
	let { param: t, defaultValues: n, onChange: r, onOpenResource: i, readOnly: a, fullWidth: o = !1, presentation: s = "stacked", size: c = "sm" } = e, l = s === "horizontal", u = Le(t), d = {
		id: t.id,
		readOnly: a || t.readOnly,
		onChange: r,
		fullWidth: l ? u : o,
		size: c
	};
	switch (t.type) {
		case "number": return /* @__PURE__ */ H(W, {
			...d,
			name: t.name,
			description: t.description || "",
			defaultValue: Q(n, t.id, t.defaultValue),
			min: t.min,
			max: t.max,
			step: t.step,
			hideLabel: l,
			hideSlider: l
		});
		case "boolean": return /* @__PURE__ */ H(ne, {
			...d,
			name: t.name,
			description: t.description,
			defaultValue: Q(n, t.id, t.defaultValue),
			hideLabel: l
		});
		case "text": return l && t.singleLine !== !1 ? /* @__PURE__ */ H(oe, {
			...d,
			name: t.name,
			description: t.description || "",
			defaultValue: Q(n, t.id, t.defaultValue),
			hideLabel: !0
		}) : /* @__PURE__ */ H(J, {
			...d,
			name: t.name,
			description: t.description || "",
			defaultValue: Q(n, t.id, t.defaultValue),
			singleLine: t.singleLine
		});
		case "markdown": return /* @__PURE__ */ H(se, {
			id: t.id,
			name: t.name,
			description: t.description,
			defaultValue: Q(n, t.id, t.defaultValue),
			placeholder: t.placeholder,
			readOnly: d.readOnly,
			presentation: s,
			size: c,
			onChange: r
		});
		case "selection": return /* @__PURE__ */ H(S, {
			...d,
			name: t.name,
			description: t.description || "",
			defaultValue: Q(n, t.id, t.defaultValue),
			options: t.options,
			multiSelect: t.multiSelect,
			placeholder: t.placeholder,
			clearable: t.clearable,
			disabled: t.disabled,
			searchable: t.searchable,
			allowCustomValues: t.allowCustomValues,
			searchPlaceholder: t.searchPlaceholder,
			emptyText: t.emptyText,
			group: t.group ? {
				...t.group,
				defaultValue: Q(n, t.group.id, t.group.defaultValue)
			} : void 0,
			hideLabel: l
		});
		case "date": return /* @__PURE__ */ H(ae, {
			...d,
			name: t.name,
			description: t.description || "",
			defaultValue: Q(n, t.id, t.defaultValue),
			min: t.min,
			max: t.max,
			hideLabel: l
		});
		case "color": return /* @__PURE__ */ H(g, {
			...d,
			name: t.name,
			description: t.description || "",
			defaultValue: Q(n, t.id, t.defaultValue),
			hideLabel: l
		});
		case "property": return /* @__PURE__ */ H(Ve, {
			param: t,
			fullWidth: !l && o
		});
		case "readOnly": return /* @__PURE__ */ H(Be, {
			param: t,
			fullWidth: !l && o
		});
		case "resource": return /* @__PURE__ */ H(me, {
			...d,
			name: t.name,
			description: t.description,
			defaultValue: Q(n, t.id, t.defaultValue),
			options: t.options,
			multiSelect: t.multiSelect,
			editable: t.editable,
			placeholder: t.placeholder,
			emptyText: t.emptyText,
			onOpenResource: i,
			presentation: s
		});
		case "range":
		case "segmented":
		case "actions":
		case "anchorGrid":
		case "vector":
		case "fileUpload": return /* @__PURE__ */ H(Ie, {
			param: t,
			defaultValues: n,
			onChange: r,
			readOnly: a,
			fullWidth: o,
			presentation: s
		});
		default: return null;
	}
};
export { J as a, Y as i, Re as n, W as o, Le as r, He as t };
