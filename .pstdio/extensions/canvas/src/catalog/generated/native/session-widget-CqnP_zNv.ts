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
import { t as d } from "./useTranslation-DvWg4zeU.ts";
import { a as f, i as p, r as m, t as h } from "./use-harness-param-defaults-DL_UEl4r.ts";
import { t as g } from "./resource-ref-D_HHex4N.ts";
import { n as _ } from "./navigation-oeGsFbYd.ts";
import { G as v, K as y, q as b } from "./workbench-core-kaLFKJEn.ts";
import { n as x, t as S } from "./session-attachment-list-BRyzZlux.ts";
import { t as C } from "./renderer-read-key-Bez2aamd.ts";
import { t as w } from "./use-workbench-store-BMaFgEbb.ts";
import { t as T } from "./settings-resources-BmVO5oBi.ts";
import { t as E } from "./extension-navigation-target-zjAG34BD.ts";
import { l as D, n as O, t as k, y as A } from "./collections-W65OWXaL.ts";
import { n as j, t as ee } from "./use-project-CXUANpD-.ts";
import { n as M } from "./api-D3Fkqs7r.ts";
import { i as N } from "./workbench-extension-contributions-91dBwL7l.ts";
import { i as P, n as te } from "./project-context-BR7AjHlE.ts";
import { t as ne } from "./commands-Bp5w85f4.ts";
import { t as F } from "./use-agents-D6pIYuP8.ts";
import { r as I, s as L } from "./api-CEi0FXP5.ts";
import { t as re } from "./workspace-agent-menu-DHlog8io.ts";
import { n as ie } from "./resources-CR_Z7fRd.ts";
import { t as ae } from "./harness-param-inline-controls-CDlURer7.ts";
import { n as oe } from "./api-file-url-CTxskOjG.ts";
import { a as se, f as ce, o as R, s as z, y as le } from "./dashboard-workspaces-BTeYGs-s.ts";
import { h as ue, p as B, u as de } from "./module-B-qaS9sM.ts";
import { r as V } from "./workspace-navigation-yctjVTFm.ts";
import { i as fe } from "./module-ClzQuarz.ts";
import { t as pe } from "./session-chat-notices-CdYc4CZP.ts";
import { t as me } from "./session-harness-sign-in-CSK1JAVa.ts";
import { t as he } from "./session-harness-unavailable-kFFTjst0.ts";
import { t as ge } from "./session-personal-device-PywC02Zg.ts";
import { t as _e } from "./harness-browser-progress-DhS04AjG.ts";
import { useEffect as H, useRef as U, useState as W, useSyncExternalStore as ve } from "react";
import { Box as G, Button as ye, Flex as be, HStack as xe, Icon as Se, IconButton as Ce, Menu as we, Stack as Te, Text as Ee } from "@chakra-ui/react";
import { AlertMessage as De, ListRow as Oe, SearchableMenu as ke, Tooltip as Ae } from "@pstdio/ui";
import { Fragment as K, jsx as q, jsxs as J } from "react/jsx-runtime";
import { isNavigationTarget as je, workbenchPages as Me } from "@pstdio/sdk/extensions";
import { ChatPanel as Ne, ChatSkeleton as Pe, ChatWorkspaceHub as Fe, HarnessControls as Ie, isGuessedChatLink as Le, parseChatLink as Y } from "@pstdio/ui/chat-ui";
import { filterHarnessParamValues as Re, harnessParamValuesEqual as ze, resolveHarnessParamDefaults as Be } from "@pstdio/ui/param-editor";
import { PstdioApiError as Ve } from "@pstdio/sdk/client";
n({
	path: e().nullable(),
	gitRemote: e().nullable()
}), n({
	path: e().min(1).describe("Absolute folder path, or one under `~/`. A clone creates it."),
	clone: t().describe("Clone the project's recorded git remote into the folder.")
});
// packages/pstdio-dashboard/src/modules/sessions/chat/session-view-context.ts
var He = (e) => ({
	workbench: e.workbench,
	region: e.panel.region,
	instance: e.instance,
	changeViewer: e.instance.placementIdentity ? e.workbench.viewers.capture(e.instance.placementIdentity) : void 0
}), Ue = (e) => e.workbench.host.getOpenPlacementIds().has(e.instance.instanceId), We = (e) => C(e.instance, "session"), X = (e) => e?.status === "in_progress" || e?.status === "awaiting_input", Z = (e) => e && JSON.stringify([
	e.updated_at,
	e.status,
	e.last_request_started,
	e.last_request_ended
]), Ge = () => {
	let e = new o(), t = (e) => ["session-history", e];
	return {
		get(n, r) {
			if (!r || X(r) || e.getQueryState(t(n))?.isInvalidated) return;
			let i = e.getQueryData(t(n));
			return i && i.version === Z(r) ? i.messages : void 0;
		},
		set(n, r, i) {
			let a = Z(r);
			a && !X(r) && e.setQueryData(t(n), {
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
}, Ke = /* @__PURE__ */ new WeakMap(), qe = (e) => {
	let t = Ke.get(e);
	return t || (t = Ge(), Ke.set(e, t)), t;
}, Je = (e) => e.flatMap((e) => {
	let t = e.parts.filter((e) => e.type !== "text" && e.type !== "reasoning" || !!e.text.trim());
	return t.length === 0 ? [] : [t.length === e.parts.length ? e : {
		...e,
		parts: t
	}];
}), Ye = (e, t) => {
	if (t.path === "/messages" && (t.op === "add" || t.op === "replace")) return Array.isArray(t.value) ? t.value : e;
	let n = t.path.match(/^\/messages\/(\d+)$/);
	if (!n) return e;
	let r = Number(n[1]);
	if (r > (t.op === "add" ? e.length : e.length - 1) || !Number.isSafeInteger(r)) return e;
	let i = [...e];
	return t.op === "add" ? i.splice(r, 0, t.value) : t.op === "replace" ? i[r] = t.value : i.splice(r, 1), i;
}, Q = (e) => {
	let t = e?.status, n = typeof t != "number" && e instanceof TypeError, r = e instanceof Error ? e.message : String(e);
	return {
		message: n ? "The network is unavailable." : r,
		temporary: typeof t != "number" || t >= 500 || t === 408 || t === 429
	};
}, Xe = (e) => {
	let { sessionId: t, ownerKey: n, reads: r, transport: i, onChange: a } = e, o = qe(i), s = o.retain(t), c = e.initialSession, l = (e) => e.id.startsWith(`queued-prompt-${t}-`), u = e.initialState?.messages.filter((e) => !l(e)) ?? [], d = e.initialState?.messages.filter(l) ?? [], f = e.initialState ?? {
		messages: [],
		loading: !0,
		streaming: !1
	}, p = 0, m = 0, h = 0, g = 0, _ = !1, v = !1, y, b, x, S = (e = {}) => {
		f = {
			...f,
			...e,
			messages: [...Je(u), ...d]
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
			onError: (e) => S({ queueError: Q(e) })
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
		let a = p, s = m, d = c, f = Z(d);
		b ??= r.bind(`${n}:transcript`), b.request({
			queryKey: JSON.stringify([
				a,
				s,
				f
			]),
			load: (e) => i.getConversation(t, e),
			onValue: (e) => {
				a === p && s === m && f === Z(c) && (u = e.messages.filter((e) => !l(e)), o.set(t, d, u), S({
					loading: !1,
					error: void 0
				}));
			},
			onError: (e) => S({
				loading: !1,
				error: Q(e)
			})
		}, "refresh");
	}, E = () => {
		if (v) return;
		let e = ++p;
		if (y?.close(), b?.dispose(), b = void 0, x?.dispose(), x = r.bind(`${n}:queue`), _ = !1, S({
			loading: u.length === 0,
			streaming: !1,
			error: void 0
		}), w(), !X(c)) {
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
				u = Ye(u, t), u !== n && (m++, t.path === "/messages" && (_ = !0), S({
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
					error: Q(e)
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
			if (c = e, X(e) && (!X(n) || e?.last_request_started !== n?.last_request_started)) E();
			else if (!y) {
				if (X(e)) {
					w();
					return;
				}
				_ && e?.last_request_started === n?.last_request_started ? o.set(t, e, u) : Z(e) !== Z(n) && T(), w();
			}
		},
		dispose() {
			v = !0, p++, y?.close(), b?.dispose(), x?.dispose(), s();
		}
	};
}, Ze = {
	messages: [],
	loading: !1,
	streaming: !1
}, Qe = (e, t) => {
	let n = M().sessions, [r, i] = W({ state: Ze }), a = U(void 0), o = U(r), s = We(e), c = e.workbench;
	H(() => () => {
		a.current?.dispose(), a.current = void 0;
	}, []), H(() => {
		if (!t) {
			a.current?.dispose(), a.current = void 0, i({ state: Ze });
			return;
		}
		let e = Xe({
			sessionId: t,
			ownerKey: s,
			reads: c.views.reads,
			transport: n,
			initialState: o.current.sessionId === t && o.current.transport === n ? o.current.state : void 0,
			initialSession: O("sessions").get(t),
			onChange: (e) => {
				o.current = {
					sessionId: t,
					transport: n,
					state: e
				}, i(o.current);
			}
		}), r = D((n) => {
			n ? n.table === "sessions" && n.changes.some((e) => e.key === t) && e.sessionChanged(O("sessions").get(t)) : e.reconnect();
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
	let l = t && qe(n).get(t, O("sessions").get(t)), u = l ? {
		...Ze,
		messages: Je(l)
	} : {
		...Ze,
		loading: !!t
	};
	return {
		...r.sessionId === t && r.transport === n ? r.state : u,
		reconnect: () => a.current?.reconnect(),
		refreshQueue: () => a.current?.refreshQueue() ?? Promise.resolve(void 0)
	};
}, $e = (e) => e instanceof Ve && e.code === "project_folder_missing", et = async (e, t, n) => {
	if (!e?.agent) throw Error("Select a project and an agent before sending.");
	let r = await M().sessions.create({
		...e,
		operation: t,
		title: t.kind === "command" ? t.text.slice(0, 100) : "New session"
	}).catch((e) => {
		throw $e(e) && n(), e;
	}), i = r.operation_result?.status ?? "completed";
	return (r.status === "failed" || r.status === "disconnected") && (i = "started"), {
		sessionId: r.id,
		status: i,
		message: r.operation_result?.message
	};
}, tt = (e) => ({
	destination: e.destination ?? "conversation",
	prompt: e.prompt,
	messageCount: e.messageCount,
	submittedAt: Date.now(),
	previousRunStarted: e.previousRunStarted ?? null,
	userMessageId: `${e.pendingId}-user`,
	assistantMessageId: `${e.pendingId}-assistant`,
	attachments: e.attachments,
	questionResponse: e.questionResponse
}), nt = (e, t, n) => e?.userMessageId === t.userMessageId ? {
	...e,
	failure: n
} : e, rt = (e = []) => e.map((e) => ({
	type: "file",
	fileId: e.file_id,
	filename: e.name,
	mediaType: e.mime_type ?? void 0,
	size: e.size_bytes,
	url: e.url
})), it = /* @__PURE__ */ new Map(), at = /* @__PURE__ */ new Set(), ot = (e) => it.get(e) ?? null, $ = (e, t) => {
	let n = ot(e), r = typeof t == "function" ? t(n) : t;
	if (r !== n) {
		r ? it.set(e, r) : it.delete(e);
		for (let e of at) e();
	}
}, st = (e) => (at.add(e), () => {
	at.delete(e);
}), ct = (e) => {
	let t = {
		id: e.userMessageId,
		role: "user",
		parts: [{
			type: "text",
			text: e.prompt
		}, ...rt(e.attachments)]
	};
	return e.failure ? [{
		...t,
		delivery: "unsent"
	}] : [t, {
		id: e.assistantMessageId,
		role: "assistant",
		parts: [{ type: "loading" }]
	}];
}, lt = (e, t) => !t || !t.failure && ut(e, t) || !t.failure && t.destination === "queue" ? e : [...e, ...ct(t)], ut = (e, t) => e.slice(t.messageCount).some((e) => e.role === "user" && e.parts.filter((e) => e.type === "text").map((e) => e.text).join("\n") === t.prompt), dt = (e, t, n = !1) => {
	let r = e ? Date.parse(e) : void 0;
	return n ? r : t && !ft(e ?? null, t.previousRunStarted) ? t.submittedAt : r;
}, ft = (e, t) => e !== null && e !== t, pt = "queued-prompt-", mt = (e, t) => {
	if (!t) return null;
	let n = `${pt}${t}-`;
	if (!e.startsWith(n)) return null;
	let r = Number(e.slice(n.length));
	return Number.isInteger(r) ? r : null;
}, ht = (e) => e.parts.filter((e) => e.type === "text").map((e) => e.text).join("\n").trim(), gt = (e) => e.parts.filter((e) => e.type === "file").map((e) => ({
	id: e.fileId ?? e.url,
	name: e.filename ?? e.url.split("/").pop() ?? "Attachment",
	mediaType: e.mediaType,
	url: e.url,
	size: e.size
})), _t = (e, t) => {
	if (!e?.steeringDelivery) return !1;
	let n = t.filter((t) => t.role === "user" && t.id === e.steeringDelivery.id);
	return n.length === 1 && e.attachments.every((e) => n[0].parts.some((t) => t.type === "file" && t.fileId === e.file_id));
}, vt = (e, t, n, r) => e.some((e) => mt(e.id, t) === n.queuePosition) || ut(e, n) && ft(r, n.previousRunStarted), yt = (e, t, n, r) => {
	let i = [], a = [];
	for (let r of e) {
		let o = r.role === "user" ? mt(r.id, t) : null;
		if (o === null) {
			i.push(r);
			continue;
		}
		let s = n?.requests.find((e) => e.queuePosition === o);
		_t(s, e) || a.push({
			revision: s?.revision,
			model: s?.model,
			params: s?.params,
			steeringDelivery: s?.steeringDelivery,
			steeringUnavailableReason: s?.steeringUnavailableReason,
			id: r.id,
			prompt: ht(r),
			attachments: gt(r),
			position: o
		});
	}
	return r?.destination === "queue" && !r.failure && !ut(e, r) && a.push({
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
}, bt = (e) => e.slice(0, 100) || "Session", xt = (e) => {
	let t = bt(e.prompt), n = ie(e.sessionId, t, e.projectId), r = e.input.instance.placementIdentity;
	if (!r) throw Error("A session draft must have an owned viewer");
	let i = e.input.changeViewer?.({
		operation: "replace",
		resource: n,
		...r.kind === "page" ? { page: Me.session } : {}
	});
	return i && i !== "stale" ? r : void 0;
}, St = 0, Ct = (e, t) => $(e, (e) => e?.userMessageId === t.userMessageId ? null : e), wt = (e) => {
	if (!e.projectId || !e.agent) return Promise.reject(/* @__PURE__ */ Error("Select a project and an agent before sending."));
	let t = tt({
		prompt: e.text,
		messageCount: e.messages.length,
		pendingId: `pending-${St++}`,
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
		Ct(e.conversationKey, t), r !== "queued" && $(n, t), e.onSessionCreated?.(n);
	}, (n) => {
		let r = Q(n ?? /* @__PURE__ */ Error("Could not create the session."));
		$(e.conversationKey, (e) => nt(e, t, r));
	});
}, Tt = (e) => {
	let t = tt({
		destination: !e.questionResponse && [
			"in_progress",
			"awaiting_input",
			"queued"
		].includes(e.sessionStatus ?? "") ? "queue" : "conversation",
		prompt: e.text,
		messageCount: e.messages.length,
		pendingId: `pending-${St++}`,
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
		if (e.questionResponse) e.onSubmitted?.(), Ct(e.sessionId, t), e.reconnect();
		else if (n?.status === "queued") {
			let r = n.queue_position;
			$(e.sessionId, (e) => e?.userMessageId === t.userMessageId ? {
				...e,
				destination: "queue",
				queuePosition: r
			} : e), e.refreshQueue().then((n) => {
				n && !n.requests.some((e) => e.queuePosition === r) && Ct(e.sessionId, t);
			});
		} else $(e.sessionId, (e) => e?.userMessageId === t.userMessageId ? {
			...e,
			destination: "conversation"
		} : e), e.reconnect();
	}, (n) => {
		e.onQuestionResponseError?.();
		let r = Q(n ?? /* @__PURE__ */ Error("Could not send the follow-up."));
		if ($(e.sessionId, (e) => nt(e, t, r)), e.questionResponse) throw n ?? /* @__PURE__ */ Error("Could not send the answer.");
	});
}, Et = (e) => e.sessionId ? Tt({
	...e,
	sessionId: e.sessionId
}) : wt(e), Dt = (e, t, n) => (r, i, a) => e(r, a ? [] : t, a, a ? void 0 : n), Ot = (e, t) => ({
	onRetry: () => t.send(e.prompt, e.attachments ?? [], e.questionResponse).then(() => t.clear(), () => {}),
	onClose: () => {
		t.clear(), e.questionResponse || t.restore(e.prompt, e.attachments ?? []);
	}
}), kt = (e) => ({
	project_id: e.projectId,
	title: e.prompt.slice(0, 100),
	prompt: e.prompt,
	agent: e.agent,
	attachments: e.attachments?.map((e) => ({ file_id: e.file_id })),
	model: e.model?.trim() || void 0,
	params: e.params,
	workspace_id: e.workspaceId
}), At = (e = {}) => s({
	mutationFn: async (e) => {
		let t = await M().sessions.create(kt(e));
		return {
			sessionId: t.id,
			status: t.status
		};
	},
	onError: (t) => {
		$e(t) && e.onFolderMissing?.();
	}
}), jt = () => s({ mutationFn: async (e) => {
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
} }), Mt = () => s({ mutationFn: (e) => M().sessions.updateStatus(e, "cancelled") }), Nt = async (e) => {
	let [, t] = await Promise.all([M().projects.get(e.projectId), L(e.projectId)]);
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
	if (!v({
		url: e.href,
		projectId: e.projectId,
		pages: n,
		resources: b
	})) throw Error("This page or document link is unavailable in its project.");
	window.location.assign(e.href);
}, Pt = (e) => {
	let t = [];
	for (let n of e.split("/")) if (n && n !== ".") {
		if (n === "..") {
			if (!t.length) throw Error("This path is outside the session workspace.");
			t.pop();
		} else t.push(n);
	}
	return t;
}, Ft = (e, t) => {
	let n = /^[a-z]:\//i.test(e);
	if (!(n || e.startsWith("/"))) {
		let t = Pt(e).join("/");
		if (!t) throw Error("Select a file inside the session workspace.");
		return t;
	}
	if (!t) throw Error("The session workspace has no local file root.");
	let r = t.replaceAll("\\", "/").replace(/\/+$/, "");
	if (n !== /^[a-z]:\//i.test(r)) throw Error("This path is outside the session workspace.");
	let i = Pt(e), a = Pt(r);
	if (!a.every((e, t) => n ? e.toLowerCase() === i[t]?.toLowerCase() : e === i[t]) || i.length <= a.length) throw Error("This path is outside the session workspace.");
	return i.slice(a.length).join("/");
}, It = (e, t, n) => {
	let r = g.parse(e);
	if (r.extensionId !== void 0 && r.extensionId !== t || r.projectId !== void 0 && r.projectId !== n) throw Error("The path handler returned a resource outside its owner or project.");
	return r;
}, Lt = (e, t) => ({
	...e,
	section: void 0,
	position: t
}), Rt = (e, t, n) => {
	if (!t) return e;
	let r = (e) => {
		let t = n(e.page);
		return !!(t && e.resource?.metadata?.[t]);
	};
	return e.kind === "page" ? r(e) ? Lt(e, t) : e : e.kind === "compound" ? {
		...e,
		targets: e.targets.map((e) => e.kind === "page" && r(e) ? Lt(e, t) : e)
	} : e;
}, zt = async (e) => {
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
	let r = n, i = It(r.resource, t.kind.extensionId, e.projectId);
	if (i.type !== t.kind.localId) throw Error("The path handler returned a resource outside its owner or project.");
	if (!r.target || !je(r.target) || ![
		"page",
		"panel",
		"compound"
	].includes(r.target.kind)) throw Error("The path handler did not return a resource destination.");
	let a = [r.target];
	for (; a.length;) {
		let n = a.pop();
		n.kind === "compound" ? a.push(...n.targets) : (n.kind === "page" || n.kind === "panel") && (n.resource && It(n.resource, t.kind.extensionId, e.projectId), n.kind === "page" && n.parent && a.push(n.parent));
	}
	return {
		resource: {
			...i,
			icon: i.icon ?? t.kind.icon,
			extensionId: t.kind.extensionId,
			projectId: e.projectId
		},
		target: Rt(_(r.target, t.kind.extensionId, e.projectId), e.position, e.documentKey)
	};
}, Bt = (e) => {
	let { workspace: t } = e;
	if (!t) throw Error("The conversation workspace is unavailable.");
	if (t.executionKind !== "local") throw Error("Remote workspace files are unavailable.");
	if (!t.supportsFiles) throw Error("This workspace does not support files.");
	return t;
}, Vt = (e, t, n, r) => {
	let i = Bt(e), a = Ft(t.path, i.workspacePath), o = de(R(i, e.projectId), a), s = {
		kind: "page",
		page: Me.workspace,
		resource: o,
		position: t.position
	};
	return {
		kind: "page",
		target: s,
		href: y({
			projectId: e.projectId,
			location: s,
			pages: n,
			resources: r
		})
	};
}, Ht = (e) => {
	let t = async (t) => {
		let n = Y(t, e.origin);
		if (n?.kind !== "file" || !e.projectId) return null;
		let r = Bt(e), i = Ft(n.path, r.workspacePath);
		return zt({
			projectId: e.projectId,
			workspaceId: r.id,
			path: i,
			position: n.position,
			kinds: N(e.projectId)?.resourceKinds ?? [],
			documentKey: (t) => e.workbench.pages.listPages().find((e) => e.ref.id === t.id && e.ref.extensionId === t.extensionId)?.document?.metadataKey,
			execute: async (t, n) => {
				let r = await I(e.projectId, t, {
					params: n,
					source: "dashboard"
				});
				if (!r.outcome.ok) throw Error("Could not resolve the resource path.");
				return r.outcome.value;
			}
		});
	}, n = async (t) => {
		let n = Bt(e), r = Ft(t, n.workspacePath), i = r.includes("/") ? r.slice(0, r.lastIndexOf("/")) : "", a = V(), o = await a.fetchQuery(ue(n.id, i));
		return o.entries.some((e) => e.type === "file" && e.path === r) ? !0 : o.truncated ? a.fetchQuery(B(n.id, r)).then(() => !0, (e) => e instanceof Ve && (e.status === 413 || e.status === 415)) : !1;
	}, r = (t) => {
		let n = Y(t, e.origin);
		if (!n) throw Error("This text is not a file link.");
		if (n.kind === "invalid") throw Error(n.reason);
		if (!e.projectId) throw Error("The conversation has no project.");
		let r = e.workbench.pages.listPages(), i = b;
		if (n.kind === "page" || n.kind === "external") {
			let t = new URL(n.href, e.origin);
			if (t.origin !== e.origin || !t.pathname.startsWith("/projects/")) return;
			let a = decodeURIComponent(t.pathname.split("/")[2] ?? "");
			if (a !== e.projectId) return {
				kind: "project",
				projectId: a,
				href: t.pathname + t.search
			};
			let o = v({
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
				href: y({
					projectId: e.projectId,
					location: s,
					pages: r,
					resources: i
				})
			};
		}
		return Vt(e, n, r, i);
	};
	return {
		async resolveResource(i) {
			try {
				let a = await t(i);
				if (a) return {
					label: a.resource.label ?? a.resource.shorthand ?? a.resource.id,
					icon: a.resource.icon,
					href: a.target.kind === "page" ? y({
						projectId: e.projectId,
						location: a.target,
						pages: e.workbench.pages.listPages(),
						resources: b
					}) : null
				};
				let o = Y(i, e.origin);
				if (o?.kind === "file" && Le(i) && !await n(o.path)) return null;
				let s = r(i)?.href;
				return s ? { href: s } : null;
			} catch {
				return null;
			}
		},
		async resolveImageSource(t) {
			try {
				let n = Y({
					source: t,
					origin: "markdown"
				}, e.origin);
				if (n?.kind !== "file" || n.position) return null;
				let r = Bt(e), i = Ft(n.path, r.workspacePath), a = await V().fetchQuery(B(r.id, i));
				return a.encoding === "base64" ? a.data_url ?? null : null;
			} catch {
				return null;
			}
		},
		async resolveIcon(e) {
			return V().fetchQuery({
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
					await e.workbench.navigation.openTarget(E(i.target));
					return;
				}
				let a = r(n);
				if (!a) return;
				if (a.kind === "project") {
					await Nt({
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
}, Ut = (e, t, n) => {
	let [r, i] = W(null), { data: a } = j((e) => n ? e.from({ w: O("workspaces") }).where(({ w: e }) => A(e.id, n)).select(({ w: e }) => ({ ...e })) : void 0, [n]), [o] = se({ workspaces: k(a) ?? [] }, t);
	return {
		handler: Ht({
			workbench: e,
			projectId: t,
			workspace: o,
			origin: window.location.origin,
			onError: i
		}),
		notice: r ? /* @__PURE__ */ q(De, {
			status: "error",
			title: "Could not open link",
			onClose: () => i(null),
			children: r
		}) : null
	};
}, Wt = (e, t) => !!(t && e.some((e) => e.value === t && !e.disabled)), Gt = (e) => e.sessionAgent ? e.sessionAgent : Wt(e.agentOptions, e.selectedAgent) ? e.selectedAgent : e.agentOptions.length === 0 && e.defaultAgent ? e.defaultAgent : Wt(e.agentOptions, e.defaultAgent) ? e.defaultAgent ?? "" : e.agentOptions.find((e) => !e.disabled)?.value ?? e.agentOptions[0]?.value ?? "", Kt = (e) => Wt(e.agentOptions, e.selectedAgent) && (!e.requiresModel || !!e.selectedModel), qt = (e) => e.models.some((t) => t.id === e.selectedModel) || e.selectedModel && e.models.length === 0 ? e.selectedModel : e.preferredModel && e.models.some((t) => t.id === e.preferredModel) || e.preferredModel && e.models.length === 0 ? e.preferredModel : e.models.find((e) => e.isDefault)?.id ?? e.models[0]?.id ?? "", Jt = (e, t) => {
	let n = {};
	return t.params && !ze(e.params ?? {}, t.params) && (n.params = t.params), t.agent && t.agent !== e.agent && (n.agent = t.agent), t.lastSelectedModel && t.lastSelectedModel !== e.lastSelectedModel && (n.model = t.lastSelectedModel), t.workspaceId && t.workspaceId !== e.workspaceId && (n.workspaceId = t.workspaceId), n;
}, Yt = (e) => e.workspaces.some((t) => t.id === e.selectedWorkspaceId) ? e.selectedWorkspaceId : e.fallbackWorkspaceId && (e.workspaces.length === 0 || e.workspaces.some((t) => t.id === e.fallbackWorkspaceId)) ? e.fallbackWorkspaceId : e.workspaces[0]?.id ?? "", Xt = (e, t, n) => e.map((e) => ({
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
})), Zt = () => /* @__PURE__ */ q(Se, {
	as: u,
	boxSize: "14px",
	color: "fg"
}), Qt = (e) => {
	let { label: t, disabled: n = !1 } = e;
	return /* @__PURE__ */ J(ye, {
		variant: "ghost",
		size: "xs",
		px: "2xs",
		minW: "0",
		"aria-label": "Select workspace",
		disabled: n,
		children: [
			/* @__PURE__ */ q(Zt, {}),
			/* @__PURE__ */ q(Ee, {
				textStyle: "label/XS/medium",
				color: "fg",
				ml: "2xs",
				truncate: !0,
				children: t
			}),
			n ? null : /* @__PURE__ */ q(Se, {
				as: l,
				boxSize: "14px",
				color: "fg.muted"
			})
		]
	});
}, $t = (e) => {
	let { label: t } = e;
	return /* @__PURE__ */ J(be, {
		align: "center",
		gap: "2xs",
		minW: "0",
		px: "2xs",
		h: "7",
		children: [/* @__PURE__ */ q(Zt, {}), /* @__PURE__ */ q(Ee, {
			textStyle: "label/XS/medium",
			color: "fg",
			truncate: !0,
			children: t
		})]
	});
}, en = (e) => {
	let { workspaces: t, selectedWorkspaceId: n, selectedWorkspaceLabel: r, onSelectWorkspace: i, isDisabled: a = !1 } = e, o = r || "Select workspace";
	return a ? /* @__PURE__ */ q(Ae, {
		content: "Workspace",
		children: /* @__PURE__ */ q(G, {
			minW: "0",
			children: /* @__PURE__ */ q($t, { label: o || "No workspace" })
		})
	}) : /* @__PURE__ */ q(ke, {
		trigger: /* @__PURE__ */ q(G, {
			minW: "0",
			children: /* @__PURE__ */ q(Ae, {
				content: t.length === 0 ? "No workspaces" : "Select workspace",
				children: /* @__PURE__ */ q(Qt, {
					label: o,
					disabled: t.length === 0
				})
			})
		}),
		items: Xt(t, n, i),
		width: "280px",
		showSearch: t.length > 10,
		searchPlaceholder: "Search workspaces...",
		contentTestId: "session-workspace-options",
		emptyState: /* @__PURE__ */ q(we.Item, {
			value: "empty",
			asChild: !0,
			children: /* @__PURE__ */ q(Oe, {
				asChild: !0,
				variant: "compact",
				id: "empty",
				label: "No workspaces",
				icon: /* @__PURE__ */ q(Se, {
					as: u,
					boxSize: "16px"
				}),
				disabled: !0
			})
		})
	});
}, tn = (e) => {
	let t = e.workspaces.find((t) => t.id === e.selectedWorkspaceId);
	return t ? t.title : e.workspaceTitle || e.workspaceShorthand;
}, nn = (e) => {
	let { view: t, projectId: n, selectedWorkspaceId: r, setSelectedWorkspaceId: i, onSelectWorkspace: a } = e, { isLoading: o } = ee(n), s = z(n), c = s.map((e) => e.id).join("|"), l = s.find((e) => e.isDefault)?.id ?? null, u = tn({
		selectedWorkspaceId: r,
		workspaceTitle: t.workspaceTitle,
		workspaceShorthand: t.workspaceShorthand,
		workspaces: s
	}), d = !!t.sessionId;
	return H(() => {
		let e = Yt({
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
	]), /* @__PURE__ */ q(en, {
		workspaces: s,
		selectedWorkspaceId: r,
		selectedWorkspaceLabel: u,
		onSelectWorkspace: (e) => {
			let t = s.find((t) => t.id === e);
			i(e), t && a?.(t);
		},
		isDisabled: d || o
	});
}, rn = (e) => {
	let { additions: t, deletions: n, action: r, ...i } = e;
	return /* @__PURE__ */ q(Fe, {
		workspaceControl: /* @__PURE__ */ q(nn, { ...i }),
		additions: t,
		deletions: n,
		action: r
	});
}, an = () => s({ mutationFn: (e) => {
	let { sessionId: t, queuePosition: n, ...r } = e;
	return M().sessions.updateQueuedFollowUp(t, n, r);
} }), on = () => s({ mutationFn: (e) => M().sessions.removeQueuedFollowUp(e.sessionId, e.queuePosition, e.expectedRevision) }), sn = () => s({ mutationFn: (e) => M().sessions.moveQueuedFollowUp(e.sessionId, e.queuePosition, {
	direction: e.direction,
	expectedRevision: e.expectedRevision,
	steps: e.steps,
	expectedOrder: e.expectedOrder
}) }), cn = () => s({ mutationFn: (e) => M().sessions.combineQueuedFollowUps(e.sessionId, e.queuePosition, {
	sourcePosition: e.sourcePosition,
	sourceRevision: e.sourceRevision,
	targetRevision: e.targetRevision
}) }), ln = () => s({ mutationFn: (e) => M().sessions.steerQueuedFollowUp(e.sessionId, e.queuePosition, {
	expectedRevision: e.expectedRevision,
	expectedRunStartedAt: e.expectedRunStartedAt
}) }), un = (e) => {
	let { sessionId: t, queuedFollowUps: n, activeRunStartedAt: r, editRequest: i, afterUpdate: a, refreshQueue: o } = e, [s, c] = W(null), l = an(), u = on(), d = sn(), f = cn(), p = ln(), m = (e) => {
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
}, dn = (e) => `pstdio-dashboard:command-params:recent-harness:${e}`, fn = () => {
	try {
		return globalThis.localStorage;
	} catch {
		return;
	}
}, pn = (e) => e ?? fn(), mn = (e, t) => {
	let n = pn(t);
	if (!e || !n) return;
	let r = n.getItem(dn(e));
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
}, hn = (e, t, n) => {
	let r = pn(n);
	if (!e || !r || !t.harnessId) return;
	let i = mn(e, r), a = t.params ?? (i?.harnessId === t.harnessId ? i.params : void 0);
	r.setItem(dn(e), JSON.stringify({
		...t,
		...a ? { params: a } : {}
	}));
}, gn = (e) => {
	let { view: t, selectionScope: n = "draft", projectId: r, selectedAgent: i, setSelectedAgent: a, selectedModel: o, setSelectedModel: s, harnessParamOverrides: c, setHarnessParamOverrides: l } = e, { data: u } = ee(r), { data: d = [], isLoading: g } = F(r), _ = d.map((e) => ({
		label: e.name,
		value: e.id,
		disabled: e.availability.type === "NOT_FOUND",
		description: e.availability.reason
	})), v = d.find((e) => e.id === i), y = v?.supportsModels ?? !0, b = u?.default_agent_id, x = d.some((e) => e.id === i), S = h(r, x ? i : void 0, o), { data: C = [], isLoading: w } = m(i, {
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
	let E = t.lastSelectedModel ?? u?.default_agent_model ?? "", D = S.data?.schema ?? v?.params, O = p(C, o), k = f(D, O), A = Be(k, S.data?.defaults), j = Object.fromEntries(Object.entries(c).filter(([e, t]) => !Object.is(A[e], t)));
	return H(() => {
		let e = Gt({
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
	]), H(() => {
		if (w || n === "request") return;
		let e = y ? qt({
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
	]), H(() => {
		!D || w || o && !O || l((e) => {
			let t = f(D, O), n = Re(t, e);
			return ze(e, n) ? e : n;
		});
	}, [
		D,
		w,
		o,
		O,
		l
	]), /* @__PURE__ */ J(xe, {
		gap: "2xs",
		minW: "0",
		children: [/* @__PURE__ */ q(re, {
			agentOptions: _,
			selectedAgent: x ? i : "",
			onSelectAgent: (e) => {
				if (a(e), s(""), n === "request") return;
				let t = mn(r), i = t?.harnessId === e ? t.params ?? {} : {};
				l(i), hn(r, {
					harnessId: e,
					params: i
				});
			},
			modelOptions: x ? T : [],
			selectedModel: x ? o : "",
			onSelectModel: (e) => {
				s(e), i && n === "draft" && hn(r, {
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
		}), /* @__PURE__ */ q(ae, {
			schema: k ?? void 0,
			defaults: A,
			overrides: j,
			onOverridesChange: (e) => {
				let t = {
					...A,
					...e
				};
				l(t), n === "draft" && hn(r, {
					harnessId: i,
					model: o,
					params: t
				});
			},
			disabled: !x,
			size: "xs"
		})]
	});
}, _n = (e) => {
	let { children: t, ...n } = e;
	return /* @__PURE__ */ J(K, { children: [/* @__PURE__ */ q(gn, { ...n }), t] });
}, vn = async (e) => {
	for (let t of e.files) {
		let n = await e.uploadFile(t);
		e.onUploaded(n);
	}
}, yn = (e, t) => new File([e], `clipboard-${t}.txt`, { type: "text/plain" }), bn = async (e, t) => M().sessions.uploadAttachment(e, {
	name: t.name,
	data: await t.arrayBuffer(),
	mimeType: t.type
}), xn = (e, t) => M().sessions.deleteAttachment(e, t), Sn = {
	attachments: [],
	uploading: !1
}, Cn = () => Sn, wn = () => () => void 0, Tn = (e, t, n, r = []) => {
	let i = e ? n?.getAttachmentDraft(e, t) : void 0, { attachments: a, uploading: o } = ve(i?.subscribe ?? wn, i?.getSnapshot ?? Cn), s = U(0), c = async (t) => {
		if (e && i && t.length !== 0) {
			i.changeUploading(1);
			try {
				await vn({
					files: t,
					onUploaded: (e) => i.changeAttachments((t) => [...t, e]),
					uploadFile: (t) => bn(e, t)
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
			e && (i?.changeAttachments((e) => e.filter((e) => e.file_id !== t)), r.includes(t) || xn(e, t).catch(() => void 0));
		},
		restoreAttachments: (e) => {
			i?.changeAttachments((t) => [...e, ...t.filter((t) => !e.some((e) => e.file_id === t.file_id))]);
		},
		uploadFiles: c,
		uploadText: (e) => (s.current += 1, c([yn(e, s.current)])),
		uploading: o
	};
}, En = (e) => ({
	file_id: e.id,
	name: e.name,
	mime_type: e.mediaType ?? null,
	size_bytes: e.size ?? 0,
	hash: null,
	url: e.url ?? "",
	created_at: "",
	updated_at: ""
}), Dn = (e, t, n) => {
	let [r, i] = W(null), [a, o] = W({}), s = r ? a[r] : void 0, c = (e) => `${t}:queued:${e}`, l = Tn(e, c(r ?? "inactive"), n, s?.item.attachments?.map((e) => e.id) ?? []), u = (t) => {
		t && !a[t.id] && (o((e) => ({
			...e,
			[t.id]: {
				item: t,
				model: t.model ?? "",
				params: t.params ?? {}
			}
		})), e && n?.getAttachmentDraft(e, c(t.id)).changeAttachments(() => (t.attachments ?? []).map(En))), i(t?.id ?? null);
	}, d = (t) => {
		o((e) => {
			let n = { ...e };
			return delete n[t], n;
		}), e && n?.getAttachmentDraft(e, c(t)).changeAttachments(() => []), t === r && i(null);
	}, f = (t) => {
		let r = new Set(a[t]?.item.attachments?.map((e) => e.id)), i = e ? n?.getAttachmentDraft(e, c(t)).getSnapshot().attachments ?? [] : [];
		if (d(t), e) for (let t of i) r.has(t.file_id) || xn(e, t.file_id).catch(() => void 0);
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
}, On = (e) => {
	let { projectId: t, sessionId: n, draftKey: r, drafts: i, queue: a, refreshQueue: o, draftAttachments: s, modelControls: c, messagesBlocked: l, ...u } = e, d = Dn(t, r, i), f = jt(), p = d.selection ? d.attachments : s, m = un({
		sessionId: n,
		queuedFollowUps: u.queuedFollowUps ?? [],
		refreshQueue: o,
		activeRunStartedAt: a?.activeRunStartedAt,
		editRequest: (e, t) => {
			let n = d.edits[e];
			if (!n?.item.revision) throw Error("Refresh the queue before editing this request.");
			return {
				prompt: t,
				expectedRevision: n.item.revision,
				model: n.model || null,
				params: n.params,
				attachments: d.attachments.attachments.map((e) => ({ file_id: e.file_id }))
			};
		},
		afterUpdate: d.commit
	}), h = () => {
		m.clearActionError(), o();
	};
	return /* @__PURE__ */ q(Ne, {
		...u,
		conversationNotices: /* @__PURE__ */ J(K, { children: [u.conversationNotices, /* @__PURE__ */ q(pe, {
			queueError: m.actionError ? {
				message: m.actionError,
				temporary: !1
			} : void 0,
			reconnect: h,
			refreshQueue: h
		})] }),
		onQueuedFollowUpUpdate: n ? m.handleQueuedFollowUpUpdate : void 0,
		onQueuedFollowUpCreate: async (e, t) => {
			if (l) throw Error("Sign in before sending a queued message.");
			let r = d.edits[e];
			if (!n || !r) throw Error("The queued edit is no longer available.");
			await f.mutateAsync({
				sessionId: n,
				prompt: t,
				model: r.model,
				params: r.params,
				attachments: d.attachments.attachments
			}), d.commit(e), o();
		},
		canRestoreQueuedEditToDraft: !!a && !s.attachments.length && !s.uploading,
		onQueuedFollowUpRestoreDraft: (e) => {
			let t = d.edits[e];
			t && (s.restoreAttachments(d.attachments.attachments), c.setSelectedModel(t.model), c.setHarnessParamOverrides(t.params), d.commit(e));
		},
		onQueuedFollowUpSelect: d.select,
		onQueuedFollowUpDiscard: d.discard,
		onQueuedFollowUpCombine: m.handleQueuedFollowUpCombine,
		onQueuedFollowUpSteer: l ? void 0 : m.handleQueuedFollowUpSteer,
		queueSteeringUnavailableReason: a ? a.steeringUnavailableReason : "Refresh the queue to check live input support.",
		unsavedQueueItemIds: d.dirtyItemIds,
		onQueuedFollowUpRemove: n ? m.handleQueuedFollowUpRemove : void 0,
		onQueuedFollowUpMove: n ? m.handleQueuedFollowUpMove : void 0,
		actions: /* @__PURE__ */ q(_n, {
			...c,
			selectedModel: d.selection?.model ?? c.selectedModel,
			setSelectedModel: d.selection ? d.setModel : c.setSelectedModel,
			harnessParamOverrides: d.selection?.params ?? c.harnessParamOverrides,
			setHarnessParamOverrides: d.selection ? d.setParams : c.setHarnessParamOverrides,
			selectionScope: d.selection ? "request" : "draft"
		}),
		attachmentActions: /* @__PURE__ */ q(x, {
			projectId: t,
			uploading: p.uploading,
			onAttachFiles: (e) => void p.uploadFiles(e)
		}),
		attachmentList: p.attachments.length ? /* @__PURE__ */ q(S, {
			attachments: p.attachments,
			onRemove: p.removeAttachment
		}) : void 0,
		onAttachFiles: t ? (e) => void p.uploadFiles(e) : void 0,
		onAttachText: t ? (e) => void p.uploadText(e) : void 0,
		inputDisabled: p.uploading || u.inputDisabled
	});
}, kn = (e, t) => {
	let n = /^\/\S+/.exec(e)?.[0], r = t.commands.find((e) => e.name === n);
	if (r?.disabledReason) throw Error(r.disabledReason);
	let i = /^\/\S+\s+(\/\S+)(?:\s|$)/.exec(e)?.[1];
	if (t.commands.some((e) => e.name === i)) throw Error("Submit one native command at a time. This harness has not declared command composition.");
}, An = (e, t, n) => {
	if (e.harnessId !== t) return `Remove ${e.command.composer?.label} or return to its harness.`;
	let r = n?.commands.find((t) => t.name === e.command.name);
	return !n?.slashCommands || !r?.composer ? "This tagged input is unavailable. Check the harness or remove the tag." : r.disabledReason;
}, jn = (e, t, n, r, i) => {
	let a = An(e, n, r);
	if (a) throw Error(a);
	if (i) throw Error("Remove attachments before submitting tagged native input.");
	let o = t.trim();
	if (!o) throw Error("Enter an objective before submitting this tag.");
	if ((r?.commands.find((t) => t.name === e.command.name))?.composer?.reservedArguments?.includes(o)) throw Error("This text is a native action. Use the native controls or enter an objective.");
	return {
		kind: "command",
		text: `${e.command.name} ${o}`
	};
}, Mn = (e, t, n, r, i) => !e?.slashCommands || t ? [] : e.commands.map((e) => ({
	...e,
	disabledReason: e.disabledReason ?? (n && e.name !== n.command.name ? `Remove ${n.command.composer?.label} first.` : void 0),
	...e.composer ? { onSelect: () => i({
		harnessId: r,
		command: e
	}) } : {}
})), Nn = /* @__PURE__ */ new Map(), Pn = (e, t) => Nn.set(e, t), Fn = (e, t) => {
	if (!e) return null;
	let n = Nn.get(e);
	return !n || n.harnessId !== t ? null : (Nn.delete(e), n);
}, In = (e, t, n) => {
	let r = e.find((e) => e.id === n.modeId), i = t.find((e) => e.id === n.modeId);
	if (!r || !i || r.description !== i.description || r.confirmation?.id !== i.confirmation?.id || !i.actions.some((e) => e.id === n.actionId)) throw Error("The native mode changed. Review its current details before acting again.");
}, Ln = (e, t, n, a, o) => {
	let c = w(o.workbench.layout.store, () => Ue(o)), l = r(), u = [
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
				In(r ? [r] : d.data?.modes ?? [], e.data.modes, n);
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
}, Rn = (e) => {
	let { error: t, outcome: n, onDismissError: r, onDismissOutcome: i } = e;
	return /* @__PURE__ */ J(K, { children: [t ? /* @__PURE__ */ q(De, {
		status: "error",
		title: "Command failed",
		onClose: r,
		children: t
	}) : null, n ? /* @__PURE__ */ q(De, {
		status: "info",
		title: "Command result",
		onClose: i,
		children: n
	}) : null] });
}, zn = (e, t) => JSON.stringify([
	e,
	t.id,
	t.confirmation?.id
]), Bn = (e, t, n, r) => {
	let i = e?.scope === t ? { ...e.byMode } : {};
	return r ? i[n] = r : delete i[n], {
		scope: t,
		byMode: i
	};
}, Vn = (e, t, n) => e?.find((e) => e.confirmation && e.actions.some((t) => t.id === e.confirmation?.actionId) && (n?.scope !== t || n.byMode[e.id] !== zn(t, e))), Hn = (e, t) => {
	let n = e.confirmation, r = e.actions.find((e) => e.id === n?.actionId);
	if (!n || !r) return;
	let i = zn(t.scope, e);
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
}, Un = (e, t) => {
	let [n, r] = W(), i = Vn(e, t.scope, n);
	return {
		decision: i ? Hn(i, {
			...t,
			onDismiss: (e) => r((n) => Bn(n, t.scope, i.id, e))
		}) : void 0,
		reopen: (e) => r((n) => Bn(n, t.scope, e))
	};
}, Wn = (e, t, n, r, i, a, o, s, c, l) => {
	let u = JSON.stringify([
		e,
		t,
		e ? void 0 : o
	]), d = U(u);
	d.current = u;
	let [f, p] = W(null), m = Ln(e, t, o, s, l), [h, g] = W(null), [_, v] = W(null), [y, b] = W(null), [x, S] = W(null), C = y ? An(y, t, m.state) : void 0, w = async (e, t) => {
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
	}, T = U(null);
	H(() => {
		if (T.current === u) return;
		T.current = u;
		let n = Fn(e, t);
		p(n?.kind === "pending" ? {
			scope: u,
			...n
		} : null), g(null), v(n?.kind === "outcome" ? n.message ?? null : null), S(n?.submitted ?? null);
	}, [
		u,
		e,
		t
	]), H(() => {
		x?.intent.command.composer?.modeId && m.state?.modes.some((e) => e.id === x.intent.command.composer?.modeId) && S(null);
	}, [x, m.state]), H(() => {
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
		e.status === "started" ? e.sessionId ? Pn(e.sessionId, {
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
		}) : e.sessionId && Pn(e.sessionId, {
			kind: "outcome",
			harnessId: t,
			message: e.message,
			submitted: i
		}), r?.(), b(null), S(i ?? null), e.sessionId && c(e.sessionId, n);
	}, D = (e, n, r) => {
		if (!r) {
			if (y) return jn(y, e, t, m.state, n.length);
			if (/^\/[^\s/]+(?:\s|$)/.test(e)) {
				if (!m.state) throw Error(m.loading ? "Commands are still loading. Try again when they are ready." : "Native commands are unavailable. Reload the session and try again.");
				if (m.state.slashCommands) {
					if (n.length) throw Error("Remove attachments before running this command.");
					return kn(e, m.state), {
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
	}, k = Un(m.state?.modes, {
		scope: u,
		pending: m.invoke.isPending,
		unavailable: !!m.error,
		onAction: O
	});
	return {
		decision: k.decision,
		suggestions: Mn(m.state, m.invoke.isPending, y, t, b),
		submit: (e, t, n, r) => {
			try {
				let i = D(e, t, n);
				return i ? w(i).then((t) => E(t, e, r)) : void 0;
			} catch (e) {
				return g(e instanceof Error ? e.message : String(e)), Promise.reject(e);
			}
		},
		controls: /* @__PURE__ */ q(Ie, {
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
		notices: /* @__PURE__ */ q(Rn, {
			error: h,
			outcome: _,
			onDismissError: () => g(null),
			onDismissOutcome: () => v(null)
		})
	};
}, Gn = (e, t, n, r, i) => {
	let a = ve(st, () => ot(e));
	return H(() => {
		a && !a.failure && vt(n, t, a, r) && $(e, (e) => e === a ? null : e);
	}, [
		e,
		t,
		n,
		a,
		r
	]), {
		pendingFollowUp: a,
		pendingWork: !(!a || a.failure || a.destination !== "conversation"),
		displayedMessages: lt(n, a),
		streamingStartedAt: dt(r, a?.failure ? void 0 : a ?? void 0, i)
	};
}, Kn = (e, t) => {
	let [n, r] = W(() => e?.getDraft(t) ?? "");
	return {
		text: n,
		change: (n) => {
			r(n), e?.setDraft(t, n);
		}
	};
}, qn = (e, t, n, r) => {
	if (!n) return "checking";
	let i = e.filter((e) => e.availability.type === "INSTALLED");
	return i.length ? i.some((e) => e.id === t) && r === "signed_out" ? "signed_out" : "ready" : "missing";
}, Jn = (e, t, n) => {
	let [r, i] = W(null), [a, o] = W(null), s = U(null), c = JSON.stringify([
		e,
		t,
		n
	]);
	H(() => (i(null), o(null), () => {
		s.current?.scope === c && (s.current.controller.abort(), s.current = null);
	}), [c]);
	let l = () => {
		s.current?.controller.abort(), s.current = null, i(null);
	};
	return {
		start: (r, a, u) => {
			if (!t) return;
			l();
			let d = new AbortController(), f = {
				controller: d,
				scope: c,
				reply: void 0
			};
			s.current = f, i({
				action: r,
				name: a
			}), o(null), M().agents.authenticate(t, {
				action: r,
				model: n
			}, {
				projectId: e,
				signal: d.signal,
				onPrompt: (e) => {
					d.signal.aborted || (e.type === "browser" && (i((t) => t && {
						...t,
						prompt: e
					}), window.open(e.url, "_blank", "noopener,noreferrer")), e.type === "message" && i((t) => t && {
						...t,
						message: e.message
					}));
				},
				onRequest: (e) => new Promise((t, n) => {
					let r = () => n(d.signal.reason);
					d.signal.addEventListener("abort", r, { once: !0 }), f.reply = (e) => {
						d.signal.removeEventListener("abort", r), f.reply = void 0, i((e) => e && {
							...e,
							question: void 0
						}), t(e);
					}, i((t) => t && {
						...t,
						question: e
					});
				})
			}).then(async () => {
				s.current === f && await u();
			}).catch((e) => {
				!d.signal.aborted && s.current === f && o(e instanceof Error ? e.message : String(e));
			}).finally(() => {
				d.abort(), s.current === f && (s.current = null, i(null));
			});
		},
		cancel: l,
		error: a,
		dismissError: () => o(null),
		reportError: o,
		progress: r ? /* @__PURE__ */ q(_e, {
			...r,
			onReply: (e) => s.current?.reply?.(e),
			onCancel: l
		}) : null
	};
}, Yn = (e) => {
	let t = /^\/(login|logout)(?:\s+([\s\S]*))?$/.exec(e.trim());
	return t ? {
		action: t[1],
		argument: t[2]?.trim() ?? ""
	} : null;
}, Xn = (e) => ({
	isCommand: (e) => !!Yn(e),
	submit: (t, n) => {
		let r = Yn(t);
		if (!r) return;
		if (r.argument) return Promise.reject(e.rejectArguments(r.action));
		let i = e.start(r.action);
		return i ? Promise.reject(i) : (n?.(), Promise.resolve());
	}
}), Zn = (e, t = {}) => {
	let { projectId: n, model: a } = t, { t: o } = d("projects"), s = r(), c = i({
		queryKey: [
			"harness-authentication",
			n,
			e?.id,
			a
		],
		queryFn: () => M().agents.authentication(e.id, {
			projectId: n,
			model: a
		}),
		enabled: e?.availability.type === "INSTALLED",
		refetchInterval: 15e3
	}), l = Jn(n, e?.id, a), u = c.data, f = () => Promise.all([s.invalidateQueries({ queryKey: ["harness-authentication"] }), s.invalidateQueries({ queryKey: ["agent-models"] })]).then(() => {}), p = (t) => {
		if (!u || !e) {
			let e = Error(o("harnessAccount.unavailable"));
			return l.reportError(e.message), e;
		}
		l.start(t, e.name, f);
	}, m = Xn({
		start: p,
		rejectArguments: (e) => {
			let t = o("harnessAccount.noArguments", { command: `/${e}` });
			return l.reportError(t), Error(t);
		}
	}), h = e?.availability.type === "INSTALLED" ? ["login", "logout"].map((e) => ({
		name: `/${e}`,
		description: o(`harnessAccount.${e}`),
		onSelect: () => p(e)
	})) : [];
	return {
		start: p,
		authentication: u,
		checking: c.isFetching && c.data === void 0,
		progress: l.progress,
		commands: h,
		...m,
		notice: l.error ? /* @__PURE__ */ J(Te, {
			gap: "xs",
			children: [/* @__PURE__ */ q(Ee, {
				color: "fg.error",
				textStyle: "paragraph/S/regular",
				children: l.error
			}), /* @__PURE__ */ q(ye, {
				size: "sm",
				variant: "ghost",
				onClick: l.dismissError,
				children: o("harnessAccount.close")
			})]
		}) : null
	};
}, Qn = (e) => {
	let { input: t, projectId: n, selectedAgent: r, selectedModel: i, otherDevice: a, onInterrupt: o } = e, { data: s = [], isSuccess: c } = F(n), l = s.find((e) => e.id === r), u = Zn(a ? void 0 : l, {
		projectId: n,
		model: i
	}), d = a ? "ready" : qn(s, r, !!(n && c), u.authentication?.status), f = d === "missing", p = d === "signed_out", m = !p && !u.checking && !u.progress && Kt({
		agentOptions: s.map((e) => ({
			value: e.id,
			disabled: e.availability.type === "NOT_FOUND"
		})),
		selectedAgent: r,
		selectedModel: i,
		requiresModel: l?.supportsModels ?? !0
	}), h;
	return f && (h = /* @__PURE__ */ q(he, {
		onInterrupt: o,
		onReviewExtensions: () => void t.workbench.commands.executeCommand(T, { panelId: "extensions" })
	})), p && l && (h = /* @__PURE__ */ q(me, {
		name: l.name,
		onLogin: () => u.start("login")
	})), u.progress && (h = u.progress), {
		account: u,
		canSubmit: m,
		noHarnessAvailable: f,
		needsLogin: p,
		setup: h,
		commands: (e) => [...u.commands, ...p ? [] : e.filter((e) => !u.commands.some((t) => t.name === e.name))],
		submitAccountCommand: (e, t) => {
			let n = u.submit(e, t);
			if (n) return n;
			if (p || f || u.checking || u.progress) return Promise.reject(/* @__PURE__ */ Error("Sign in to an available harness before sending a message."));
		}
	};
}, $n = (e, t) => {
	let [n] = W(() => e.sessionId ? void 0 : mn(t)), [r, i] = W(e.agent ?? n?.harnessId ?? ""), [a, o] = W(e.lastSelectedModel ?? n?.model ?? ""), [s, c] = W(e.workspaceId ?? ""), [l, u] = W(e.sessionId ? e.params ?? {} : n?.params ?? {}), d = U(e);
	return H(() => {
		let t = d.current;
		d.current = e;
		let n = Jt(t, e);
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
}, er = (e, t, n) => {
	if (!e.workspaceId) return;
	let r = n.find((t) => t.id === e.workspaceId);
	return r ? R(r, t) : void 0;
}, tr = (e, t, n = z(P(e.workbench))) => {
	let r = er(t, P(e.workbench), n);
	if (r) return le(e.workbench, r);
}, nr = (e, t, n) => le(e.workbench, R(t, n)), rr = (e) => Object.keys(e).length > 0 ? e : void 0, ir = (e) => {
	let { input: t, view: n, emptyStateTitle: r, emptyStateDescription: i, workspaceAction: a, drafts: o, history: s } = e, c = [n.workspaceTitle, n.workspaceShorthand].filter(Boolean), l = n.sessionId ?? null, u = w(t.workbench.context.store, (e) => {
		let t = e.values[te];
		return typeof t == "string" ? t : void 0;
	}), d = Ut(t.workbench, u, n.workspaceId), { messages: f, loading: p, streaming: m, reconnect: h, refreshQueue: g, error: _, queueError: v, queue: y } = s, b = () => void t.workbench.commands.executeCommand(ne.chooseProjectFolder), x = At({ onFolderMissing: b }), S = jt(), C = Mt(), { selectedAgent: T, setSelectedAgent: E, selectedModel: D, setSelectedModel: O, selectedWorkspaceId: k, setSelectedWorkspaceId: A, harnessParamOverrides: j, setHarnessParamOverrides: ee } = $n(n, u), M = Tn(u, n.draftKey, o), N = Kn(o, n.draftKey), P = (e, n) => {
		u && xt({
			input: t,
			sessionId: e,
			prompt: n,
			projectId: u
		});
	}, F = u ? {
		project_id: u,
		agent: T,
		workspace_id: k || void 0,
		model: D || void 0,
		params: rr(j)
	} : void 0, I = Wn(l, T, N, h, n.status, n.lastRequestStarted, F, (e) => et(F, e, b), P, t), { pendingFollowUp: L, displayedMessages: re, streamingStartedAt: ie, pendingWork: ae } = Gn(n.draftKey, l, f, n.lastRequestStarted, n.status === "in_progress"), se = t.region !== "side", ce = yt(re, l, y, L), R = oe(ce.messages), z = m || n.status === "in_progress" || ae, le = !!l && z && !C.isPending, ue = l && le && !n.device ? () => C.mutate(l) : void 0, { account: B, canSubmit: de, noHarnessAvailable: V, needsLogin: fe, setup: me, commands: he, submitAccountCommand: _e } = Qn({
		input: t,
		projectId: u,
		selectedAgent: T,
		selectedModel: D,
		otherDevice: !!n.device,
		onInterrupt: ue
	}), H = (e, t, r, i) => _e(e, () => N.change("")) || I.submit(e, t, r, i) || Et({
		conversationKey: n.draftKey,
		sessionId: l,
		sessionStatus: n.status,
		lastRequestStarted: n.lastRequestStarted,
		projectId: u,
		agent: T || null,
		model: D || void 0,
		params: rr(j),
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
		onSessionCreated: (t) => P(t, e)
	}), U = I.decision && {
		...I.decision,
		controls: I.controls
	}, W = Dt(H, M.attachments, () => {
		N.change(""), M.clearSubmittedAttachments();
	});
	return /* @__PURE__ */ q(G, {
		position: "relative",
		h: "full",
		w: "full",
		children: /* @__PURE__ */ q(G, {
			position: "absolute",
			inset: "0",
			overflow: "hidden",
			children: /* @__PURE__ */ q(On, {
				conversationKey: `dashboard-workbench-session:${n.id}`,
				messages: R,
				linkHandler: d.handler,
				conversationNotices: /* @__PURE__ */ J(K, { children: [
					I.notices,
					B.notice,
					R.length > 0 ? me : null,
					d.notice,
					/* @__PURE__ */ q(pe, {
						error: _,
						queueError: v,
						reconnect: h,
						refreshQueue: g,
						unsent: L?.failure ? {
							notice: L.failure,
							...Ot(L, {
								clear: () => Ct(n.draftKey, L),
								send: H,
								restore: (e, t) => {
									N.change(e), M.restoreAttachments(t);
								}
							})
						} : void 0
					})
				] }),
				queuedFollowUps: ce.queuedFollowUps,
				loading: p,
				streaming: z,
				streamingStartedAt: ie,
				emptyStateTitle: r,
				emptyStateDescription: i,
				emptyStateContent: me,
				hideComposer: V,
				loaderComponent: /* @__PURE__ */ q(Pe, {}),
				chatInputPlaceholder: "Reply to the agent...",
				chatInputDefaultValue: N.text,
				onChatInputChange: N.change,
				chatInputCommands: he(I.suggestions),
				composerDecision: U,
				composerFallback: n.device ? /* @__PURE__ */ q(ge, { name: n.device.name }) : void 0,
				attachedResources: c,
				projectId: u,
				sessionId: l,
				draftKey: n.draftKey,
				drafts: o,
				queue: y,
				refreshQueue: g,
				draftAttachments: M,
				modelControls: {
					projectId: u,
					view: n,
					selectedAgent: T,
					setSelectedAgent: E,
					selectedModel: D,
					setSelectedModel: O,
					harnessParamOverrides: j,
					setHarnessParamOverrides: ee,
					children: I.controls
				},
				submitDisabled: !!n.device || !de && !B.isCommand(N.text),
				messagesBlocked: fe || V || B.checking || !!B.progress,
				inputDisabled: !!n.device,
				workspaceHub: /* @__PURE__ */ q(rn, {
					view: n,
					projectId: u,
					selectedWorkspaceId: k,
					setSelectedWorkspaceId: A,
					onSelectWorkspace: se ? (e) => void nr(t, e, u) : void 0,
					additions: n.additions,
					deletions: n.deletions,
					action: a
				}),
				onSubmitMessage: n.device ? void 0 : W,
				onInterrupt: ue
			})
		})
	});
}, ar = (e) => {
	let { input: t, view: n } = e;
	return /* @__PURE__ */ q(Ae, {
		content: "Open workspace",
		children: /* @__PURE__ */ q(Ce, {
			size: "xs",
			variant: "ghost",
			"aria-label": "Open workspace",
			onClick: () => void tr(t, n),
			children: /* @__PURE__ */ q(c, { size: 14 })
		})
	});
}, or = (e) => {
	let { input: t, drafts: n } = e, [r, i] = W(() => fe(t.instance));
	H(() => {
		let e = () => i(fe(t.instance)), n = ce(t.instance.resource?.type === "session" ? t.instance.resource.id : void 0, e);
		return e(), n;
	}, [t.instance]);
	let a = He(t), o = Qe(a, r.sessionId), s = w(t.workbench.context.store, (e) => e.values["dashboard.activeResource.kind"] === "workspace" && e.values["dashboard.activeResource.id"] === r.workspaceId);
	return /* @__PURE__ */ q(ir, {
		input: a,
		view: r,
		history: o,
		drafts: n,
		emptyStateTitle: "No messages yet",
		emptyStateDescription: "Send a message to start this session.",
		workspaceAction: r.workspaceId && !s ? /* @__PURE__ */ q(ar, {
			input: t,
			view: r
		}) : void 0
	}, r.draftKey);
};
export { or as SessionWidget };
