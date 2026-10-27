// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { n as i } from "./extension-webview-host-capabilities-B83EPRps.ts";
import { t as a } from "./workbench-core-kaLFKJEn.ts";
import { n as o } from "./webview-host-capabilities-BLbyfvWF.ts";
import { n as s } from "./host-BKbqlzxa.ts";
import { t as c } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useEffect as l, useState as u, useSyncExternalStore as d } from "react";
import { Box as f, Button as p, HStack as m, Input as h, Stack as g, Text as _ } from "@chakra-ui/react";
import { ScrollArea as v, SimpleCard as y, SimpleCardBody as b } from "@pstdio/ui";
import { jsx as x, jsxs as S } from "react/jsx-runtime";
import { applyEditingChanges as C, createWebviewClient as w } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/examples/editing-sessions/editing-sessions.fixture.ts
var T = {
	title: "Original title",
	position: {
		x: 0,
		y: 0
	}
}, E = () => {
	let e = a(), t = "storybook.editing", n = `${t}.command.save`, r = /* @__PURE__ */ new Set(), c = /* @__PURE__ */ new Set(), l = {
		held: !0,
		started: 0,
		completed: 0,
		waiting: 0,
		saved: {
			main: structuredClone(T),
			other: structuredClone(T)
		}
	}, u = (e) => {
		l = {
			...l,
			...e,
			waiting: c.size
		};
		for (let e of r) e();
	};
	return e.commands.registerCommand({
		id: n,
		label: "Save editing document"
	}, { execute: async (e) => {
		let { document: t, changes: n } = e;
		u({ started: l.started + 1 }), l.held && await new Promise((e, t) => {
			c.add({
				resolve: e,
				reject: t
			}), u({});
		}), u({
			completed: l.completed + 1,
			saved: {
				...l.saved,
				[t]: C(l.saved[t], n)
			}
		});
	} }), {
		open: async (r) => {
			let a = i(), c = /* @__PURE__ */ new Map();
			a.bind(({ scope: e, payload: t }) => {
				for (let n of c.get(e) ?? []) n(t);
			});
			let u = s({
				declaredCapabilities: ["editing.session"],
				capabilities: o({
					workbench: e,
					extensionId: t,
					projectId: "editing-story",
					hostEvents: a
				})
			});
			return w({
				extensionId: t,
				call: async (e, ...[t]) => await u.call({
					method: e,
					params: t
				}),
				onEvent: (e, t) => {
					let n = c.get(e) ?? /* @__PURE__ */ new Set();
					return c.set(e, n), n.add(t), () => {
						n.delete(t);
					};
				}
			}).editing.open({
				key: r,
				initial: structuredClone(l.saved[r]),
				save: {
					commandId: n,
					params: { document: r }
				}
			});
		},
		getSnapshot: () => l,
		subscribe: (e) => (r.add(e), () => {
			r.delete(e);
		}),
		hold: () => u({ held: !0 }),
		release: () => {
			for (let e of c) e.resolve();
			c.clear(), u({ held: !1 });
		},
		fail: () => {
			for (let e of c) e.reject(/* @__PURE__ */ Error("Save failed. Your edit is still shared. Retry saving."));
			c.clear(), u({});
		}
	};
}, D = (e) => {
	let { label: t, session: n } = e, { value: r, revision: i, savedRevision: a } = d(n.subscribe, n.getSnapshot), [o, s] = u(!1), [c, l] = u(""), f = (e) => {
		l(""), e.catch((e) => l(e.message));
	};
	return /* @__PURE__ */ x(y, {
		as: "section",
		"aria-label": t,
		flex: "1",
		minW: "0",
		children: /* @__PURE__ */ x(b, { children: /* @__PURE__ */ S(g, {
			gap: "md",
			children: [
				/* @__PURE__ */ x(_, {
					textStyle: "label/M/medium",
					children: t
				}),
				/* @__PURE__ */ S(g, {
					as: "label",
					gap: "xs",
					children: [/* @__PURE__ */ x(_, {
						textStyle: "label/S/medium",
						children: "Title"
					}), /* @__PURE__ */ x(h, {
						"aria-label": `${t} title`,
						size: "sm",
						value: r.title,
						onChange: (e) => f(n.commit([{
							path: ["title"],
							value: e.target.value
						}]))
					})]
				}),
				/* @__PURE__ */ S(_, {
					as: "output",
					"aria-label": `${t} position`,
					children: [
						"Position: ",
						r.position.x,
						", ",
						r.position.y
					]
				}),
				/* @__PURE__ */ S(m, {
					gap: "xs",
					flexWrap: "wrap",
					children: [
						/* @__PURE__ */ x(p, {
							size: "sm",
							variant: "outline",
							onClick: () => f(n.preview([{
								path: ["position", "x"],
								value: r.position.x + 12
							}, {
								path: ["position", "y"],
								value: r.position.y + 24
							}])),
							children: "Preview move"
						}),
						/* @__PURE__ */ x(p, {
							size: "sm",
							variant: "outline",
							onClick: () => f(n.commit()),
							children: "Commit move"
						}),
						/* @__PURE__ */ x(p, {
							size: "sm",
							variant: "ghost",
							onClick: () => f(n.cancel()),
							children: "Cancel move"
						})
					]
				}),
				/* @__PURE__ */ S(m, {
					gap: "xs",
					flexWrap: "wrap",
					children: [/* @__PURE__ */ x(p, {
						size: "sm",
						variant: "ghost",
						onClick: () => s(!o),
						children: "Select locally"
					}), /* @__PURE__ */ x(_, {
						as: "output",
						"aria-label": `${t} selection`,
						children: o ? "Selected" : "Unselected"
					})]
				}),
				/* @__PURE__ */ S(_, {
					color: "fg.muted",
					textStyle: "paragraph/S/regular",
					children: [
						"Revision ",
						i,
						"; saved revision ",
						a
					]
				}),
				c ? /* @__PURE__ */ x(_, {
					role: "alert",
					color: "fg.error",
					children: c
				}) : null,
				/* @__PURE__ */ x(p, {
					size: "sm",
					variant: "outline",
					onClick: () => f(n.save()),
					children: "Retry save"
				})
			]
		}) })
	});
}, O = (e) => {
	let { fixture: t } = e, n = d(t.subscribe, t.getSnapshot);
	return /* @__PURE__ */ x(y, {
		as: "section",
		"aria-label": "Persistence",
		children: /* @__PURE__ */ x(b, { children: /* @__PURE__ */ S(g, {
			gap: "sm",
			children: [
				/* @__PURE__ */ x(_, {
					textStyle: "label/M/medium",
					children: "Persistence"
				}),
				/* @__PURE__ */ S(_, { children: [
					"Saves are ",
					n.held ? "held" : "released",
					". Edit either shared view while saving is held."
				] }),
				/* @__PURE__ */ S(m, {
					gap: "sm",
					flexWrap: "wrap",
					children: [/* @__PURE__ */ x(p, {
						size: "sm",
						onClick: n.held ? t.release : t.hold,
						children: n.held ? "Release saves" : "Hold saves"
					}), /* @__PURE__ */ x(p, {
						size: "sm",
						variant: "outline",
						disabled: !n.waiting,
						onClick: t.fail,
						children: "Fail held saves"
					})]
				}),
				/* @__PURE__ */ S(_, {
					as: "output",
					"aria-label": "Save counts",
					children: [
						"Started: ",
						n.started,
						"; completed: ",
						n.completed,
						"; held: ",
						n.waiting
					]
				}),
				/* @__PURE__ */ S(_, {
					as: "output",
					"aria-label": "Saved title",
					children: ["Saved title: ", n.saved.main.title]
				}),
				/* @__PURE__ */ S(_, {
					as: "output",
					"aria-label": "Saved position",
					children: [
						"Saved position: ",
						n.saved.main.position.x,
						", ",
						n.saved.main.position.y
					]
				})
			]
		}) })
	});
}, k = () => {
	let [e, t] = u(), [n, r] = u("");
	return l(() => {
		let e = E(), n = !0, i = [];
		return (async () => {
			for (let t of [
				"main",
				"main",
				"other"
			]) {
				let r = await e.open(t);
				if (!n) {
					await r.close();
					return;
				}
				i.push(r);
			}
			t({
				fixture: e,
				sessions: i
			});
		})().catch((e) => {
			n && r(e.message);
		}), () => {
			n = !1, e.release();
			for (let e of i) e.close();
		};
	}, []), /* @__PURE__ */ S(g, {
		gap: "md",
		children: [
			e ? /* @__PURE__ */ x(O, { fixture: e.fixture }) : /* @__PURE__ */ x(_, { children: "Opening shared views…" }),
			n ? /* @__PURE__ */ x(_, {
				role: "alert",
				children: n
			}) : null,
			/* @__PURE__ */ x(m, {
				align: "stretch",
				gap: "md",
				flexWrap: "wrap",
				children: e?.sessions.map((e, t) => /* @__PURE__ */ x(D, {
					session: e,
					label: [
						"View A",
						"View B",
						"Other document"
					][t]
				}, e.id))
			})
		]
	});
}, A = {
	title: "pstdio-workbench/Reference/Extension API/Shared editing sessions",
	component: () => {
		let [e, t] = u(0);
		return /* @__PURE__ */ x(c, { children: /* @__PURE__ */ x(v, {
			h: "100dvh",
			children: /* @__PURE__ */ x(f, {
				p: "lg",
				bg: "bg",
				color: "fg",
				minH: "full",
				children: /* @__PURE__ */ S(g, {
					gap: "md",
					children: [
						/* @__PURE__ */ S(m, {
							justify: "space-between",
							gap: "md",
							children: [/* @__PURE__ */ x(_, {
								as: "h1",
								textStyle: "heading/M",
								children: "Shared editing sessions"
							}), /* @__PURE__ */ x(p, {
								size: "sm",
								variant: "outline",
								onClick: () => t(e + 1),
								children: "Reset demo"
							})]
						}),
						/* @__PURE__ */ x(_, { children: "View A and View B share a document. The third view edits a different document. Commit or cancel a move from the view that previewed it. Selection stays local." }),
						/* @__PURE__ */ x(k, {}, e)
					]
				})
			})
		}) });
	},
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "Use the real SDK editing client, capability gate, host event publisher and host-owned save queue. Only the transport and persistence are in memory. Views share edits before saving, coalesce pending writes, and preview or cancel compound changes. Sandboxed iframe transport is covered by the packaged editing-session journeys." } }
	}
}, j = {}, M = { play: async ({ canvasElement: i }) => {
	let a = n(i), o = n(await a.findByRole("region", { name: "View A" })), s = n(a.getByRole("region", { name: "View B" })), c = n(a.getByRole("region", { name: "Other document" })), l = o.getByRole("textbox", { name: "View A title" });
	await e.clear(l), await e.type(l, "Latest shared edit"), await r(s.getByRole("textbox", { name: "View B title" })).toHaveValue("Latest shared edit"), await r(c.getByRole("textbox", { name: "Other document title" })).toHaveValue("Original title"), await r(a.getByLabelText("Save counts")).toHaveTextContent("Started: 1; completed: 0; held: 1"), await r(a.getByLabelText("Saved title")).toHaveTextContent("Saved title: Original title"), await e.click(o.getByRole("button", { name: "Select locally" })), await r(o.getByLabelText("View A selection")).toHaveTextContent(/^Selected$/), await r(s.getByLabelText("View B selection")).toHaveTextContent("Unselected"), await e.click(o.getByRole("button", { name: "Preview move" })), await r(s.getByLabelText("View B position")).toHaveTextContent("Position: 12, 24"), await r(a.getByLabelText("Saved position")).toHaveTextContent("Saved position: 0, 0"), await e.click(o.getByRole("button", { name: "Cancel move" })), await r(s.getByLabelText("View B position")).toHaveTextContent("Position: 0, 0"), await e.click(o.getByRole("button", { name: "Preview move" })), await e.click(o.getByRole("button", { name: "Commit move" })), await r(a.getByLabelText("Save counts")).toHaveTextContent("Started: 1; completed: 0; held: 1"), await e.click(a.getByRole("button", { name: "Release saves" })), await t(async () => {
		await r(a.getByLabelText("Saved title")).toHaveTextContent("Saved title: Latest shared edit"), await r(a.getByLabelText("Save counts")).toHaveTextContent("Started: 2; completed: 2; held: 0");
	}), await r(a.getByLabelText("Saved position")).toHaveTextContent("Saved position: 12, 24"), await r(s.getByRole("textbox", { name: "View B title" })).toHaveValue("Latest shared edit"), await e.click(o.getByRole("button", { name: "Preview move" })), await r(s.getByLabelText("View B position")).toHaveTextContent("Position: 24, 48"), await e.click(o.getByRole("button", { name: "Cancel move" })), await r(s.getByLabelText("View B position")).toHaveTextContent("Position: 12, 24"), await r(a.getByLabelText("Save counts")).toHaveTextContent("Started: 2; completed: 2; held: 0");
} }, N = { play: async ({ canvasElement: i }) => {
	let a = n(i), o = n(await a.findByRole("region", { name: "View A" })), s = n(a.getByRole("region", { name: "View B" }));
	await e.type(o.getByRole("textbox", { name: "View A title" }), " retained"), await e.click(a.getByRole("button", { name: "Fail held saves" })), await r(await o.findByRole("alert")).toHaveTextContent("Save failed"), await r(s.getByRole("textbox", { name: "View B title" })).toHaveValue("Original title retained"), await r(a.getByLabelText("Saved title")).toHaveTextContent("Saved title: Original title"), await e.click(o.getByRole("button", { name: "Retry save" })), await r(a.getByLabelText("Save counts")).toHaveTextContent("Started: 2; completed: 0; held: 1"), await e.click(a.getByRole("button", { name: "Release saves" })), await t(async () => {
		await r(a.getByLabelText("Saved title")).toHaveTextContent("Saved title: Original title retained"), await r(a.getByLabelText("Save counts")).toHaveTextContent("Started: 2; completed: 1; held: 0");
	});
} };
export { N as FailedSaveRetry, M as HeldSavesAndGestures, j as Playground, A as default };
