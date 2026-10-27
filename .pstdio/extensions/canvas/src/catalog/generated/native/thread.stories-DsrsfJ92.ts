// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { _ as e, a as t, c as n, d as r, f as i, g as a, h as o, l as s, n as c, p as l, r as u, s as d, u as ee, v as f } from "./charts-EzV1PygN.ts";
import { t as p } from "./useQuery-OeRqqLZF.ts";
import { createElement as m, forwardRef as h, useState as g } from "react";
import { Badge as _, Box as v, Button as y, Flex as b, HStack as x, Heading as te, Icon as S, Image as C, Input as ne, Link as w, Separator as T, Spacer as E, Stack as D, Text as O, Textarea as re } from "@chakra-ui/react";
import { Chip as k, CopyButton as A, EmptyState as ie, SimpleCard as j, SimpleCardBody as M } from "@pstdio/ui";
import { Fragment as ae, jsx as N, jsxs as P } from "react/jsx-runtime";
// node_modules/.bun/lucide-react@0.556.0+b1ab299f0a400331/node_modules/lucide-react/dist/esm/shared/src/utils.js
var oe = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), se = (e) => e.replace(/^([A-Z])|[\s-_]+(\w)/g, (e, t, n) => n ? n.toUpperCase() : t.toLowerCase()), F = (e) => {
	let t = se(e);
	return t.charAt(0).toUpperCase() + t.slice(1);
}, I = (...e) => e.filter((e, t, n) => !!e && e.trim() !== "" && n.indexOf(e) === t).join(" ").trim(), ce = (e) => {
	for (let t in e) if (t.startsWith("aria-") || t === "role" || t === "title") return !0;
}, le = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
}, ue = h(({ color: e = "currentColor", size: t = 24, strokeWidth: n = 2, absoluteStrokeWidth: r, className: i = "", children: a, iconNode: o, ...s }, c) => m("svg", {
	ref: c,
	...le,
	width: t,
	height: t,
	stroke: e,
	strokeWidth: r ? Number(n) * 24 / Number(t) : n,
	className: I("lucide", i),
	...!a && !ce(s) && { "aria-hidden": "true" },
	...s
}, [...o.map(([e, t]) => m(e, t)), ...Array.isArray(a) ? a : [a]])), L = (e, t) => {
	let n = h(({ className: n, ...r }, i) => m(ue, {
		ref: i,
		iconNode: t,
		className: I(`lucide-${oe(F(e))}`, `lucide-${e}`, n),
		...r
	}));
	return n.displayName = F(e), n;
}, de = L("arrow-big-up", [["path", {
	d: "M9 13a1 1 0 0 0-1-1H5.061a1 1 0 0 1-.75-1.811l6.836-6.835a1.207 1.207 0 0 1 1.707 0l6.835 6.835a1 1 0 0 1-.75 1.811H16a1 1 0 0 0-1 1v6a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z",
	key: "lh0v7k"
}]]), R = L("check", [["path", {
	d: "M20 6 9 17l-5-5",
	key: "1gmf2c"
}]]), fe = L("circle-question-mark", [
	["circle", {
		cx: "12",
		cy: "12",
		r: "10",
		key: "1mglay"
	}],
	["path", {
		d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3",
		key: "1u773s"
	}],
	["path", {
		d: "M12 17h.01",
		key: "p32p05"
	}]
]), z = L("film", [
	["rect", {
		width: "18",
		height: "18",
		x: "3",
		y: "3",
		rx: "2",
		key: "afitv7"
	}],
	["path", {
		d: "M7 3v18",
		key: "bbkbws"
	}],
	["path", {
		d: "M3 7.5h4",
		key: "zfgn84"
	}],
	["path", {
		d: "M3 12h18",
		key: "1i2n21"
	}],
	["path", {
		d: "M3 16.5h4",
		key: "1230mu"
	}],
	["path", {
		d: "M17 3v18",
		key: "in4fa5"
	}],
	["path", {
		d: "M17 7.5h4",
		key: "myr1c1"
	}],
	["path", {
		d: "M17 16.5h4",
		key: "go4c1d"
	}]
]), B = L("info", [
	["circle", {
		cx: "12",
		cy: "12",
		r: "10",
		key: "1mglay"
	}],
	["path", {
		d: "M12 16v-4",
		key: "1dtifu"
	}],
	["path", {
		d: "M12 8h.01",
		key: "e9boi3"
	}]
]), V = L("lightbulb", [
	["path", {
		d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
		key: "1gvzjb"
	}],
	["path", {
		d: "M9 18h6",
		key: "x1upvd"
	}],
	["path", {
		d: "M10 22h4",
		key: "ceow96"
	}]
]), pe = L("message-square", [["path", {
	d: "M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",
	key: "18887p"
}]]), H = L("pencil", [["path", {
	d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
	key: "1a8usu"
}], ["path", {
	d: "m15 5 4 4",
	key: "1mk7zo"
}]]), U = L("x", [["path", {
	d: "M18 6 6 18",
	key: "1bl5f8"
}], ["path", {
	d: "m6 6 12 12",
	key: "d8bk6v"
}]]), me = /(https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]])/g, W = (e) => {
	let { children: t, ...n } = e, r = ee(), i = t.split(me);
	return /* @__PURE__ */ N(O, {
		...n,
		children: i.map((e, t) => t % 2 ? /* @__PURE__ */ N(w, {
			href: e,
			variant: "underline",
			wordBreak: "break-all",
			onClick: (t) => {
				t.preventDefault(), r(e);
			},
			children: e
		}, t) : e)
	});
}, G = (e) => {
	let { text: t, onSave: n, onCancel: r } = e, [i, a] = g(t);
	return /* @__PURE__ */ P(D, {
		gap: "xs",
		children: [/* @__PURE__ */ N(re, {
			"aria-label": "Draft",
			value: i,
			rows: 5,
			onChange: (e) => a(e.target.value)
		}), /* @__PURE__ */ P(x, {
			gap: "xs",
			children: [/* @__PURE__ */ N(y, {
				size: "xs",
				disabled: !i.trim(),
				onClick: () => n(i.trim()),
				children: "Save"
			}), /* @__PURE__ */ N(y, {
				size: "xs",
				variant: "ghost",
				onClick: r,
				children: "Cancel"
			})]
		})]
	});
}, he = (e) => {
	let { idea: t, onEdit: n, onStatus: r } = e, [i, a] = g(!1);
	return /* @__PURE__ */ N(j, {
		bg: "bg.subtle",
		"aria-label": "Reply idea",
		children: /* @__PURE__ */ N(M, { children: /* @__PURE__ */ P(D, {
			gap: "sm",
			children: [
				/* @__PURE__ */ P(x, {
					gap: "xs",
					children: [
						/* @__PURE__ */ N(S, {
							as: V,
							boxSize: "icon-xs"
						}),
						/* @__PURE__ */ N(_, {
							size: "sm",
							colorPalette: "purple",
							children: t.status === "used" ? "Used" : "Reply idea"
						}),
						/* @__PURE__ */ N(E, {}),
						/* @__PURE__ */ P(O, {
							textStyle: "label/XS",
							color: "fg.muted",
							children: ["Suggested ", new Date(t.createdAt).toLocaleDateString("en-US", {
								month: "short",
								day: "numeric"
							})]
						})
					]
				}),
				i ? /* @__PURE__ */ N(G, {
					text: t.body,
					onCancel: () => a(!1),
					onSave: (e) => {
						n(e), a(!1);
					}
				}) : /* @__PURE__ */ N(O, {
					textStyle: "paragraph/S/regular",
					whiteSpace: "pre-wrap",
					children: t.body
				}),
				i ? null : /* @__PURE__ */ P(x, {
					gap: "2xs",
					children: [
						/* @__PURE__ */ N(A, {
							size: "xs",
							variant: "ghost",
							text: t.body,
							label: "Copy reply"
						}),
						/* @__PURE__ */ P(y, {
							size: "xs",
							variant: "ghost",
							onClick: () => a(!0),
							children: [/* @__PURE__ */ N(H, {}), "Edit"]
						}),
						t.status === "used" ? null : /* @__PURE__ */ P(y, {
							size: "xs",
							variant: "ghost",
							onClick: () => r("used"),
							children: [/* @__PURE__ */ N(R, {}), "Mark used"]
						}),
						/* @__PURE__ */ N(E, {}),
						/* @__PURE__ */ P(y, {
							size: "xs",
							variant: "ghost",
							onClick: () => r("dismissed"),
							children: [/* @__PURE__ */ N(U, {}), "Dismiss"]
						})
					]
				})
			]
		}) })
	});
}, K = (e) => {
	let { threadId: t, images: n = [] } = e, { client: i } = r(), a = p({
		queryKey: [
			"thread-images",
			t,
			n.map((e) => e.file)
		],
		queryFn: () => Promise.all(n.map((e) => i.artifacts.imageUrl(l, `${t}/${e.file}`))),
		enabled: n.length > 0
	});
	return a.data ? /* @__PURE__ */ N(x, {
		gap: "sm",
		wrap: "wrap",
		align: "start",
		children: n.map((e, t) => /* @__PURE__ */ N(C, {
			src: a.data[t],
			alt: e.alt ?? "",
			maxH: "96",
			maxW: "full",
			borderRadius: "sm"
		}, e.file))
	}) : null;
}, q = (e) => {
	if (!e) return "";
	let t = Math.round((Date.now() - Date.parse(e)) / 36e5);
	return t < 24 ? `${Math.max(t, 1)}h` : new Date(e).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric"
	});
}, J = (e) => {
	let { threadId: t, comment: n, op: r } = e;
	return /* @__PURE__ */ P(D, {
		gap: "xs",
		children: [
			/* @__PURE__ */ P(x, {
				gap: "xs",
				children: [
					/* @__PURE__ */ N(O, {
						textStyle: "label/S/medium",
						children: n.author
					}),
					n.author === r ? /* @__PURE__ */ N(_, {
						size: "xs",
						children: "OP"
					}) : null,
					n.mine ? /* @__PURE__ */ N(_, {
						size: "xs",
						colorPalette: "green",
						children: "Your reply"
					}) : null,
					/* @__PURE__ */ N(O, {
						textStyle: "label/XS",
						color: "fg.muted",
						flex: "1",
						children: q(n.publishedAt)
					}),
					n.topic ? /* @__PURE__ */ N(k, { children: n.topic }) : null
				]
			}),
			/* @__PURE__ */ N(W, {
				textStyle: "paragraph/S/regular",
				whiteSpace: "pre-wrap",
				children: n.body
			}),
			/* @__PURE__ */ N(K, {
				threadId: t,
				images: n.images
			}),
			n.votes === void 0 ? null : /* @__PURE__ */ P(x, {
				gap: "2xs",
				color: "fg.muted",
				children: [/* @__PURE__ */ N(S, {
					as: de,
					boxSize: "icon-xs"
				}), /* @__PURE__ */ N(O, {
					textStyle: "label/XS",
					children: n.votes
				})]
			})
		]
	});
}, Y = (e) => {
	let { ideas: t, replyTo: n, onEditIdea: r, onIdeaStatus: i } = e;
	return t.filter((e) => e.replyTo === n).map((e) => /* @__PURE__ */ N(he, {
		idea: e,
		onEdit: (t) => r(e.id, t),
		onStatus: (t) => i(e.id, t)
	}, e.id));
}, X = (e) => {
	let { threadId: t, comment: n, comments: r, op: i, nested: a = !1, ...o } = e, s = r.filter((e) => e.parentId === n.id);
	return /* @__PURE__ */ N(v, {
		ps: a ? "md" : "0",
		borderStartWidth: a ? "1px" : "0",
		borderColor: "border.subtle",
		children: /* @__PURE__ */ P(D, {
			gap: "sm",
			children: [
				n.mine ? /* @__PURE__ */ N(j, {
					bg: "bg.subtle",
					children: /* @__PURE__ */ N(M, { children: /* @__PURE__ */ N(J, {
						threadId: t,
						comment: n,
						op: i
					}) })
				}) : /* @__PURE__ */ N(J, {
					threadId: t,
					comment: n,
					op: i
				}),
				/* @__PURE__ */ N(Y, {
					...o,
					replyTo: n.id
				}),
				s.map((e) => /* @__PURE__ */ N(X, {
					...o,
					threadId: t,
					comment: e,
					comments: r,
					op: i,
					nested: !0
				}, e.id))
			]
		})
	});
}, ge = (e) => {
	let { thread: t, ideas: n, onEditIdea: r, onIdeaStatus: i } = e, a = t.snapshot;
	if (!a) return /* @__PURE__ */ N(ie, {
		title: "No snapshot yet",
		description: "The next run saves the post and its top comments here."
	});
	let o = {
		ideas: n.filter((e) => e.status !== "dismissed"),
		onEditIdea: r,
		onIdeaStatus: i
	}, s = new Set(a.comments.map((e) => e.id)), c = a.comments.filter((e) => !e.parentId || !s.has(e.parentId));
	return /* @__PURE__ */ P(D, {
		gap: "md",
		children: [
			/* @__PURE__ */ P(x, {
				justify: "space-between",
				children: [/* @__PURE__ */ N(O, {
					textStyle: "label/S/regular",
					color: "fg.muted",
					children: [a.post.author, q(a.post.publishedAt)].filter(Boolean).join(" · ")
				}), /* @__PURE__ */ P(O, {
					textStyle: "label/XS",
					color: "fg.muted",
					children: ["Snapshot from ", new Date(a.takenAt).toLocaleDateString("en-US", {
						month: "short",
						day: "numeric"
					})]
				})]
			}),
			/* @__PURE__ */ N(te, {
				as: "h1",
				textStyle: "heading/M",
				children: t.title
			}),
			/* @__PURE__ */ N(W, {
				textStyle: "paragraph/M/regular",
				whiteSpace: "pre-wrap",
				children: a.post.body
			}),
			/* @__PURE__ */ N(K, {
				threadId: t.id,
				images: a.post.images
			}),
			/* @__PURE__ */ N(Y, { ...o }),
			/* @__PURE__ */ N(T, {}),
			/* @__PURE__ */ N(O, {
				textStyle: "label/S/medium",
				children: "Comments · top"
			}),
			/* @__PURE__ */ N(D, {
				gap: "lg",
				children: c.map((e) => /* @__PURE__ */ N(X, {
					...o,
					threadId: t.id,
					comment: e,
					comments: a.comments,
					op: a.post.author
				}, e.id))
			})
		]
	});
}, Z = (e) => {
	let { title: t, meta: n, children: r } = e;
	return /* @__PURE__ */ P(D, {
		gap: "sm",
		children: [/* @__PURE__ */ P(x, {
			justify: "space-between",
			children: [/* @__PURE__ */ N(O, {
				textStyle: "label/M/medium",
				children: t
			}), n ? /* @__PURE__ */ N(O, {
				textStyle: "label/XS",
				color: "fg.muted",
				children: n
			}) : null]
		}), r]
	});
}, Q = (e) => {
	let { text: t } = e;
	return /* @__PURE__ */ N(O, {
		textStyle: "paragraph/S/regular",
		color: "fg.muted",
		children: t
	});
}, $ = (e) => {
	let { thread: t } = e, n = t.analysis, r = n ? Object.values(n.replySentiment).reduce((e, t) => e + t, 0) : 0;
	return /* @__PURE__ */ P(D, {
		gap: "lg",
		children: [
			/* @__PURE__ */ N(Z, {
				title: "Summary",
				children: /* @__PURE__ */ N(Q, { text: n?.summary ?? t.reason })
			}),
			n ? /* @__PURE__ */ P(ae, { children: [
				/* @__PURE__ */ N(Z, {
					title: "Sentiment of replies",
					meta: `${r} comments`,
					children: /* @__PURE__ */ N(u, {
						counts: n.replySentiment,
						label: "Sentiment of replies"
					})
				}),
				/* @__PURE__ */ N(Z, {
					title: "Common topics in this thread",
					children: /* @__PURE__ */ N(c, {
						label: "Common topics in this thread",
						rows: n.topics,
						fixedHeight: !0
					})
				}),
				/* @__PURE__ */ N(Z, {
					title: "Questions people ask",
					children: n.questions.length ? n.questions.map((e, t) => /* @__PURE__ */ P(x, {
						gap: "xs",
						align: "start",
						children: [/* @__PURE__ */ N(S, {
							as: fe,
							boxSize: "icon-xs"
						}), /* @__PURE__ */ N(O, {
							textStyle: "paragraph/S/regular",
							children: e
						})]
					}, `${t}-${e}`)) : /* @__PURE__ */ N(Q, { text: "No open questions." })
				})
			] }) : null,
			t.status === "answered" ? /* @__PURE__ */ N(Z, {
				title: "Your answer",
				meta: t.answeredAt ? `Answered ${new Date(t.answeredAt).toLocaleDateString()}` : void 0,
				children: /* @__PURE__ */ N(Q, { text: t.outcome ?? "The next run checks how people responded." })
			}) : null
		]
	});
}, _e = (e) => {
	let { post: t, sourceTitles: n, onOpenSource: r } = e;
	return /* @__PURE__ */ P(D, {
		gap: "lg",
		children: [
			/* @__PURE__ */ N(Z, {
				title: "Why this post",
				children: /* @__PURE__ */ N(Q, { text: t.reason })
			}),
			t.basedOn?.length ? /* @__PURE__ */ N(Z, {
				title: "Based on",
				children: t.basedOn.map((e, t) => /* @__PURE__ */ P(x, {
					gap: "xs",
					children: [/* @__PURE__ */ N(S, {
						as: pe,
						boxSize: "icon-xs"
					}), n[e] ? /* @__PURE__ */ N(w, {
						as: "button",
						textStyle: "paragraph/S/regular",
						onClick: () => r(e),
						children: n[e]
					}) : /* @__PURE__ */ N(O, {
						textStyle: "mono/XS",
						children: e
					})]
				}, `${t}-${e}`))
			}) : null,
			t.tags.length ? /* @__PURE__ */ N(Z, {
				title: "Tags",
				children: /* @__PURE__ */ N(x, {
					gap: "xs",
					wrap: "wrap",
					children: t.tags.map((e, t) => /* @__PURE__ */ N(k, { children: e }, `${t}-${e}`))
				})
			}) : null,
			t.analysis ? /* @__PURE__ */ N($, { thread: t }) : null
		]
	});
}, ve = (t) => {
	let { threadId: n, channelName: a, rule: s } = t, { client: c } = r(), l = p({
		queryKey: ["media", n],
		queryFn: async () => {
			let t = await c.artifacts.list(i, `${n}/`);
			return Promise.all(t.map(async (t) => ({
				path: t.path,
				name: t.path.split("/").pop() ?? t.path,
				url: e(t.path) === "image" ? await c.artifacts.imageUrl(i, t.path) : null
			})));
		}
	});
	return /* @__PURE__ */ P(D, {
		gap: "sm",
		children: [
			l.data?.length ? /* @__PURE__ */ N(x, {
				gap: "sm",
				wrap: "wrap",
				align: "start",
				children: l.data.map((e) => e.url ? /* @__PURE__ */ N(C, {
					src: e.url,
					alt: e.name,
					maxH: "40",
					borderRadius: "sm"
				}, e.path) : /* @__PURE__ */ P(k, { children: [/* @__PURE__ */ N(z, {}), e.name] }, e.path))
			}) : null,
			/* @__PURE__ */ P(x, {
				gap: "xs",
				color: "fg.muted",
				children: [/* @__PURE__ */ N(S, {
					as: B,
					boxSize: "icon-xs"
				}), /* @__PURE__ */ P(O, {
					textStyle: "label/XS",
					children: [o(a, s), l.data?.length ? ` Files are in post-media/${n}/ in the extension storage folder.` : ""]
				})]
			}),
			l.error ? /* @__PURE__ */ N(v, { children: /* @__PURE__ */ N(O, {
				textStyle: "label/XS",
				color: "fg.error",
				children: l.error.message
			}) }) : null
		]
	});
}, ye = (e) => {
	let { post: t, channelName: n, mediaRule: r, onEdit: i, onDismiss: a, onPosted: o } = e, [s, c] = g(!1), [l, u] = g(""), d = f[t.site];
	return /* @__PURE__ */ P(D, {
		gap: "md",
		children: [
			/* @__PURE__ */ P(O, {
				textStyle: "label/S/regular",
				color: "fg.muted",
				children: ["Draft for ", n]
			}),
			/* @__PURE__ */ N(j, {
				"aria-label": "Draft post",
				children: /* @__PURE__ */ N(M, { children: /* @__PURE__ */ P(D, {
					gap: "sm",
					children: [
						/* @__PURE__ */ P(x, {
							gap: "xs",
							children: [
								/* @__PURE__ */ N(S, {
									as: V,
									boxSize: "icon-xs"
								}),
								/* @__PURE__ */ N(_, {
									size: "sm",
									colorPalette: "purple",
									children: "Draft post"
								}),
								/* @__PURE__ */ N(E, {}),
								d ? /* @__PURE__ */ P(O, {
									textStyle: "label/XS",
									color: t.draft.length > d ? "fg.error" : "fg.muted",
									children: [
										t.draft.length,
										" / ",
										d
									]
								}) : null
							]
						}),
						s ? /* @__PURE__ */ N(G, {
							text: t.draft,
							onCancel: () => c(!1),
							onSave: (e) => {
								i(e), c(!1);
							}
						}) : /* @__PURE__ */ N(O, {
							textStyle: "paragraph/M/regular",
							whiteSpace: "pre-wrap",
							children: t.draft
						}),
						/* @__PURE__ */ N(ve, {
							threadId: t.id,
							channelName: n,
							rule: r
						}),
						s ? null : /* @__PURE__ */ P(x, {
							gap: "2xs",
							children: [
								/* @__PURE__ */ N(A, {
									size: "xs",
									variant: "ghost",
									text: t.draft,
									label: "Copy post"
								}),
								/* @__PURE__ */ P(y, {
									size: "xs",
									variant: "ghost",
									onClick: () => c(!0),
									children: [/* @__PURE__ */ N(H, {}), "Edit"]
								}),
								/* @__PURE__ */ N(E, {}),
								/* @__PURE__ */ P(y, {
									size: "xs",
									variant: "ghost",
									onClick: a,
									children: [/* @__PURE__ */ N(U, {}), "Dismiss"]
								})
							]
						})
					]
				}) })
			}),
			/* @__PURE__ */ N(T, {}),
			/* @__PURE__ */ N(O, {
				textStyle: "label/S/medium",
				children: "Replies · none yet"
			}),
			/* @__PURE__ */ N(O, {
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				children: "After you post it, paste its link and choose Mark posted. The thread moves to Answered, and follow-up runs save its replies here."
			}),
			/* @__PURE__ */ P(x, {
				gap: "sm",
				children: [/* @__PURE__ */ N(ne, {
					"aria-label": "Post link",
					placeholder: "https://",
					value: l,
					onChange: (e) => u(e.target.value)
				}), /* @__PURE__ */ P(y, {
					variant: "outline",
					disabled: !l.trim(),
					onClick: () => o(l.trim()),
					children: [/* @__PURE__ */ N(R, {}), "Mark posted"]
				})]
			})
		]
	});
}, be = {
	title: "Extensions/Social radar/Thread",
	decorators: [(e) => /* @__PURE__ */ N(t, { children: /* @__PURE__ */ N(v, {
		p: "lg",
		children: /* @__PURE__ */ N(e, {})
	}) })]
}, xe = { render: () => /* @__PURE__ */ P(b, {
	gap: "lg",
	children: [/* @__PURE__ */ N(v, {
		flex: "1",
		maxW: "3xl",
		children: /* @__PURE__ */ N(ge, {
			thread: s,
			ideas: d,
			onEditIdea: () => {},
			onIdeaStatus: () => {}
		})
	}), /* @__PURE__ */ N(v, {
		w: "sm",
		children: /* @__PURE__ */ N($, { thread: s })
	})]
}) }, Se = { render: () => /* @__PURE__ */ P(b, {
	gap: "lg",
	children: [/* @__PURE__ */ N(v, {
		flex: "1",
		maxW: "3xl",
		children: /* @__PURE__ */ N(ye, {
			post: n,
			channelName: "X",
			mediaRule: a.x,
			onEdit: () => {},
			onDismiss: () => {},
			onPosted: () => {}
		})
	}), /* @__PURE__ */ N(v, {
		w: "sm",
		children: /* @__PURE__ */ N(_e, {
			post: n,
			sourceTitles: { "thread-1": s.title },
			onOpenSource: () => {}
		})
	})]
}) };
export { Se as NewPost, xe as ThreadMockup, be as default };
