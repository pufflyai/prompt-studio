// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { g as e, o as t, p as n } from "./schemas-D84h_Ad-.ts";
import { n as r } from "./QueryClientProvider-LIjzams-.ts";
import { t as i, u as a } from "./useQuery-OeRqqLZF.ts";
import { t as o } from "./queryClient-BgKKh9f4.ts";
import { t as s } from "./useMutation-Dy9eufiq.ts";
import { t as c } from "./arrow-up-right-CUuzCgQb.ts";
import { t as l } from "./chevron-down-ZmPqsMG0.ts";
import { t as u } from "./git-branch-BjWwGBn9.ts";
import { a as d, i as f, r as p, t as m } from "./use-harness-param-defaults-DL_UEl4r.ts";
import { t as h } from "./resource-ref-D_HHex4N.ts";
import { n as g } from "./navigation-DYVleVav.ts";
import { G as _, K as v, q as y } from "./workbench-core-N58OeDyx.ts";
import { n as b, t as x } from "./session-attachment-list-BRyzZlux.ts";
import { t as S } from "./renderer-read-key-WONjLXkB.ts";
import { t as C } from "./use-workbench-store-BMaFgEbb.ts";
import { t as w } from "./settings-resources-BmVO5oBi.ts";
import { t as T } from "./extension-navigation-target-4XfOKqwK.ts";
import { l as E, n as D, t as O, y as k } from "./collections-W65OWXaL.ts";
import { n as A, t as j } from "./use-project-CXUANpD-.ts";
import { n as M } from "./api-D3Fkqs7r.ts";
import { i as N } from "./workbench-extension-contributions-C_CIJIkp.ts";
import { i as P, n as ee } from "./project-context-BR7AjHlE.ts";
import { t as te } from "./commands-Bp5w85f4.ts";
import { t as ne } from "./use-agents-xw128NHi.ts";
import { r as re, s as ie } from "./api-CEi0FXP5.ts";
import { t as ae } from "./workspace-agent-menu-DHlog8io.ts";
import { n as F } from "./resources-CR_Z7fRd.ts";
import { t as oe } from "./harness-param-inline-controls-CDlURer7.ts";
import { n as se } from "./api-file-url-CTxskOjG.ts";
import { a as ce, f as I, o as L, s as le, y as ue } from "./dashboard-workspaces-MEnQd3Xj.ts";
import { h as de, p as fe, u as pe } from "./module-DwWTLgjb.ts";
import { r as R } from "./workspace-navigation-yctjVTFm.ts";
import { i as z } from "./module-d530V8j6.ts";
import { t as me } from "./session-chat-notices-CdYc4CZP.ts";
import { t as he } from "./session-harness-unavailable-BK_TnzVg.ts";
import { t as ge } from "./session-personal-device-PywC02Zg.ts";
import { useEffect as B, useRef as V, useState as H, useSyncExternalStore as U } from "react";
import { Box as W, Button as _e, Flex as ve, HStack as ye, Icon as be, IconButton as xe, Menu as Se, Text as Ce } from "@chakra-ui/react";
import { AlertMessage as we, ListRow as Te, SearchableMenu as Ee, Tooltip as De } from "@pstdio/ui";
import { Fragment as G, jsx as K, jsxs as q } from "react/jsx-runtime";
import { isNavigationTarget as Oe, workbenchPages as ke } from "@pstdio/sdk/extensions";
import { ChatPanel as Ae, ChatSkeleton as je, ChatWorkspaceHub as Me, HarnessControls as Ne, isGuessedChatLink as Pe, parseChatLink as J } from "@pstdio/ui/chat-ui";
import { filterHarnessParamValues as Fe, harnessParamValuesEqual as Ie, resolveHarnessParamDefaults as Le } from "@pstdio/ui/param-editor";
import { PstdioApiError as Re } from "@pstdio/sdk/client";
n({
	path: e().nullable(),
	gitRemote: e().nullable()
}), n({
	path: e().min(1).describe("Absolute folder path, or one under `~/`. A clone creates it."),
	clone: t().describe("Clone the project's recorded git remote into the folder.")
});
// packages/pstdio-dashboard/src/modules/sessions/chat/session-view-context.ts
var ze = (e) => ({
	workbench: e.workbench,
	region: e.panel.region,
	instance: e.instance,
	changeViewer: e.instance.placementIdentity ? e.workbench.viewers.capture(e.instance.placementIdentity) : void 0
}), Be = (e) => e.workbench.host.getOpenPlacementIds().has(e.instance.instanceId), Ve = (e) => S(e.instance, "session"), Y = (e) => e?.status === "in_progress" || e?.status === "awaiting_input", X = (e) => e && JSON.stringify([
	e.updated_at,
	e.status,
	e.last_request_started,
	e.last_request_ended
]), He = () => {
	let e = new o(), t = (e) => ["session-history", e];
	return {
		get(n, r) {
			if (!r || Y(r) || e.getQueryState(t(n))?.isInvalidated) return;
			let i = e.getQueryData(t(n));
			return i && i.version === X(r) ? i.messages : void 0;
		},
		set(n, r, i) {
			let a = X(r);
			a && !Y(r) && e.setQueryData(t(n), {
				version: a,
				messages: i
			});
		},
		invalidate(n) {
			e.invalidateQueries({
				queryKey: t(n),
				exact: !0
			});
		},
		retain(n) {
			return new a(e, {
				queryKey: t(n),
				enabled: !1
			}).subscribe(() => {});
		}
	};
}, Ue = /* @__PURE__ */ new WeakMap(), We = (e) => {
	let t = Ue.get(e);
	return t || (t = He(), Ue.set(e, t)), t;
}, Ge = (e) => e.flatMap((e) => {
	let t = e.parts.filter((e) => e.type !== "text" && e.type !== "reasoning" || !!e.text.trim());
	return t.length === 0 ? [] : [t.length === e.parts.length ? e : {
		...e,
		parts: t
	}];
}), Ke = (e, t) => {
	if (t.path === "/messages" && (t.op === "add" || t.op === "replace")) return Array.isArray(t.value) ? t.value : e;
	let n = t.path.match(/^\/messages\/(\d+)$/);
	if (!n) return e;
	let r = Number(n[1]);
	if (r > (t.op === "add" ? e.length : e.length - 1) || !Number.isSafeInteger(r)) return e;
	let i = [...e];
	return t.op === "add" ? i.splice(r, 0, t.value) : t.op === "replace" ? i[r] = t.value : i.splice(r, 1), i;
}, Z = (e) => {
	let t = e?.status, n = typeof t != "number" && e instanceof TypeError, r = e instanceof Error ? e.message : String(e);
	return {
		message: n ? "The network is unavailable." : r,
		temporary: typeof t != "number" || t >= 500 || t === 408 || t === 429
	};
}, qe = (e) => {
	let { sessionId: t, ownerKey: n, reads: r, transport: i, onChange: a } = e, o = We(i), s = o.retain(t), c = e.initialSession, l = (e) => e.id.startsWith(`queued-prompt-${t}-`), u = e.initialState?.messages.filter((e) => !l(e)) ?? [], d = e.initialState?.messages.filter(l) ?? [], f = e.initialState ?? {
		messages: [],
		loading: !0,
		streaming: !1
	}, p = 0, m = 0, h = 0, g = 0, _ = !1, v = !1, y, b, x, S = (e = {}) => {
		f = {
			...f,
			...e,
			messages: [...Ge(u), ...d]
		}, v || a(f);
	}, C = (e) => {
		d = e.messages, g++, S({
			queueError: void 0,
			queue: e.queue
		});
	}, w = async (e = "refresh") => {
		if (v) return;
		let a = p, o = h, s = g;
		return x ??= r.bind(`${n}:queue`), await x.request({
			queryKey: JSON.stringify([a, o]),
			load: (e) => i.getQueuedMessages(t, { signal: e }),
			onValue: (e) => {
				a === p && o === h && C(e);
			},
			onError: (e) => S({ queueError: Z(e) })
		}, e), g === s ? void 0 : f.queue;
	}, T = () => {
		if (v) return;
		let e = o.get(t, c);
		if (e) {
			u = e, S({
				loading: !1,
				error: void 0
			});
			return;
		}
		let a = p, s = m, d = c, f = X(d);
		b ??= r.bind(`${n}:transcript`), b.request({
			queryKey: JSON.stringify([
				a,
				s,
				f
			]),
			load: (e) => i.getConversation(t, e),
			onValue: (e) => {
				a === p && s === m && f === X(c) && (u = e.messages.filter((e) => !l(e)), o.set(t, d, u), S({
					loading: !1,
					error: void 0
				}));
			},
			onError: (e) => S({
				loading: !1,
				error: Z(e)
			})
		}, "refresh");
	}, E = () => {
		if (v) return;
		let e = ++p;
		if (y?.close(), b?.dispose(), b = void 0, x?.dispose(), x = r.bind(`${n}:queue`), _ = !1, S({
			loading: u.length === 0,
			streaming: !1,
			error: void 0
		}), w(), !Y(c)) {
			y = void 0, T();
			return;
		}
		let a = () => !v && p === e;
		y = i.connectStream(t, {
			onReady: () => {
				a() && S({ streaming: !0 });
			},
			onPatch: (e) => {
				if (!a()) return;
				let t = e, n = u;
				u = Ke(u, t), u !== n && (m++, t.path === "/messages" && (_ = !0), S({
					loading: !1,
					streaming: !0,
					error: void 0
				}));
			},
			onQueuedMessages: (e) => {
				a() && (h++, x?.dispose(), x = void 0, "error" in e ? S({ queueError: {
					message: e.error,
					temporary: !0
				} }) : C(e));
			},
			onEnd: () => {
				a() && (S({
					loading: !1,
					streaming: !1
				}), y?.close(), y = void 0, _ ? o.set(t, c, u) : T(), w("retry"));
			},
			onError: (e) => {
				a() && (_ = !1, y?.close(), y = void 0, S({
					loading: !1,
					streaming: !1,
					error: Z(e)
				}));
			}
		});
	};
	return {
		connect: E,
		reconnect() {
			o.invalidate(t), E();
		},
		refreshQueue: () => w("retry"),
		sessionChanged(e) {
			if (e && e.id !== t) return;
			let n = c;
			if (c = e, Y(e) && (!Y(n) || e?.last_request_started !== n?.last_request_started)) E();
			else if (!y) {
				if (Y(e)) {
					w();
					return;
				}
				_ && e?.last_request_started === n?.last_request_started ? o.set(t, e, u) : X(e) !== X(n) && T(), w();
			}
		},
		dispose() {
			v = !0, p++, y?.close(), b?.dispose(), x?.dispose(), s();
		}
	};
}, Q = {
	messages: [],
	loading: !1,
	streaming: !1
}, Je = (e, t) => {
	let n = M().sessions, [r, i] = H({ state: Q }), a = V(void 0), o = V(r), s = Ve(e), c = e.workbench;
	B(() => () => {
		a.current?.dispose(), a.current = void 0;
	}, []), B(() => {
		if (!t) {
			a.current?.dispose(), a.current = void 0, i({ state: Q });
			return;
		}
		let e = qe({
			sessionId: t,
			ownerKey: s,
			reads: c.views.reads,
			transport: n,
			initialState: o.current.sessionId === t && o.current.transport === n ? o.current.state : void 0,
			initialSession: D("sessions").get(t),
			onChange: (e) => {
				o.current = {
					sessionId: t,
					transport: n,
					state: e
				}, i(o.current);
			}
		}), r = E((n) => {
			n ? n.table === "sessions" && n.changes.some((e) => e.key === t) && e.sessionChanged(D("sessions").get(t)) : e.reconnect();
		}), l = a.current;
		a.current = {
			...e,
			dispose() {
				r(), e.dispose();
			}
		}, e.connect(), l?.dispose();
	}, [
		t,
		s,
		c,
		n
	]);
	let l = t && We(n).get(t, D("sessions").get(t)), u = l ? {
		...Q,
		messages: Ge(l)
	} : {
		...Q,
		loading: !!t
	};
	return {
		...r.sessionId === t && r.transport === n ? r.state : u,
		reconnect: () => a.current?.reconnect(),
		refreshQueue: () => a.current?.refreshQueue() ?? Promise.resolve(void 0)
	};
}, Ye = (e) => e instanceof Re && e.code === "project_folder_missing", Xe = async (e, t, n) => {
	if (!e?.agent) throw Error("Select a project and an agent before sending.");
	let r = await M().sessions.create({
		...e,
		operation: t,
		title: t.kind === "command" ? t.text.slice(0, 100) : "New session"
	}).catch((e) => {
		throw Ye(e) && n(), e;
	}), i = r.operation_result?.status ?? "completed";
	return (r.status === "failed" || r.status === "disconnected") && (i = "started"), {
		sessionId: r.id,
		status: i,
		message: r.operation_result?.message
	};
}, Ze = (e) => ({
	destination: e.destination ?? "conversation",
	prompt: e.prompt,
	messageCount: e.messageCount,
	submittedAt: Date.now(),
	previousRunStarted: e.previousRunStarted ?? null,
	userMessageId: `${e.pendingId}-user`,
	assistantMessageId: `${e.pendingId}-assistant`,
	attachments: e.attachments,
	questionResponse: e.questionResponse
}), Qe = (e, t, n) => e?.userMessageId === t.userMessageId ? {
	...e,
	failure: n
} : e, $e = (e = []) => e.map((e) => ({
	type: "file",
	fileId: e.file_id,
	filename: e.name,
	mediaType: e.mime_type ?? void 0,
	size: e.size_bytes,
	url: e.url
})), et = /* @__PURE__ */ new Map(), tt = /* @__PURE__ */ new Set(), nt = (e) => et.get(e) ?? null, $ = (e, t) => {
	let n = nt(e), r = typeof t == "function" ? t(n) : t;
	if (r !== n) {
		r ? et.set(e, r) : et.delete(e);
		for (let e of tt) e();
	}
}, rt = (e) => (tt.add(e), () => {
	tt.delete(e);
}), it = (e) => {
	let t = {
		id: e.userMessageId,
		role: "user",
		parts: [{
			type: "text",
			text: e.prompt
		}, ...$e(e.attachments)]
	};
	return e.failure ? [{
		...t,
		delivery: "unsent"
	}] : [t, {
		id: e.assistantMessageId,
		role: "assistant",
		parts: [{ type: "loading" }]
	}];
}, at = (e, t) => !t || !t.failure && ot(e, t) || !t.failure && t.destination === "queue" ? e : [...e, ...it(t)], ot = (e, t) => e.slice(t.messageCount).some((e) => e.role === "user" && e.parts.filter((e) => e.type === "text").map((e) => e.text).join("\n") === t.prompt), st = (e, t, n = !1) => {
	let r = e ? Date.parse(e) : void 0;
	return n ? r : t && !ct(e ?? null, t.previousRunStarted) ? t.submittedAt : r;
}, ct = (e, t) => e !== null && e !== t, lt = "queued-prompt-", ut = (e, t) => {
	if (!t) return null;
	let n = `${lt}${t}-`;
	if (!e.startsWith(n)) return null;
	let r = Number(e.slice(n.length));
	return Number.isInteger(r) ? r : null;
}, dt = (e) => e.parts.filter((e) => e.type === "text").map((e) => e.text).join("\n").trim(), ft = (e) => e.parts.filter((e) => e.type === "file").map((e) => ({
	id: e.fileId ?? e.url,
	name: e.filename ?? e.url.split("/").pop() ?? "Attachment",
	mediaType: e.mediaType,
	url: e.url,
	size: e.size
})), pt = (e, t) => {
	if (!e?.steeringDelivery) return !1;
	let n = t.filter((t) => t.role === "user" && t.id === e.steeringDelivery.id);
	return n.length === 1 && e.attachments.every((e) => n[0].parts.some((t) => t.type === "file" && t.fileId === e.file_id));
}, mt = (e, t, n, r) => e.some((e) => ut(e.id, t) === n.queuePosition) || ot(e, n) && ct(r, n.previousRunStarted), ht = (e, t, n, r) => {
	let i = [], a = [];
	for (let r of e) {
		let o = r.role === "user" ? ut(r.id, t) : null;
		if (o === null) {
			i.push(r);
			continue;
		}
		let s = n?.requests.find((e) => e.queuePosition === o);
		pt(s, e) || a.push({
			revision: s?.revision,
			model: s?.model,
			params: s?.params,
			steeringDelivery: s?.steeringDelivery,
			steeringUnavailableReason: s?.steeringUnavailableReason,
			id: r.id,
			prompt: dt(r),
			attachments: ft(r),
			position: o
		});
	}
	return r?.destination === "queue" && !r.failure && !ot(e, r) && a.push({
		id: r.userMessageId,
		prompt: r.prompt,
		sending: !0,
		attachments: r.attachments?.map((e) => ({
			id: e.file_id,
			name: e.name,
			mediaType: e.mime_type ?? void 0,
			size: e.size_bytes,
			url: e.url
		}))
	}), {
		messages: i,
		queuedFollowUps: a
	};
}, gt = (e) => e.slice(0, 100) || "Session", _t = (e) => {
	let t = gt(e.prompt), n = F(e.sessionId, t, e.projectId), r = e.input.instance.placementIdentity;
	if (!r) throw Error("A session draft must have an owned viewer");
	let i = e.input.changeViewer?.({
		operation: "replace",
		resource: n,
		...r.kind === "page" ? { page: ke.session } : {}
	});
	return i && i !== "stale" ? r : void 0;
}, vt = 0, yt = (e, t) => $(e, (e) => e?.userMessageId === t.userMessageId ? null : e), bt = (e) => {
	if (!e.projectId || !e.agent) return Promise.reject(/* @__PURE__ */ Error("Select a project and an agent before sending."));
	let t = Ze({
		prompt: e.text,
		messageCount: e.messages.length,
		pendingId: `pending-${vt++}`,
		attachments: e.attachments
	});
	return $(e.conversationKey, t), e.onSubmitted?.(), e.createSession.mutateAsync({
		projectId: e.projectId,
		prompt: e.text,
		agent: e.agent,
		model: e.model,
		params: e.params,
		workspaceId: e.workspaceId,
		attachments: e.attachments
	}).then(({ sessionId: n, status: r }) => {
		yt(e.conversationKey, t), r !== "queued" && $(n, t), e.onSessionCreated?.(n);
	}, (n) => {
		let r = Z(n ?? /* @__PURE__ */ Error("Could not create the session."));
		$(e.conversationKey, (e) => Qe(e, t, r));
	});
}, xt = (e) => {
	let t = Ze({
		destination: !e.questionResponse && [
			"in_progress",
			"awaiting_input",
			"queued"
		].includes(e.sessionStatus ?? "") ? "queue" : "conversation",
		prompt: e.text,
		messageCount: e.messages.length,
		pendingId: `pending-${vt++}`,
		previousRunStarted: e.lastRequestStarted,
		attachments: e.attachments,
		questionResponse: e.questionResponse
	});
	return $(e.sessionId, t), e.questionResponse || e.onSubmitted?.(), e.followUp.mutateAsync({
		sessionId: e.sessionId,
		prompt: e.text,
		agent: e.agent ?? void 0,
		model: e.model,
		params: e.params,
		questionResponse: e.questionResponse,
		attachments: e.attachments
	}).then(({ followUp: n }) => {
		if (e.questionResponse) e.onSubmitted?.(), yt(e.sessionId, t), e.reconnect();
		else if (n?.status === "queued") {
			let r = n.queue_position;
			$(e.sessionId, (e) => e?.userMessageId === t.userMessageId ? {
				...e,
				destination: "queue",
				queuePosition: r
			} : e), e.refreshQueue().then((n) => {
				n && !n.requests.some((e) => e.queuePosition === r) && yt(e.sessionId, t);
			});
		} else $(e.sessionId, (e) => e?.userMessageId === t.userMessageId ? {
			...e,
			destination: "conversation"
		} : e), e.reconnect();
	}, (n) => {
		e.onQuestionResponseError?.();
		let r = Z(n ?? /* @__PURE__ */ Error("Could not send the follow-up."));
		if ($(e.sessionId, (e) => Qe(e, t, r)), e.questionResponse) throw n ?? /* @__PURE__ */ Error("Could not send the answer.");
	});
}, St = (e) => e.sessionId ? xt({
	...e,
	sessionId: e.sessionId
}) : bt(e), Ct = (e, t, n) => (r, i, a) => e(r, a ? [] : t, a, a ? void 0 : n), wt = (e, t) => ({
	onRetry: () => {
		t.clear(), t.send(e.prompt, e.attachments ?? [], e.questionResponse).catch(() => {});
	},
	onClose: () => {
		t.clear(), e.questionResponse || t.restore(e.prompt, e.attachments ?? []);
	}
}), Tt = (e) => ({
	project_id: e.projectId,
	title: e.prompt.slice(0, 100),
	prompt: e.prompt,
	agent: e.agent,
	attachments: e.attachments?.map((e) => ({ file_id: e.file_id })),
	model: e.model?.trim() || void 0,
	params: e.params,
	workspace_id: e.workspaceId
}), Et = (e = {}) => s({
	mutationFn: async (e) => {
		let t = await M().sessions.create(Tt(e));
		return {
			sessionId: t.id,
			status: t.status
		};
	},
	onError: (t) => {
		Ye(t) && e.onFolderMissing?.();
	}
}), Dt = () => s({ mutationFn: async (e) => {
	let t = await M().sessions.followUp(e.sessionId, {
		prompt: e.prompt,
		agent: e.agent,
		model: e.model?.trim() || void 0,
		params: e.params,
		question_response: e.questionResponse,
		attachments: e.attachments?.map((e) => ({ file_id: e.file_id }))
	});
	return {
		status: t.status,
		followUp: t.follow_up
	};
} }), Ot = () => s({ mutationFn: (e) => M().sessions.updateStatus(e, "cancelled") }), kt = (e, t) => !!(t && e.some((e) => e.value === t && !e.disabled)), At = (e) => e.sessionAgent ? e.sessionAgent : kt(e.agentOptions, e.selectedAgent) ? e.selectedAgent : e.agentOptions.length === 0 && e.defaultAgent ? e.defaultAgent : kt(e.agentOptions, e.defaultAgent) ? e.defaultAgent ?? "" : e.agentOptions.find((e) => !e.disabled)?.value ?? e.agentOptions[0]?.value ?? "", jt = (e) => kt(e.agentOptions, e.selectedAgent) && (!e.requiresModel || !!e.selectedModel), Mt = (e) => e.models.some((t) => t.id === e.selectedModel) || e.selectedModel && e.models.length === 0 ? e.selectedModel : e.preferredModel && e.models.some((t) => t.id === e.preferredModel) || e.preferredModel && e.models.length === 0 ? e.preferredModel : e.models.find((e) => e.isDefault)?.id ?? e.models[0]?.id ?? "", Nt = (e, t) => {
	let n = {};
	return t.params && !Ie(e.params ?? {}, t.params) && (n.params = t.params), t.agent && t.agent !== e.agent && (n.agent = t.agent), t.lastSelectedModel && t.lastSelectedModel !== e.lastSelectedModel && (n.model = t.lastSelectedModel), t.workspaceId && t.workspaceId !== e.workspaceId && (n.workspaceId = t.workspaceId), n;
}, Pt = (e) => e.workspaces.some((t) => t.id === e.selectedWorkspaceId) ? e.selectedWorkspaceId : e.fallbackWorkspaceId && (e.workspaces.length === 0 || e.workspaces.some((t) => t.id === e.fallbackWorkspaceId)) ? e.fallbackWorkspaceId : e.workspaces[0]?.id ?? "", Ft = async (e) => {
	let [, t] = await Promise.all([M().projects.get(e.projectId), ie(e.projectId)]);
	if (P(e.workbench) !== e.sourceProjectId) return;
	let n = [...e.workbench.pages.listPages().filter((e) => e.ref.extensionId === "pstdio"), ...t.pages.map((e) => ({
		id: e.id,
		ref: {
			kind: "page",
			extensionId: e.extensionId,
			id: e.localId
		},
		path: e.path,
		document: e.document
	}))];
	if (!_({
		url: e.href,
		projectId: e.projectId,
		pages: n,
		resources: y
	})) throw Error("This page or document link is unavailable in its project.");
	window.location.assign(e.href);
}, It = (e) => {
	let t = [];
	for (let n of e.split("/")) if (n && n !== ".") {
		if (n === "..") {
			if (!t.length) throw Error("This path is outside the session workspace.");
			t.pop();
		} else t.push(n);
	}
	return t;
}, Lt = (e, t) => {
	let n = /^[a-z]:\//i.test(e);
	if (!(n || e.startsWith("/"))) {
		let t = It(e).join("/");
		if (!t) throw Error("Select a file inside the session workspace.");
		return t;
	}
	if (!t) throw Error("The session workspace has no local file root.");
	let r = t.replaceAll("\\", "/").replace(/\/+$/, "");
	if (n !== /^[a-z]:\//i.test(r)) throw Error("This path is outside the session workspace.");
	let i = It(e), a = It(r);
	if (!a.every((e, t) => n ? e.toLowerCase() === i[t]?.toLowerCase() : e === i[t]) || i.length <= a.length) throw Error("This path is outside the session workspace.");
	return i.slice(a.length).join("/");
}, Rt = (e, t, n) => {
	let r = h.parse(e);
	if (r.extensionId !== void 0 && r.extensionId !== t || r.projectId !== void 0 && r.projectId !== n) throw Error("The path handler returned a resource outside its owner or project.");
	return r;
}, zt = (e, t) => ({
	...e,
	section: void 0,
	position: t
}), Bt = (e, t, n) => {
	if (!t) return e;
	let r = (e) => {
		let t = n(e.page);
		return !!(t && e.resource?.metadata?.[t]);
	};
	return e.kind === "page" ? r(e) ? zt(e, t) : e : e.kind === "compound" ? {
		...e,
		targets: e.targets.map((e) => e.kind === "page" && r(e) ? zt(e, t) : e)
	} : e;
}, Vt = async (e) => {
	let t = e.kinds.flatMap((e) => (e.paths ?? []).map((t) => ({
		...t,
		kind: e
	}))).filter(({ prefix: t }) => {
		let n = t.replace(/\/+$/, "");
		return e.path === n || e.path.startsWith(`${n}/`);
	}).sort((e, t) => t.prefix.length - e.prefix.length)[0];
	if (!t) return null;
	let n = await e.execute(t.resolveCommand, {
		path: e.path,
		workspaceId: e.workspaceId
	});
	if (n == null) return null;
	let r = n, i = Rt(r.resource, t.kind.extensionId, e.projectId);
	if (i.type !== t.kind.localId) throw Error("The path handler returned a resource outside its owner or project.");
	if (!r.target || !Oe(r.target) || ![
		"page",
		"panel",
		"compound"
	].includes(r.target.kind)) throw Error("The path handler did not return a resource destination.");
	let a = [r.target];
	for (; a.length;) {
		let n = a.pop();
		n.kind === "compound" ? a.push(...n.targets) : (n.kind === "page" || n.kind === "panel") && (n.resource && Rt(n.resource, t.kind.extensionId, e.projectId), n.kind === "page" && n.parent && a.push(n.parent));
	}
	return {
		resource: {
			...i,
			icon: i.icon ?? t.kind.icon,
			extensionId: t.kind.extensionId,
			projectId: e.projectId
		},
		target: Bt(g(r.target, t.kind.extensionId, e.projectId), e.position, e.documentKey)
	};
}, Ht = (e) => {
	let { workspace: t } = e;
	if (!t) throw Error("The conversation workspace is unavailable.");
	if (t.executionKind !== "local") throw Error("Remote workspace files are unavailable.");
	if (!t.supportsFiles) throw Error("This workspace does not support files.");
	return t;
}, Ut = (e, t, n, r) => {
	let i = Ht(e), a = Lt(t.path, i.workspacePath), o = pe(L(i, e.projectId), a), s = {
		kind: "page",
		page: ke.workspace,
		resource: o,
		position: t.position
	};
	return {
		kind: "page",
		target: s,
		href: v({
			projectId: e.projectId,
			location: s,
			pages: n,
			resources: r
		})
	};
}, Wt = (e) => {
	let t = async (t) => {
		let n = J(t, e.origin);
		if (n?.kind !== "file" || !e.projectId) return null;
		let r = Ht(e), i = Lt(n.path, r.workspacePath);
		return Vt({
			projectId: e.projectId,
			workspaceId: r.id,
			path: i,
			position: n.position,
			kinds: N(e.projectId)?.resourceKinds ?? [],
			documentKey: (t) => e.workbench.pages.listPages().find((e) => e.ref.id === t.id && e.ref.extensionId === t.extensionId)?.document?.metadataKey,
			execute: async (t, n) => {
				let r = await re(e.projectId, t, {
					params: n,
					source: "dashboard"
				});
				if (!r.outcome.ok) throw Error("Could not resolve the resource path.");
				return r.outcome.value;
			}
		});
	}, n = async (t) => {
		let n = Ht(e), r = Lt(t, n.workspacePath), i = r.includes("/") ? r.slice(0, r.lastIndexOf("/")) : "", a = R(), o = await a.fetchQuery(de(n.id, i));
		return o.entries.some((e) => e.type === "file" && e.path === r) ? !0 : o.truncated ? a.fetchQuery(fe(n.id, r)).then(() => !0, (e) => e instanceof Re && (e.status === 413 || e.status === 415)) : !1;
	}, r = (t) => {
		let n = J(t, e.origin);
		if (!n) throw Error("This text is not a file link.");
		if (n.kind === "invalid") throw Error(n.reason);
		if (!e.projectId) throw Error("The conversation has no project.");
		let r = e.workbench.pages.listPages(), i = y;
		if (n.kind === "page" || n.kind === "external") {
			let t = new URL(n.href, e.origin);
			if (t.origin !== e.origin || !t.pathname.startsWith("/projects/")) return;
			let a = decodeURIComponent(t.pathname.split("/")[2] ?? "");
			if (a !== e.projectId) return {
				kind: "project",
				projectId: a,
				href: t.pathname + t.search
			};
			let o = _({
				url: t.pathname + t.search,
				projectId: e.projectId,
				pages: r,
				resources: i
			});
			if (!o) throw Error("This page or document link is unavailable in the conversation project.");
			let s = {
				kind: "page",
				page: r.find((e) => e.id === o.pageId).ref,
				resource: o.resource,
				section: o.section,
				position: o.position
			};
			return {
				kind: "page",
				target: s,
				href: v({
					projectId: e.projectId,
					location: s,
					pages: r,
					resources: i
				})
			};
		}
		return Ut(e, n, r, i);
	};
	return {
		async resolveResource(i) {
			try {
				let a = await t(i);
				if (a) return {
					label: a.resource.label ?? a.resource.shorthand ?? a.resource.id,
					icon: a.resource.icon,
					href: a.target.kind === "page" ? v({
						projectId: e.projectId,
						location: a.target,
						pages: e.workbench.pages.listPages(),
						resources: y
					}) : null
				};
				let o = J(i, e.origin);
				if (o?.kind === "file" && Pe(i) && !await n(o.path)) return null;
				let s = r(i)?.href;
				return s ? { href: s } : null;
			} catch {
				return null;
			}
		},
		async resolveImageSource(t) {
			try {
				let n = J({
					source: t,
					origin: "markdown"
				}, e.origin);
				if (n?.kind !== "file" || n.position) return null;
				let r = Ht(e), i = Lt(n.path, r.workspacePath), a = await R().fetchQuery(fe(r.id, i));
				return a.encoding === "base64" ? a.data_url ?? null : null;
			} catch {
				return null;
			}
		},
		async resolveIcon(e) {
			return R().fetchQuery({
				queryKey: ["link-icons", new URL(e).origin],
				queryFn: ({ signal: t }) => M().linkIcons.get(e, { signal: t }).then((e) => e.data_url, () => null),
				staleTime: Infinity
			});
		},
		describe(t) {
			return `Open ${t.source}${e.workspace ? ` in workspace ${e.workspace.title}` : ""}`;
		},
		resolveHref(e) {
			try {
				return r(e)?.href ?? null;
			} catch {
				return null;
			}
		},
		async open(n) {
			try {
				if (P(e.workbench) !== e.projectId) return;
				let i = await t(n);
				if (P(e.workbench) !== e.projectId) return;
				if (i) {
					await e.workbench.navigation.openTarget(T(i.target));
					return;
				}
				let a = r(n);
				if (!a) return;
				if (a.kind === "project") {
					await Ft({
						workbench: e.workbench,
						href: a.href,
						projectId: a.projectId,
						sourceProjectId: e.projectId
					});
					return;
				}
				let o = e.workbench.pageLocations.navigate(a.target);
				if (!o.ok) throw Error(o.diagnostic.message);
			} catch (t) {
				e.onError(`${n.source}: ${t instanceof Error ? t.message : "Could not open this link."}`);
			}
		}
	};
}, Gt = (e, t, n) => {
	let [r, i] = H(null), { data: a } = A((e) => n ? e.from({ w: D("workspaces") }).where(({ w: e }) => k(e.id, n)).select(({ w: e }) => ({ ...e })) : void 0, [n]), [o] = ce({ workspaces: O(a) ?? [] }, t);
	return {
		handler: Wt({
			workbench: e,
			projectId: t,
			workspace: o,
			origin: window.location.origin,
			onError: i
		}),
		notice: r ? /* @__PURE__ */ K(we, {
			status: "error",
			title: "Could not open link",
			onClose: () => i(null),
			children: r
		}) : null
	};
}, Kt = (e, t, n) => e.map((e) => ({
	id: e.id,
	label: e.title,
	searchText: [
		e.title,
		e.shorthand,
		e.branch
	].filter(Boolean).join(" "),
	icon: u,
	isSelected: e.id === t,
	onSelect: () => n(e.id)
})), qt = () => /* @__PURE__ */ K(be, {
	as: u,
	boxSize: "14px",
	color: "fg"
}), Jt = (e) => {
	let { label: t, disabled: n = !1 } = e;
	return /* @__PURE__ */ q(_e, {
		variant: "ghost",
		size: "xs",
		px: "2xs",
		minW: "0",
		"aria-label": "Select workspace",
		disabled: n,
		children: [
			/* @__PURE__ */ K(qt, {}),
			/* @__PURE__ */ K(Ce, {
				textStyle: "label/XS/medium",
				color: "fg",
				ml: "2xs",
				truncate: !0,
				children: t
			}),
			n ? null : /* @__PURE__ */ K(be, {
				as: l,
				boxSize: "14px",
				color: "fg.muted"
			})
		]
	});
}, Yt = (e) => {
	let { label: t } = e;
	return /* @__PURE__ */ q(ve, {
		align: "center",
		gap: "2xs",
		minW: "0",
		px: "2xs",
		h: "7",
		children: [/* @__PURE__ */ K(qt, {}), /* @__PURE__ */ K(Ce, {
			textStyle: "label/XS/medium",
			color: "fg",
			truncate: !0,
			children: t
		})]
	});
}, Xt = (e) => {
	let { workspaces: t, selectedWorkspaceId: n, selectedWorkspaceLabel: r, onSelectWorkspace: i, isDisabled: a = !1 } = e, o = r || "Select workspace";
	return a ? /* @__PURE__ */ K(De, {
		content: "Workspace",
		children: /* @__PURE__ */ K(W, {
			minW: "0",
			children: /* @__PURE__ */ K(Yt, { label: o || "No workspace" })
		})
	}) : /* @__PURE__ */ K(Ee, {
		trigger: /* @__PURE__ */ K(W, {
			minW: "0",
			children: /* @__PURE__ */ K(De, {
				content: t.length === 0 ? "No workspaces" : "Select workspace",
				children: /* @__PURE__ */ K(Jt, {
					label: o,
					disabled: t.length === 0
				})
			})
		}),
		items: Kt(t, n, i),
		width: "280px",
		showSearch: t.length > 10,
		searchPlaceholder: "Search workspaces...",
		contentTestId: "session-workspace-options",
		emptyState: /* @__PURE__ */ K(Se.Item, {
			value: "empty",
			asChild: !0,
			children: /* @__PURE__ */ K(Te, {
				asChild: !0,
				variant: "compact",
				id: "empty",
				label: "No workspaces",
				icon: /* @__PURE__ */ K(be, {
					as: u,
					boxSize: "16px"
				}),
				disabled: !0
			})
		})
	});
}, Zt = (e) => {
	let t = e.workspaces.find((t) => t.id === e.selectedWorkspaceId);
	return t ? t.title : e.workspaceTitle || e.workspaceShorthand;
}, Qt = (e) => {
	let { view: t, projectId: n, selectedWorkspaceId: r, setSelectedWorkspaceId: i, onSelectWorkspace: a } = e, { isLoading: o } = j(n), s = le(n), c = s.map((e) => e.id).join("|"), l = s.find((e) => e.isDefault)?.id ?? null, u = Zt({
		selectedWorkspaceId: r,
		workspaceTitle: t.workspaceTitle,
		workspaceShorthand: t.workspaceShorthand,
		workspaces: s
	}), d = !!t.sessionId;
	return B(() => {
		let e = Pt({
			workspaces: s,
			selectedWorkspaceId: r,
			fallbackWorkspaceId: t.workspaceId ?? l
		});
		e !== r && i(e);
	}, [
		l,
		r,
		i,
		t.workspaceId,
		c
	]), /* @__PURE__ */ K(Xt, {
		workspaces: s,
		selectedWorkspaceId: r,
		selectedWorkspaceLabel: u,
		onSelectWorkspace: (e) => {
			let t = s.find((t) => t.id === e);
			i(e), t && a?.(t);
		},
		isDisabled: d || o
	});
}, $t = (e) => {
	let { additions: t, deletions: n, action: r, ...i } = e;
	return /* @__PURE__ */ K(Me, {
		workspaceControl: /* @__PURE__ */ K(Qt, { ...i }),
		additions: t,
		deletions: n,
		action: r
	});
}, en = (e) => {
	let { input: t, deviceName: n, onInterrupt: r } = e;
	return n ? /* @__PURE__ */ K(ge, { name: n }) : /* @__PURE__ */ K(he, {
		onInterrupt: r,
		onReviewExtensions: () => void t.workbench.commands.executeCommand(w, { panelId: "extensions" })
	});
}, tn = () => s({ mutationFn: (e) => {
	let { sessionId: t, queuePosition: n, ...r } = e;
	return M().sessions.updateQueuedFollowUp(t, n, r);
} }), nn = () => s({ mutationFn: (e) => M().sessions.removeQueuedFollowUp(e.sessionId, e.queuePosition, e.expectedRevision) }), rn = () => s({ mutationFn: (e) => M().sessions.moveQueuedFollowUp(e.sessionId, e.queuePosition, {
	direction: e.direction,
	expectedRevision: e.expectedRevision,
	steps: e.steps,
	expectedOrder: e.expectedOrder
}) }), an = () => s({ mutationFn: (e) => M().sessions.combineQueuedFollowUps(e.sessionId, e.queuePosition, {
	sourcePosition: e.sourcePosition,
	sourceRevision: e.sourceRevision,
	targetRevision: e.targetRevision
}) }), on = () => s({ mutationFn: (e) => M().sessions.steerQueuedFollowUp(e.sessionId, e.queuePosition, {
	expectedRevision: e.expectedRevision,
	expectedRunStartedAt: e.expectedRunStartedAt
}) }), sn = (e) => {
	let { sessionId: t, queuedFollowUps: n, activeRunStartedAt: r, editRequest: i, afterUpdate: a, refreshQueue: o } = e, [s, c] = H(null), l = tn(), u = nn(), d = rn(), f = an(), p = on(), m = (e) => {
		if (!t || e.position === void 0) throw Error("The queued request is no longer available.");
		return {
			sessionId: t,
			queuePosition: e.position
		};
	};
	return {
		handleQueuedFollowUpUpdate: async (e, t) => {
			let r = n.find((t) => t.id === e);
			if (!r) throw Error("The queued request changed. Your edit is kept.");
			await l.mutateAsync({
				...m(r),
				...i(e, t)
			}), a(e), o();
		},
		handleQueuedFollowUpRemove: (e) => {
			let t = n.find((t) => t.id === e);
			t && u.mutateAsync({
				...m(t),
				expectedRevision: t.revision
			}).then(o).catch((e) => c(e instanceof Error ? e.message : "Could not remove the queued request."));
		},
		handleQueuedFollowUpMove: async (e, t, r = 1, i) => {
			let a = i?.source ?? n.find((t) => t.id === e);
			a && (await d.mutateAsync({
				...m(a),
				direction: t,
				steps: r,
				expectedRevision: a.revision,
				expectedOrder: (i?.items ?? n).filter((e) => !e.sending && !e.steeringDelivery).map((e) => ({
					queuePosition: e.position,
					revision: e.revision
				}))
			}), o());
		},
		handleQueuedFollowUpCombine: async (e, t) => {
			if (!e.revision || !t.revision || e.position === void 0) throw Error("Refresh the queue before combining.");
			await f.mutateAsync({
				...m(t),
				sourcePosition: e.position,
				sourceRevision: e.revision,
				targetRevision: t.revision
			}), o();
		},
		handleQueuedFollowUpSteer: async (e) => {
			if (!e.revision || !r) throw Error("Refresh the queue before sending to the active work.");
			let t = await p.mutateAsync({
				...m(e),
				expectedRevision: e.revision,
				expectedRunStartedAt: r
			});
			if (o(), t.status !== "accepted") throw Error(t.message);
		},
		actionError: s,
		clearActionError: () => c(null)
	};
}, cn = (e) => `pstdio-dashboard:command-params:recent-harness:${e}`, ln = () => {
	try {
		return globalThis.localStorage;
	} catch {
		return;
	}
}, un = (e) => e ?? ln(), dn = (e, t) => {
	let n = un(t);
	if (!e || !n) return;
	let r = n.getItem(cn(e));
	if (r) try {
		let e = JSON.parse(r);
		if (typeof e.harnessId != "string" || e.harnessId.length === 0) return;
		let t = e.params;
		return {
			harnessId: e.harnessId,
			...typeof e.model == "string" && e.model.length > 0 ? { model: e.model } : {},
			...t && typeof t == "object" && !Array.isArray(t) ? { params: Object.fromEntries(Object.entries(t).filter(([, e]) => typeof e == "string" || typeof e == "boolean")) } : {}
		};
	} catch {
		return;
	}
}, fn = (e, t, n) => {
	let r = un(n);
	if (!e || !r || !t.harnessId) return;
	let i = dn(e, r), a = t.params ?? (i?.harnessId === t.harnessId ? i.params : void 0);
	r.setItem(cn(e), JSON.stringify({
		...t,
		...a ? { params: a } : {}
	}));
}, pn = (e) => {
	let { view: t, selectionScope: n = "draft", projectId: r, selectedAgent: i, setSelectedAgent: a, selectedModel: o, setSelectedModel: s, harnessParamOverrides: c, setHarnessParamOverrides: l } = e, { data: u } = j(r), { data: h = [], isLoading: g } = ne(r), _ = h.map((e) => ({
		label: e.name,
		value: e.id,
		disabled: e.availability.type === "NOT_FOUND",
		description: e.availability.reason
	})), v = h.find((e) => e.id === i), y = v?.supportsModels ?? !0, b = u?.default_agent_id, x = h.some((e) => e.id === i), S = m(r, x ? i : void 0, o), { data: C = [], isLoading: w } = p(i, {
		enabled: !!i && x,
		projectId: r
	}), T = C.map((e) => ({
		label: e.label ?? e.id,
		value: e.id,
		description: e.description
	}));
	o && !T.some((e) => e.value === o) && T.push({
		label: o,
		value: o,
		description: void 0
	});
	let E = t.lastSelectedModel ?? u?.default_agent_model ?? "", D = S.data?.schema ?? v?.params, O = f(C, o), k = d(D, O), A = Le(k, S.data?.defaults), M = Object.fromEntries(Object.entries(c).filter(([e, t]) => !Object.is(A[e], t)));
	return B(() => {
		let e = At({
			agentOptions: _,
			selectedAgent: i,
			sessionAgent: t.agent,
			defaultAgent: b
		});
		e !== i && a(e);
	}, [
		_,
		b,
		i,
		a,
		t.agent
	]), B(() => {
		if (w || n === "request") return;
		let e = y ? Mt({
			models: C,
			selectedModel: o,
			preferredModel: E
		}) : "";
		e !== o && s(e);
	}, [
		w,
		C,
		y,
		E,
		o,
		s,
		n
	]), B(() => {
		!D || w || o && !O || l((e) => {
			let t = d(D, O), n = Fe(t, e);
			return Ie(e, n) ? e : n;
		});
	}, [
		D,
		w,
		o,
		O,
		l
	]), /* @__PURE__ */ q(ye, {
		gap: "2xs",
		minW: "0",
		children: [/* @__PURE__ */ K(ae, {
			agentOptions: _,
			selectedAgent: x ? i : "",
			onSelectAgent: (e) => {
				if (a(e), s(""), n === "request") return;
				let t = dn(r), i = t?.harnessId === e ? t.params ?? {} : {};
				l(i), fn(r, {
					harnessId: e,
					params: i
				});
			},
			modelOptions: x ? T : [],
			selectedModel: x ? o : "",
			onSelectModel: (e) => {
				s(e), i && n === "draft" && fn(r, {
					harnessId: i,
					...e ? { model: e } : {},
					params: c
				});
			},
			offersModels: y,
			isAgentSwitchDisabled: !!(t.sessionId && t.agent),
			isAgentsLoading: g,
			isModelsLoading: w,
			size: "xs"
		}), /* @__PURE__ */ K(oe, {
			schema: k ?? void 0,
			defaults: A,
			overrides: M,
			onOverridesChange: (e) => {
				let t = {
					...A,
					...e
				};
				l(t), n === "draft" && fn(r, {
					harnessId: i,
					model: o,
					params: t
				});
			},
			disabled: !x,
			size: "xs"
		})]
	});
}, mn = (e) => {
	let { children: t, ...n } = e;
	return /* @__PURE__ */ q(G, { children: [/* @__PURE__ */ K(pn, { ...n }), t] });
}, hn = async (e) => {
	for (let t of e.files) {
		let n = await e.uploadFile(t);
		e.onUploaded(n);
	}
}, gn = (e, t) => new File([e], `clipboard-${t}.txt`, { type: "text/plain" }), _n = async (e, t) => M().sessions.uploadAttachment(e, {
	name: t.name,
	data: await t.arrayBuffer(),
	mimeType: t.type
}), vn = (e, t) => M().sessions.deleteAttachment(e, t), yn = {
	attachments: [],
	uploading: !1
}, bn = () => yn, xn = () => () => void 0, Sn = (e, t, n, r = []) => {
	let i = e ? n?.getAttachmentDraft(e, t) : void 0, { attachments: a, uploading: o } = U(i?.subscribe ?? xn, i?.getSnapshot ?? bn), s = V(0), c = async (t) => {
		if (e && i && t.length !== 0) {
			i.changeUploading(1);
			try {
				await hn({
					files: t,
					onUploaded: (e) => i.changeAttachments((t) => [...t, e]),
					uploadFile: (t) => _n(e, t)
				});
			} finally {
				i.changeUploading(-1);
			}
		}
	};
	return {
		attachments: a,
		clearSubmittedAttachments: () => i?.changeAttachments(() => []),
		removeAttachment: (t) => {
			e && (i?.changeAttachments((e) => e.filter((e) => e.file_id !== t)), r.includes(t) || vn(e, t).catch(() => void 0));
		},
		restoreAttachments: (e) => {
			i?.changeAttachments((t) => [...e, ...t.filter((t) => !e.some((e) => e.file_id === t.file_id))]);
		},
		uploadFiles: c,
		uploadText: (e) => (s.current += 1, c([gn(e, s.current)])),
		uploading: o
	};
}, Cn = (e) => ({
	file_id: e.id,
	name: e.name,
	mime_type: e.mediaType ?? null,
	size_bytes: e.size ?? 0,
	hash: null,
	url: e.url ?? "",
	created_at: "",
	updated_at: ""
}), wn = (e, t, n) => {
	let [r, i] = H(null), [a, o] = H({}), s = r ? a[r] : void 0, c = (e) => `${t}:queued:${e}`, l = Sn(e, c(r ?? "inactive"), n, s?.item.attachments?.map((e) => e.id) ?? []), u = (t) => {
		t && !a[t.id] && (o((e) => ({
			...e,
			[t.id]: {
				item: t,
				model: t.model ?? "",
				params: t.params ?? {}
			}
		})), e && n?.getAttachmentDraft(e, c(t.id)).changeAttachments(() => (t.attachments ?? []).map(Cn))), i(t?.id ?? null);
	}, d = (t) => {
		o((e) => {
			let n = { ...e };
			return delete n[t], n;
		}), e && n?.getAttachmentDraft(e, c(t)).changeAttachments(() => []), t === r && i(null);
	}, f = (t) => {
		let r = new Set(a[t]?.item.attachments?.map((e) => e.id)), i = e ? n?.getAttachmentDraft(e, c(t)).getSnapshot().attachments ?? [] : [];
		if (d(t), e) for (let t of i) r.has(t.file_id) || vn(e, t.file_id).catch(() => void 0);
	}, p = (e) => JSON.stringify(Object.entries(e).sort(([e], [t]) => e.localeCompare(t)));
	return {
		selection: s,
		edits: a,
		select: u,
		discard: f,
		commit: d,
		setModel: (e) => {
			r && o((t) => {
				let n = t[r];
				return n ? {
					...t,
					[r]: {
						...n,
						model: typeof e == "function" ? e(n.model) : e
					}
				} : t;
			});
		},
		setParams: (e) => {
			r && o((t) => {
				let n = t[r];
				return n ? {
					...t,
					[r]: {
						...n,
						params: typeof e == "function" ? e(n.params) : e
					}
				} : t;
			});
		},
		attachments: l,
		dirtyItemIds: Object.entries(a).filter(([t, r]) => {
			let i = e ? n?.getAttachmentDraft(e, c(t)).getSnapshot().attachments ?? [] : [];
			return r.model !== (r.item.model ?? "") || p(r.params) !== p(r.item.params ?? {}) || JSON.stringify(i.map((e) => e.file_id)) !== JSON.stringify(r.item.attachments?.map((e) => e.id) ?? []);
		}).map(([e]) => e)
	};
}, Tn = (e) => {
	let { projectId: t, sessionId: n, draftKey: r, drafts: i, queue: a, refreshQueue: o, draftAttachments: s, modelControls: c, ...l } = e, u = wn(t, r, i), d = Dt(), f = u.selection ? u.attachments : s, p = sn({
		sessionId: n,
		queuedFollowUps: l.queuedFollowUps ?? [],
		refreshQueue: o,
		activeRunStartedAt: a?.activeRunStartedAt,
		editRequest: (e, t) => {
			let n = u.edits[e];
			if (!n?.item.revision) throw Error("Refresh the queue before editing this request.");
			return {
				prompt: t,
				expectedRevision: n.item.revision,
				model: n.model || null,
				params: n.params,
				attachments: u.attachments.attachments.map((e) => ({ file_id: e.file_id }))
			};
		},
		afterUpdate: u.commit
	}), m = () => {
		p.clearActionError(), o();
	};
	return /* @__PURE__ */ K(Ae, {
		...l,
		conversationNotices: /* @__PURE__ */ q(G, { children: [l.conversationNotices, /* @__PURE__ */ K(me, {
			queueError: p.actionError ? {
				message: p.actionError,
				temporary: !1
			} : void 0,
			reconnect: m,
			refreshQueue: m
		})] }),
		onQueuedFollowUpUpdate: n ? p.handleQueuedFollowUpUpdate : void 0,
		onQueuedFollowUpCreate: async (e, t) => {
			let r = u.edits[e];
			if (!n || !r) throw Error("The queued edit is no longer available.");
			await d.mutateAsync({
				sessionId: n,
				prompt: t,
				model: r.model,
				params: r.params,
				attachments: u.attachments.attachments
			}), u.commit(e), o();
		},
		canRestoreQueuedEditToDraft: !!a && !s.attachments.length && !s.uploading,
		onQueuedFollowUpRestoreDraft: (e) => {
			let t = u.edits[e];
			t && (s.restoreAttachments(u.attachments.attachments), c.setSelectedModel(t.model), c.setHarnessParamOverrides(t.params), u.commit(e));
		},
		onQueuedFollowUpSelect: u.select,
		onQueuedFollowUpDiscard: u.discard,
		onQueuedFollowUpCombine: p.handleQueuedFollowUpCombine,
		onQueuedFollowUpSteer: p.handleQueuedFollowUpSteer,
		queueSteeringUnavailableReason: a ? a.steeringUnavailableReason : "Refresh the queue to check live input support.",
		unsavedQueueItemIds: u.dirtyItemIds,
		onQueuedFollowUpRemove: n ? p.handleQueuedFollowUpRemove : void 0,
		onQueuedFollowUpMove: n ? p.handleQueuedFollowUpMove : void 0,
		actions: /* @__PURE__ */ K(mn, {
			...c,
			selectedModel: u.selection?.model ?? c.selectedModel,
			setSelectedModel: u.selection ? u.setModel : c.setSelectedModel,
			harnessParamOverrides: u.selection?.params ?? c.harnessParamOverrides,
			setHarnessParamOverrides: u.selection ? u.setParams : c.setHarnessParamOverrides,
			selectionScope: u.selection ? "request" : "draft"
		}),
		attachmentActions: /* @__PURE__ */ K(b, {
			projectId: t,
			uploading: f.uploading,
			onAttachFiles: (e) => void f.uploadFiles(e)
		}),
		attachmentList: f.attachments.length ? /* @__PURE__ */ K(x, {
			attachments: f.attachments,
			onRemove: f.removeAttachment
		}) : void 0,
		onAttachFiles: t ? (e) => void f.uploadFiles(e) : void 0,
		onAttachText: t ? (e) => void f.uploadText(e) : void 0,
		inputDisabled: f.uploading || l.inputDisabled
	});
}, En = (e, t) => {
	let n = /^\/\S+/.exec(e)?.[0], r = t.commands.find((e) => e.name === n);
	if (r?.disabledReason) throw Error(r.disabledReason);
	let i = /^\/\S+\s+(\/\S+)(?:\s|$)/.exec(e)?.[1];
	if (t.commands.some((e) => e.name === i)) throw Error("Submit one native command at a time. This harness has not declared command composition.");
}, Dn = (e, t, n) => {
	if (e.harnessId !== t) return `Remove ${e.command.composer?.label} or return to its harness.`;
	let r = n?.commands.find((t) => t.name === e.command.name);
	return !n?.slashCommands || !r?.composer ? "This tagged input is unavailable. Check the harness or remove the tag." : r.disabledReason;
}, On = (e, t, n, r, i) => {
	let a = Dn(e, n, r);
	if (a) throw Error(a);
	if (i) throw Error("Remove attachments before submitting tagged native input.");
	let o = t.trim();
	if (!o) throw Error("Enter an objective before submitting this tag.");
	if ((r?.commands.find((t) => t.name === e.command.name))?.composer?.reservedArguments?.includes(o)) throw Error("This text is a native action. Use the native controls or enter an objective.");
	return {
		kind: "command",
		text: `${e.command.name} ${o}`
	};
}, kn = (e, t, n, r, i) => !e?.slashCommands || t ? [] : e.commands.map((e) => ({
	...e,
	disabledReason: e.disabledReason ?? (n && e.name !== n.command.name ? `Remove ${n.command.composer?.label} first.` : void 0),
	...e.composer ? { onSelect: () => i({
		harnessId: r,
		command: e
	}) } : {}
})), An = /* @__PURE__ */ new Map(), jn = (e, t) => An.set(e, t), Mn = (e, t) => {
	if (!e) return null;
	let n = An.get(e);
	return !n || n.harnessId !== t ? null : (An.delete(e), n);
}, Nn = (e, t, n) => {
	let r = e.find((e) => e.id === n.modeId), i = t.find((e) => e.id === n.modeId);
	if (!r || !i || r.description !== i.description || r.confirmation?.id !== i.confirmation?.id || !i.actions.some((e) => e.id === n.actionId)) throw Error("The native mode changed. Review its current details before acting again.");
}, Pn = (e, t, n, a, o) => {
	let c = C(o.workbench.layout.store, () => Be(o)), l = r(), u = [
		"harness-commands",
		e,
		t,
		e ? void 0 : n
	], d = i({
		queryKey: u,
		enabled: c && !!(t && (e || n)),
		refetchInterval: (t) => e || t.state.status === "error" ? 2e3 : !1,
		queryFn: ({ signal: t }) => e ? M().sessions.getHarnessCommands(e, t) : M().sessions.getDraftHarnessCommands(n, t)
	}), f = s({
		mutationFn: async ({ operation: n, modeSnapshot: r }) => {
			if (n.kind === "mode-action") {
				let e = await d.refetch();
				if (e.error || e.data?.harnessId !== t) throw Error("Native status is unavailable. Wait for it to reconnect before trying again.");
				Nn(r ? [r] : d.data?.modes ?? [], e.data.modes, n);
			}
			return e ? M().sessions.invokeHarnessOperation(e, n, t) : a(n);
		},
		onSettled: async () => {
			await l.invalidateQueries({ queryKey: u });
		}
	});
	return {
		state: d.data?.harnessId === t ? d.data : void 0,
		invoke: f,
		loading: d.isLoading,
		error: d.error
	};
}, Fn = (e) => {
	let { error: t, outcome: n, onDismissError: r, onDismissOutcome: i } = e;
	return /* @__PURE__ */ q(G, { children: [t ? /* @__PURE__ */ K(we, {
		status: "error",
		title: "Command failed",
		onClose: r,
		children: t
	}) : null, n ? /* @__PURE__ */ K(we, {
		status: "info",
		title: "Command result",
		onClose: i,
		children: n
	}) : null] });
}, In = (e, t) => JSON.stringify([
	e,
	t.id,
	t.confirmation?.id
]), Ln = (e, t, n, r) => {
	let i = e?.scope === t ? { ...e.byMode } : {};
	return r ? i[n] = r : delete i[n], {
		scope: t,
		byMode: i
	};
}, Rn = (e, t, n) => e?.find((e) => e.confirmation && e.actions.some((t) => t.id === e.confirmation?.actionId) && (n?.scope !== t || n.byMode[e.id] !== In(t, e))), zn = (e, t) => {
	let n = e.confirmation, r = e.actions.find((e) => e.id === n?.actionId);
	if (!n || !r) return;
	let i = In(t.scope, e);
	return {
		id: i,
		pending: t.pending,
		model: n.model,
		actions: [
			{
				id: "skip",
				label: "Skip",
				variant: "ghost"
			},
			{
				id: "continue",
				label: n.cancelLabel ?? "Cancel",
				variant: "subtle"
			},
			{
				id: "approve",
				label: r.label,
				variant: "primary",
				disabled: t.unavailable
			}
		],
		onAction: async (a) => {
			if (t.pending) throw Error("A native action is already pending.");
			if (a === "skip" || a === "continue") t.onDismiss(i);
			else {
				if (a !== "approve") throw Error("Choose one of the available actions.");
				if (t.unavailable) throw Error("Native status is unavailable. Check it before approving.");
				await t.onAction(e.id, r.id, n.id, e), t.onDismiss(i);
			}
		}
	};
}, Bn = (e, t) => {
	let [n, r] = H(), i = Rn(e, t.scope, n);
	return {
		decision: i ? zn(i, {
			...t,
			onDismiss: (e) => r((n) => Ln(n, t.scope, i.id, e))
		}) : void 0,
		reopen: (e) => r((n) => Ln(n, t.scope, e))
	};
}, Vn = (e, t, n, r, i, a, o, s, c, l) => {
	let u = JSON.stringify([
		e,
		t,
		e ? void 0 : o
	]), d = V(u);
	d.current = u;
	let [f, p] = H(null), m = Pn(e, t, o, s, l), [h, g] = H(null), [_, v] = H(null), [y, b] = H(null), [x, S] = H(null), C = y ? Dn(y, t, m.state) : void 0, w = async (e, t) => {
		let n = u;
		try {
			g(null), v(null);
			let i = await m.invoke.mutateAsync({
				operation: e,
				modeSnapshot: t
			});
			if (d.current !== n) throw new DOMException("The conversation changed.", "AbortError");
			return v(i.message ?? null), r(), i;
		} catch (e) {
			throw d.current === n && g(e instanceof Error ? e.message : String(e)), e;
		}
	}, T = V(null);
	B(() => {
		if (T.current === u) return;
		T.current = u;
		let n = Mn(e, t);
		p(n?.kind === "pending" ? {
			scope: u,
			...n
		} : null), g(null), v(n?.kind === "outcome" ? n.message ?? null : null), S(n?.submitted ?? null);
	}, [
		u,
		e,
		t
	]), B(() => {
		x?.intent.command.composer?.modeId && m.state?.modes.some((e) => e.id === x.intent.command.composer?.modeId) && S(null);
	}, [x, m.state]), B(() => {
		let e = f;
		i && e && e.scope === u && a !== e.previousRequest && ([
			"in_progress",
			"awaiting_input",
			"queued"
		].includes(i) || (p(null), (i === "failed" || i === "disconnected") && (n.text || (n.change(e.submitted?.objective ?? e.text), b(e.submitted?.intent ?? null)), S(null), g(e.message ?? `Native command ${e.text} ${i}. Check the conversation before retrying.`))));
	}, [
		u,
		i,
		a,
		n,
		f
	]);
	let E = (e, n, r) => {
		let i = y ? {
			intent: y,
			objective: n.trim()
		} : void 0;
		e.status === "started" ? e.sessionId ? jn(e.sessionId, {
			kind: "pending",
			harnessId: t,
			text: n,
			previousRequest: null,
			message: e.message,
			submitted: i
		}) : p({
			scope: u,
			text: n,
			previousRequest: a,
			submitted: i
		}) : e.sessionId && jn(e.sessionId, {
			kind: "outcome",
			harnessId: t,
			message: e.message,
			submitted: i
		}), r?.(), b(null), S(i ?? null), e.sessionId && c(e.sessionId, n);
	}, D = (e, n, r) => {
		if (!r) {
			if (y) return On(y, e, t, m.state, n.length);
			if (/^\/[^\s/]+(?:\s|$)/.test(e)) {
				if (!m.state) throw Error(m.loading ? "Commands are still loading. Try again when they are ready." : "Native commands are unavailable. Reload the session and try again.");
				if (m.state.slashCommands) {
					if (n.length) throw Error("Remove attachments before running this command.");
					return En(e, m.state), {
						kind: "command",
						text: e
					};
				}
			}
		}
	}, O = async (e, t, n, r) => {
		let i = await w({
			kind: "mode-action",
			modeId: e,
			actionId: t,
			argument: n
		}, r);
		i.sessionId && c(i.sessionId, "New session");
	}, k = Bn(m.state?.modes, {
		scope: u,
		pending: m.invoke.isPending,
		unavailable: !!m.error,
		onAction: O
	});
	return {
		decision: k.decision,
		suggestions: kn(m.state, m.invoke.isPending, y, t, b),
		submit: (e, t, n, r) => {
			try {
				let i = D(e, t, n);
				return i ? w(i).then((t) => E(t, e, r)) : void 0;
			} catch (e) {
				return g(e instanceof Error ? e.message : String(e)), Promise.reject(e);
			}
		},
		controls: /* @__PURE__ */ K(Ne, {
			modes: m.state?.modes ?? [],
			draftTag: y ? {
				label: y.command.composer?.label ?? y.command.name,
				closeLabel: `Remove ${y.command.composer?.label ?? y.command.name}`,
				description: C ?? `${y.command.composer?.label}: ${n.text.trim() || "draft input"} · ${m.invoke.isPending ? "Starting" : "Draft"}`,
				onClose: () => b(null)
			} : void 0,
			sentTag: x && !m.state?.modes.some((e) => e.id === x.intent.command.composer?.modeId) ? {
				label: x.intent.command.composer?.label ?? x.intent.command.name,
				description: `${x.objective} · Native status is not confirmed. Closing hides this reference only.`,
				onClose: () => S(null),
				closeLabel: `Hide submitted ${x.intent.command.composer?.label?.toLowerCase() ?? "input"}`
			} : void 0,
			pending: m.invoke.isPending,
			unavailable: !!m.error,
			onRequestConfirmation: k.reopen,
			onAction: O
		}),
		notices: /* @__PURE__ */ K(Fn, {
			error: h,
			outcome: _,
			onDismissError: () => g(null),
			onDismissOutcome: () => v(null)
		})
	};
}, Hn = (e, t, n, r, i) => {
	let a = U(rt, () => nt(e));
	return B(() => {
		a && !a.failure && mt(n, t, a, r) && $(e, (e) => e === a ? null : e);
	}, [
		e,
		t,
		n,
		a,
		r
	]), {
		pendingFollowUp: a,
		pendingWork: !(!a || a.failure || a.destination !== "conversation"),
		displayedMessages: at(n, a),
		streamingStartedAt: st(r, a?.failure ? void 0 : a ?? void 0, i)
	};
}, Un = (e, t) => {
	let [n, r] = H(() => e?.getDraft(t) ?? "");
	return {
		text: n,
		change: (n) => {
			r(n), e?.setDraft(t, n);
		}
	};
}, Wn = (e, t) => {
	let [n] = H(() => e.sessionId ? void 0 : dn(t)), [r, i] = H(e.agent ?? n?.harnessId ?? ""), [a, o] = H(e.lastSelectedModel ?? n?.model ?? ""), [s, c] = H(e.workspaceId ?? ""), [l, u] = H(e.sessionId ? e.params ?? {} : n?.params ?? {}), d = V(e);
	return B(() => {
		let t = d.current;
		d.current = e;
		let n = Nt(t, e);
		n.agent !== void 0 && i(n.agent), n.model !== void 0 && o(n.model), n.workspaceId !== void 0 && c(n.workspaceId), n.params !== void 0 && u(n.params);
	}, [e]), {
		selectedAgent: r,
		setSelectedAgent: i,
		selectedModel: a,
		setSelectedModel: o,
		selectedWorkspaceId: s,
		setSelectedWorkspaceId: c,
		harnessParamOverrides: l,
		setHarnessParamOverrides: u
	};
}, Gn = (e, t, n) => {
	if (!e.workspaceId) return;
	let r = n.find((t) => t.id === e.workspaceId);
	return r ? L(r, t) : void 0;
}, Kn = (e, t, n = le(P(e.workbench))) => {
	let r = Gn(t, P(e.workbench), n);
	if (r) return ue(e.workbench, r);
}, qn = (e, t, n) => ue(e.workbench, L(t, n)), Jn = (e) => Object.keys(e).length > 0 ? e : void 0, Yn = (e) => {
	let { input: t, view: n, emptyStateTitle: r, emptyStateDescription: i, workspaceAction: a, drafts: o, history: s } = e, c = [n.workspaceTitle, n.workspaceShorthand].filter(Boolean), l = n.sessionId ?? null, u = C(t.workbench.context.store, (e) => {
		let t = e.values[ee];
		return typeof t == "string" ? t : void 0;
	}), d = Gt(t.workbench, u, n.workspaceId), { messages: f, loading: p, streaming: m, reconnect: h, refreshQueue: g, error: _, queueError: v, queue: y } = s, b = () => void t.workbench.commands.executeCommand(te.chooseProjectFolder), x = Et({ onFolderMissing: b }), S = Dt(), w = Ot(), { selectedAgent: T, setSelectedAgent: E, selectedModel: D, setSelectedModel: O, selectedWorkspaceId: k, setSelectedWorkspaceId: A, harnessParamOverrides: j, setHarnessParamOverrides: M } = Wn(n, u), N = Sn(u, n.draftKey, o), { data: P = [], isSuccess: re } = ne(u), ie = !!u && re && !P.some((e) => e.availability.type === "INSTALLED"), ae = jt({
		agentOptions: P.map((e) => ({
			value: e.id,
			disabled: e.availability.type === "NOT_FOUND"
		})),
		selectedAgent: T,
		selectedModel: D,
		requiresModel: P.find((e) => e.id === T)?.supportsModels ?? !0
	}), F = Un(o, n.draftKey), oe = (e, n) => {
		u && _t({
			input: t,
			sessionId: e,
			prompt: n,
			projectId: u
		});
	}, ce = u ? {
		project_id: u,
		agent: T,
		workspace_id: k || void 0,
		model: D || void 0,
		params: Jn(j)
	} : void 0, I = Vn(l, T, F, h, n.status, n.lastRequestStarted, ce, (e) => Xe(ce, e, b), oe, t), { pendingFollowUp: L, displayedMessages: le, streamingStartedAt: ue, pendingWork: de } = Hn(n.draftKey, l, f, n.lastRequestStarted, n.status === "in_progress"), fe = t.region !== "side", pe = ht(le, l, y, L), R = se(pe.messages), z = m || n.status === "in_progress" || de, he = !!l && z && !w.isPending, ge = (e, t, r, i) => I.submit(e, t, r, i) || St({
		conversationKey: n.draftKey,
		sessionId: l,
		sessionStatus: n.status,
		lastRequestStarted: n.lastRequestStarted,
		projectId: u,
		agent: T || null,
		model: D || void 0,
		params: Jn(j),
		workspaceId: k || void 0,
		text: e,
		attachments: t,
		questionResponse: r,
		messages: f,
		createSession: x,
		followUp: S,
		reconnect: h,
		refreshQueue: g,
		onSubmitted: i,
		onSessionCreated: (t) => oe(t, e)
	}), B = L?.failure ? L : null, V = I.decision && {
		...I.decision,
		controls: I.controls
	}, H = Ct(ge, N.attachments, () => {
		F.change(""), N.clearSubmittedAttachments();
	}), U = l && he && !n.device ? () => w.mutate(l) : void 0;
	return /* @__PURE__ */ K(W, {
		position: "relative",
		h: "full",
		w: "full",
		children: /* @__PURE__ */ K(W, {
			position: "absolute",
			inset: "0",
			overflow: "hidden",
			display: "flex",
			flexDirection: "column",
			children: /* @__PURE__ */ K(W, {
				flex: "1",
				minH: "0",
				overflow: "hidden",
				children: /* @__PURE__ */ K(Tn, {
					conversationKey: `dashboard-workbench-session:${n.id}`,
					messages: R,
					linkHandler: d.handler,
					conversationNotices: /* @__PURE__ */ q(G, { children: [
						I.notices,
						d.notice,
						/* @__PURE__ */ K(me, {
							error: _,
							queueError: v,
							reconnect: h,
							refreshQueue: g,
							unsent: B?.failure ? {
								notice: B.failure,
								...wt(B, {
									clear: () => $(n.draftKey, null),
									send: ge,
									restore: (e, t) => {
										F.change(e), N.restoreAttachments(t);
									}
								})
							} : void 0
						})
					] }),
					queuedFollowUps: pe.queuedFollowUps,
					loading: p,
					streaming: z,
					streamingStartedAt: ue,
					emptyStateTitle: r,
					emptyStateDescription: i,
					loaderComponent: /* @__PURE__ */ K(je, {}),
					chatInputPlaceholder: "Reply to the agent...",
					chatInputDefaultValue: F.text,
					onChatInputChange: F.change,
					chatInputCommands: I.suggestions,
					composerDecision: V,
					composerFallback: n.device || ie ? /* @__PURE__ */ K(en, {
						input: t,
						deviceName: n.device?.name,
						onInterrupt: U
					}) : void 0,
					attachedResources: c,
					projectId: u,
					sessionId: l,
					draftKey: n.draftKey,
					drafts: o,
					queue: y,
					refreshQueue: g,
					draftAttachments: N,
					modelControls: {
						projectId: u,
						view: n,
						selectedAgent: T,
						setSelectedAgent: E,
						selectedModel: D,
						setSelectedModel: O,
						harnessParamOverrides: j,
						setHarnessParamOverrides: M,
						children: I.controls
					},
					submitDisabled: !ae || !!n.device,
					inputDisabled: !!n.device,
					workspaceHub: /* @__PURE__ */ K($t, {
						view: n,
						projectId: u,
						selectedWorkspaceId: k,
						setSelectedWorkspaceId: A,
						onSelectWorkspace: fe ? (e) => void qn(t, e, u) : void 0,
						additions: n.additions,
						deletions: n.deletions,
						action: a
					}),
					onSubmitMessage: n.device ? void 0 : H,
					onInterrupt: U
				})
			})
		})
	});
}, Xn = (e) => {
	let { input: t, view: n } = e;
	return /* @__PURE__ */ K(De, {
		content: "Open workspace",
		children: /* @__PURE__ */ K(xe, {
			size: "xs",
			variant: "ghost",
			"aria-label": "Open workspace",
			onClick: () => void Kn(t, n),
			children: /* @__PURE__ */ K(c, { size: 14 })
		})
	});
}, Zn = (e) => {
	let { input: t, drafts: n } = e, [r, i] = H(() => z(t.instance));
	B(() => {
		let e = () => i(z(t.instance)), n = I(t.instance.resource?.type === "session" ? t.instance.resource.id : void 0, e);
		return e(), n;
	}, [t.instance]);
	let a = ze(t), o = Je(a, r.sessionId), s = C(t.workbench.context.store, (e) => e.values["dashboard.activeResource.kind"] === "workspace" && e.values["dashboard.activeResource.id"] === r.workspaceId);
	return /* @__PURE__ */ K(Yn, {
		input: a,
		view: r,
		history: o,
		drafts: n,
		emptyStateTitle: "No messages yet",
		emptyStateDescription: "Send a message to start this session.",
		workspaceAction: r.workspaceId && !s ? /* @__PURE__ */ K(Xn, {
			input: t,
			view: r
		}) : void 0
	}, r.draftKey);
};
export { Zn as SessionWidget };
