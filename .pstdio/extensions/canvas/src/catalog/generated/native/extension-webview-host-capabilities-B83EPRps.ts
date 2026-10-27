// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, c as t, d as n, f as r, g as i, h as a, l as o, m as s, n as c, o as l, p as u, r as d, s as f, u as p, v as m, y as h } from "./schemas-D84h_Ad-.ts";
import { a as g, i as _, n as v, r as ee, t as y } from "./resource-ref-D_HHex4N.ts";
import { r as te, t as b } from "./navigation-oeGsFbYd.ts";
import { X as ne, Y as re } from "./workbench-core-kaLFKJEn.ts";
import { CommandOutcomeError as ie, getCommandValue as ae } from "@pstdio/sdk/extensions";
// packages/pstdio-api-contracts/src/extension-kernel/workbench-targets.ts
var oe = ["workbench.nav.actions", "workbench.nav.overflow"], se = [
	"workbench.left.tree",
	"workbench.main.left.tree",
	"workbench.main.right.tree"
], ce = [
	"nav",
	"activity",
	"sidenav",
	"main-header",
	"main",
	"secondary-header",
	"secondary",
	"side-header",
	"side",
	"status",
	"overlay"
], le = [
	"workbench.main",
	"workbench.main.left",
	"workbench.main.right",
	"workbench.secondary"
], ue = ["workbench.settings"], de = ["project", "global"], fe = [
	"workbench.left",
	"workbench.main.left",
	"workbench.main",
	"workbench.main.right",
	"workbench.secondary"
], pe = c(oe), me = c(se);
c(ce);
var he = c(le), ge = c(ue);
c(fe);
var _e = m([
	pe,
	me,
	he,
	ge
]);
c(de);
// packages/pstdio-api-contracts/src/extensions/page-params-schema.ts
var x = m([
	i(),
	r(),
	l(),
	e(i())
]);
s(i(), t("type", [
	u({
		type: n("string"),
		default: i().optional(),
		values: e(i()).readonly().optional()
	}).strict(),
	u({
		type: n("number"),
		default: r().optional()
	}).strict(),
	u({
		type: n("boolean"),
		default: l().optional()
	}).strict(),
	u({
		type: n("string[]"),
		default: e(i()).readonly().optional()
	}).strict()
])).superRefine((e, t) => {
	try {
		re(e);
	} catch (e) {
		t.addIssue({
			code: "custom",
			message: String(e)
		});
	}
});
// packages/pstdio-api-contracts/src/extensions/workbench-refs-metadata.ts
var S = (e) => u({
	extensionId: i(),
	kind: n(e),
	id: i()
}), C = S("page"), ve = S("placement");
S("mode"), S("view"), S("resource-kind");
var ye = u({
	kind: n("page-slot"),
	page: C,
	id: i()
}), be = m([ve, ye]), xe = u({
	command: S("command"),
	params: g.optional()
}), w = u({
	line: r().int().positive(),
	column: r().int().positive().optional(),
	endLine: r().int().positive().optional(),
	endColumn: r().int().positive().optional()
}).refine(ne, "Expected ordered source coordinates"), T = u({ anchors: e(u({
	id: i(),
	heading: i(),
	occurrence: r().int().nonnegative().optional()
})) }), E = p(() => u({
	kind: n("page"),
	page: C,
	resource: y.optional(),
	open: c(["preview", "pin"]).optional(),
	section: T.optional(),
	position: w.optional(),
	params: s(i(), x).optional(),
	parent: E.optional(),
	intent: c(["open", "restore"]).optional()
}).refine((e) => !(e.position && e.section), "Choose a source position or a heading section")).meta({ id: "WorkbenchMetadataPageTarget" }), D = m([E, u({
	kind: n("panel"),
	panel: be,
	resource: y.optional(),
	open: c(["preview", "pin"]).optional()
})]), O = m([
	D,
	u({
		kind: n("viewer"),
		operation: c(["switch", "replace"]),
		from: y.optional(),
		resource: y,
		page: C.optional(),
		section: T.optional(),
		position: w.optional()
	}).strict().refine((e) => e.from !== void 0 || e.page !== void 0, "A resource-free landing requires its destination page").refine((e) => !(e.position && e.section), "Choose a source position or a heading section"),
	u({
		kind: n("command"),
		target: xe
	}),
	u({
		kind: n("href"),
		href: i().refine(te, "Expected an HTTP or HTTPS URL")
	}),
	u({
		kind: n("compound"),
		targets: e(D).min(1)
	})
]), Se = u({
	type: c([
		"info",
		"success",
		"warning",
		"error"
	]),
	title: i().optional(),
	message: i(),
	metadata: g.optional()
}), Ce = u({
	code: i(),
	message: i(),
	severity: c([
		"info",
		"warning",
		"error"
	]),
	extensionId: i().optional(),
	commandId: i().optional(),
	metadata: g.optional()
}), k = (r) => {
	let a = u({
		name: i().optional(),
		message: i(),
		stack: i().optional(),
		cause: r.optional()
	}), o = {
		notices: e(Se).optional(),
		diagnostics: e(Ce).optional()
	}, s = {
		...o,
		ok: n(!1),
		code: i().optional(),
		reason: i(),
		data: g.optional(),
		cause: r.optional(),
		error: a.optional()
	}, c = O;
	return t("status", [
		u({
			...o,
			ok: n(!0),
			status: n("success"),
			value: h().optional(),
			navigationRequests: e(c).optional()
		}).transform((e) => ({
			...e,
			value: e.value
		})),
		u({
			...s,
			status: n("rejected")
		}),
		u({
			...s,
			status: n("error")
		})
	]);
}, we = k(o()), A = u({
	id: i(),
	kind: ee,
	context: _
}), j = u({
	target: _e,
	mode: i().optional(),
	projectId: i().optional(),
	resource: y.optional()
});
u({
	rendererId: i(),
	pageParams: s(i(), x).optional(),
	projectId: i().optional(),
	modeId: i().optional(),
	resource: y.optional(),
	invocation: u({ placement: c(["visible", "background"]) }).optional()
}), u({
	projectId: i().min(1),
	workspaceId: i().optional(),
	params: _.optional(),
	resource: y.optional(),
	attachment: j.optional(),
	slot: A.optional(),
	source: v.optional(),
	metadata: _.optional()
}), u({
	workspaceId: i().optional(),
	params: _.optional(),
	resource: y.optional(),
	attachment: j.optional(),
	slot: A.optional(),
	source: v.optional(),
	metadata: _.optional()
}), u({
	eventId: i().min(1),
	payload: _
}).strict();
var Te = O, Ee = u({
	ok: l(),
	status: c([
		"success",
		"rejected",
		"error"
	]),
	value: h().optional(),
	navigationRequests: e(Te).optional(),
	code: i().optional(),
	reason: i().optional(),
	data: _.optional(),
	error: u({
		name: i().optional(),
		message: i(),
		stack: i().optional()
	}).optional(),
	notices: e(u({
		type: c([
			"info",
			"success",
			"warning",
			"error"
		]),
		title: i().optional(),
		message: i(),
		metadata: _.optional()
	})).optional(),
	diagnostics: e(u({
		code: i(),
		message: i(),
		severity: c([
			"info",
			"warning",
			"error"
		]),
		extensionId: i().optional(),
		commandId: i().optional(),
		metadata: _.optional()
	})).optional()
}), M = {
	commandId: i(),
	extensionId: i(),
	eventIds: e(i()).optional()
};
u({
	...M,
	outcome: Ee
});
var De = ((e) => u({
	...M,
	outcome: k(e)
}))(o()), Oe = (e) => {
	let t = [], n = (e) => ({
		...e,
		name: e.name,
		message: e.message,
		...e.stack ? { stack: e.stack } : {},
		...e.cause === void 0 ? {} : { cause: e.cause }
	}), r = /* @__PURE__ */ new WeakMap(), i = (e) => {
		let t = r.get(e);
		if (t) return t;
		let i = n(e);
		return r.set(e, i), i;
	}, a = e instanceof Error ? i(e) : { message: String(e) };
	return JSON.parse(JSON.stringify(a, function(e, n) {
		let r = n instanceof Error ? i(n) : n;
		if (typeof r == "bigint") return String(r);
		if (r && typeof r == "object") {
			for (; t.length && t.at(-1) !== this;) t.pop();
			if (t.includes(r)) return "[Circular]";
			t.push(r);
		}
		return r;
	}));
}, ke = () => {
	let e = null, t = [], n = /* @__PURE__ */ new Set();
	return {
		emit(n) {
			e ? e(n) : t.push(n);
		},
		bind(n) {
			for (e = n; t.length > 0;) n(t.shift());
		},
		onDisconnect(e) {
			return n.add(e), () => n.delete(e);
		},
		unbind() {
			e = null;
			for (let e of n) e();
		}
	};
}, Ae = (e, t) => {
	switch (t.op) {
		case "status": return e.status();
		case "loginStatus": return e.loginStatus(t.id);
		case "devices": return e.devices();
		case "projectSyncStatus": return e.projectSyncStatus(t.projectId);
		case "login": return e.login(t.managerOrigin);
		case "cancelLogin": return e.cancelLogin(t.id);
		case "logout": return e.logout();
		case "renameDevice": return e.renameDevice(t.id, t.name);
		case "removeDevice": return e.removeDevice(t.id);
		case "syncProject": return e.syncProject(t.projectId);
		case "stopProjectSync": return e.stopProjectSync(t.projectId);
	}
}, je = (e) => e && ((t) => Ae(e, t)), N = /* @__PURE__ */ new WeakMap(), P = /* @__PURE__ */ new WeakMap(), Me = async (e, t) => {
	if (N.has(t)) return;
	let n = e.retain(), r = !1, i = async () => {
		r || (r = !0, a(), N.delete(t), await (await n)());
	}, a = t.onDisconnect(() => {
		i().catch(() => {});
	});
	N.set(t, i);
	try {
		await n;
	} catch (e) {
		throw await i().catch(() => {}), e;
	}
}, Ne = (e, t) => {
	if (e) return async (n) => {
		if (n.operation === "state") return e.state();
		if (n.operation === "recordings") return e.recordings();
		if (n.operation === "snapshot") return e.snapshot();
		if (!t) throw Error("Performance subscriptions are unavailable in this host");
		if (n.operation === "dispose") {
			await N.get(t)?.();
			return;
		}
		if (n.operation === "retain") {
			await Me(e, t);
			return;
		}
		if (n.operation === "unsubscribe") {
			P.get(t)?.();
			return;
		}
		if (P.has(t)) return;
		let r = e.subscribe((e) => t.emit({
			scope: "performance.read",
			payload: e
		})), i = t.onDisconnect(() => a()), a = () => {
			r(), i(), P.delete(t);
		};
		P.set(t, a);
	};
}, Pe = "terminal.session", Fe = (e) => {
	let { terminal: t, hostEvents: n } = e, r = (e) => {
		n.emit({
			scope: Pe,
			payload: e
		});
	};
	return async (e) => {
		let i = e;
		switch (i.operation) {
			case "open": {
				let { sessionId: e } = await t.open({ request: i.request });
				return {
					operation: "open",
					sessionId: e
				};
			}
			case "write": return t.write({
				sessionId: i.sessionId,
				data: i.data
			}), {
				operation: "write",
				accepted: !0
			};
			case "resize": return t.resize({
				sessionId: i.sessionId,
				cols: i.cols,
				rows: i.rows
			}), {
				operation: "resize",
				accepted: !0
			};
			case "kill": return await t.kill({
				sessionId: i.sessionId,
				signal: i.signal
			}), {
				operation: "kill",
				accepted: !0
			};
			case "subscribe": {
				let { sessionId: e } = i, a = () => {}, o = () => {}, s = !1, c = () => {
					s || (s = !0, a(), o());
				};
				return a = t.subscribe(e, {
					onData: (t) => r({
						sessionId: e,
						kind: "data",
						chunk: t
					}),
					onExit: (t) => {
						r({
							sessionId: e,
							kind: "exit",
							code: t.code,
							signal: t.signal
						}), c();
					}
				}), o = n.onDisconnect(c), {
					operation: "subscribe",
					accepted: !0
				};
			}
		}
	};
}, F = i().min(1), I = { sessionId: F }, Ie = e(u({
	path: e(i()),
	value: o()
})), L = {
	...I,
	sequence: r().int().positive(),
	changes: Ie
}, R = t("operation", [
	u({
		...I,
		operation: n("open"),
		key: F,
		initial: g,
		save: u({
			commandId: F,
			params: g.optional()
		}).strict()
	}),
	u({
		...L,
		operation: n("commit")
	}),
	u({
		...L,
		operation: n("preview")
	}),
	u({
		...I,
		operation: n("cancel")
	}),
	u({
		...I,
		operation: n("close")
	}),
	u({
		...I,
		operation: n("save")
	}),
	u({
		...I,
		operation: n("refresh"),
		value: g,
		expectedVersion: r().int().nonnegative()
	})
]), Le = t("kind", [
	u({
		kind: n("navigate"),
		id: i(),
		label: i(),
		target: f(b, "Invalid navigation target."),
		primary: l().optional()
	}),
	u({
		kind: n("command"),
		id: i(),
		label: i(),
		command: i(),
		params: _.optional(),
		primary: l().optional(),
		destructive: l().optional()
	}),
	u({
		kind: n("url"),
		id: i(),
		label: i(),
		href: i(),
		primary: l().optional()
	})
]), Re = u({
	title: i().min(1),
	body: i().optional(),
	kind: c([
		"needs_review",
		"ready_to_merge",
		"blocked",
		"approval_required",
		"failed",
		"info"
	]),
	priority: c([
		"low",
		"normal",
		"high",
		"urgent"
	]).optional(),
	target: y.optional(),
	related: e(y).optional(),
	actions: e(Le).optional(),
	dedupeKey: i().optional(),
	expiresAt: i().optional(),
	snoozedUntil: i().optional(),
	metadata: _.optional()
}), z = class extends Error {
	code;
	data;
	constructor(e, t, n) {
		super(t), this.code = e, this.data = n, this.name = "WebviewHostCapabilityError";
	}
}, B = i().min(1), V = u({}).strict().optional(), H = u({
	commandId: B,
	params: _.optional(),
	workspaceId: B.optional(),
	resource: y.optional(),
	metadata: _.optional()
}), U = { streamId: B }, ze = u({
	scope: c([
		"default",
		"user",
		"project",
		"workspace",
		"extension",
		"session"
	]),
	scopeId: i().optional()
}), W = u({
	name: B,
	scope: ze.optional()
}), G = u({
	id: B.optional(),
	dedupeKey: i().optional(),
	status: c([
		"done",
		"dismissed",
		"expired"
	]).optional()
}).refine((e) => e.id !== void 0 || e.dedupeKey !== void 0, "Provide a notification ID or dedupe key."), Be = m([d(Uint8Array), d(ArrayBuffer)]), K = u({
	type: B,
	id: i().optional()
}), q = { sessionId: B }, Ve = u({
	cols: r().int().positive(),
	rows: r().int().positive(),
	command: e(i()).optional(),
	cwd: i().optional(),
	env: s(i(), i()).optional()
}), J = { projectId: B.optional() }, He = {
	"performance.read": a({ operation: c([
		"state",
		"snapshot",
		"subscribe",
		"unsubscribe",
		"recordings",
		"retain",
		"dispose"
	]) }),
	"performance.control": t("operation", [a({
		operation: n("set-enabled"),
		enabled: l()
	}), a({
		operation: c(["pause-extension", "resume-extension"]),
		installedExtensionId: B
	})]),
	"harnesses.read": u({
		harnessId: B.optional(),
		model: i().optional()
	}),
	"resources.actions": t("operation", [u({
		operation: n("list"),
		resource: y
	}), u({
		operation: n("execute"),
		resource: y,
		key: B
	})]),
	"commands.execute": H,
	"editing.session": R,
	"commands.stream": t("operation", [
		H.extend({
			...U,
			operation: n("start")
		}),
		u({
			...U,
			operation: n("cancel")
		}),
		u({
			...U,
			operation: n("ack"),
			bytes: r().int().positive()
		})
	]),
	"navigation.open": u({ target: f(b, "Invalid navigation target.") }),
	"page.params.update": u({ params: s(i(), x.nullable()) }),
	"placement.close": V,
	"notification.show": m([u({
		type: c([
			"info",
			"success",
			"warning",
			"error"
		]),
		title: i().optional(),
		message: i(),
		metadata: _.optional()
	}), u({
		level: c([
			"info",
			"success",
			"warning",
			"error"
		]),
		title: i().optional(),
		message: i().optional()
	})]),
	"notification.action": Re,
	"notification.resolve": G,
	"notification.dismiss": G,
	"preferences.get": W,
	"preferences.set": W.extend({ value: m([
		l(),
		r(),
		i(),
		e(i()),
		e(r()),
		e(l()),
		_
	]) }),
	"extension.settings.all": V,
	"extension.settings.get": u({ key: B }),
	"extension.settings.set": u({
		key: B,
		value: h()
	}),
	"extension.settings.delete": u({ key: B }),
	"terminal.session": t("operation", [
		u({
			operation: n("open"),
			request: Ve
		}),
		u({
			...q,
			operation: n("write"),
			data: m([i(), d(Uint8Array)])
		}),
		u({
			...q,
			operation: n("resize"),
			cols: r().int().positive(),
			rows: r().int().positive()
		}),
		u({
			...q,
			operation: n("kill"),
			signal: i().optional()
		}),
		u({
			...q,
			operation: n("subscribe")
		})
	]),
	"files.upload": u({
		name: B,
		data: Be,
		mimeType: i().optional(),
		scope: K.optional()
	}),
	"files.list": u({ scope: K.optional() }),
	"files.delete": u({ id: B }),
	"artifacts.read": t("op", [
		u({
			op: n("list"),
			mount: B,
			prefix: i().optional()
		}),
		u({
			op: n("readText"),
			mount: B,
			path: i()
		}),
		u({
			op: n("imageUrl"),
			mount: B,
			path: i()
		})
	]),
	"account.read": t("op", [
		u({ op: n("status") }),
		u({
			op: n("loginStatus"),
			id: B
		}),
		u({ op: n("devices") }),
		u({
			op: n("projectSyncStatus"),
			...J
		})
	]),
	"account.manage": t("op", [
		u({
			op: n("login"),
			managerOrigin: B.optional()
		}),
		u({
			op: n("cancelLogin"),
			id: B
		}),
		u({ op: n("logout") }),
		u({
			op: n("renameDevice"),
			id: B,
			name: i()
		}),
		u({
			op: n("removeDevice"),
			id: B
		}),
		u({
			op: n("syncProject"),
			...J
		}),
		u({
			op: n("stopProjectSync"),
			...J
		})
	])
}, Ue = (e, t) => {
	let n = He[e].safeParse(t);
	if (!n.success) throw new z("invalid_params", `Invalid parameters for ${e}.`, {
		capability: e,
		issues: n.error.issues.map((e) => ({
			path: e.path.map(String),
			message: e.message
		}))
	});
	return n.data;
}, We = (e, t = e) => ({
	ok: !1,
	status: "error",
	code: e,
	reason: t
}), Ge = (e) => {
	let t = Oe(e);
	return {
		ok: !1,
		status: "error",
		code: e?.code ?? "command_stream_disconnected",
		reason: t.message,
		error: t,
		...t.cause === void 0 ? {} : { cause: t.cause }
	};
}, Y = (e) => Object.assign(Error(e), { code: e }), Ke = 16, qe = 8388608, Je = async (e, t) => {
	let n = new AbortController(), r = e.onDisconnect(() => n.abort());
	try {
		return await t(n.signal);
	} finally {
		r();
	}
}, Ye = (e) => {
	let t = /* @__PURE__ */ new Map();
	return async (n, r) => {
		let { streamId: i } = n;
		if (n.operation === "cancel") t.get(i)?.stop("command_stream_cancelled");
		else if (n.operation === "ack") {
			let e = t.get(i);
			e && Number.isSafeInteger(n.bytes) && n.bytes > 0 && n.bytes <= e.unread && (e.unread -= n.bytes);
		} else {
			if (t.has(i)) throw Y("command_stream_duplicate");
			if (t.size >= Ke) throw Y("command_stream_limit");
			let a = new AbortController(), o = !1, s = () => {}, c = (t) => e.emit({
				scope: "commands.stream",
				payload: {
					streamId: i,
					...t
				}
			}), l = (e, n = !0) => {
				o || (o = !0, t.delete(i), s(), a.abort(), n && c({
					type: "end",
					outcome: e
				}));
			}, u = {
				unread: 0,
				stop: (e, t = !0) => l(We(e), t)
			};
			t.set(i, u), s = e.onDisconnect(() => u.stop("command_stream_cancelled", !1));
			let { operation: d, streamId: f, commandId: p, ...m } = n, h = (e) => {
				if (e.type === "end") {
					let t = De.parse(e.response);
					r.publish?.(t), l(t.outcome);
				} else u.unread += new TextEncoder().encode(JSON.stringify(e.data)).byteLength, u.unread > qe ? u.stop("command_stream_overflow") : c(e);
			};
			(async () => {
				try {
					for await (let e of r.stream({
						commandId: p,
						...m
					}, a.signal)) {
						if (o) break;
						h(e);
					}
					o || u.stop("command_stream_disconnected");
				} catch (e) {
					l(Ge(e));
				}
			})();
		}
		return {
			operation: n.operation,
			accepted: !0
		};
	};
}, X = u({ outcome: we }).passthrough(), Z = /* @__PURE__ */ new WeakMap(), Xe = (e) => {
	let t = Z.get(e);
	return t || (t = Ye(e), Z.set(e, t)), t;
}, Q = (e, t) => e instanceof Promise ? e.then(t) : t(), $ = (e, t) => (n) => {
	if (!t) throw new z("unsupported", `The host does not support ${e}.`, { capability: e });
	return t(Ue(e, n));
}, Ze = (e) => {
	let { executeCommand: t, hostEvents: n } = e;
	if (t) return async (e) => {
		try {
			let r = n ? await Je(n, (n) => Promise.resolve(t(e, n))) : await t(e);
			return X.parse(r);
		} catch (e) {
			if (e instanceof ie) return X.parse({ outcome: e.outcome });
			throw e;
		}
	};
}, Qe = (e) => {
	let { streamCommand: t, hostEvents: n } = e;
	if (t && n) return (r) => Xe(n)(r, {
		stream: t,
		publish: e.commandCompleted
	});
}, $e = (e) => {
	let { editing: t, executeCommand: n } = e;
	if (t && n) return (e) => t.request(e, async (e) => {
		let t = X.parse(await n(e));
		return ae(t.outcome);
	});
}, et = (e) => {
	let { hostEvents: t, navigation: n, pageParams: r, placement: i, notifications: a, settings: o, preferences: s, files: c, artifacts: l, terminal: u } = e, d = u && t ? Fe({
		terminal: u,
		hostEvents: t
	}) : void 0, f = e.harnesses?.read.bind(e.harnesses), p = je(e.account);
	return {
		"harnesses.read": $("harnesses.read", f),
		"resources.actions": $("resources.actions", e.resourceActions),
		"commands.execute": $("commands.execute", Ze(e)),
		"commands.stream": $("commands.stream", Qe(e)),
		"editing.session": $("editing.session", $e(e)),
		"navigation.open": $("navigation.open", n && ((e) => Q(n.open(e.target), () => void 0))),
		"page.params.update": $("page.params.update", r && ((e) => {
			let t = r.update(e.params);
			return t instanceof Promise ? t.then((e) => ({ location: e })) : { location: t };
		})),
		"placement.close": $("placement.close", i && (() => i.close())),
		"notification.show": $("notification.show", a?.show && ((e) => Q(a.show("type" in e ? e : {
			type: e.level,
			...e.title === void 0 ? {} : { title: e.title },
			message: e.message ?? ""
		}), () => void 0))),
		"notification.action": $("notification.action", a?.create && ((e) => a.create(e))),
		"notification.resolve": $("notification.resolve", a?.resolve && ((e) => a.resolve({
			...e,
			status: e.status ?? "done"
		}))),
		"notification.dismiss": $("notification.dismiss", a?.resolve && ((e) => a.resolve({
			...e,
			status: "dismissed"
		}))),
		"preferences.get": $("preferences.get", s && ((e) => s.get(e.name, e.scope))),
		"preferences.set": $("preferences.set", s && ((e) => {
			let t = e.scope ?? { scope: "user" };
			if (t.scope === "default") throw new z("preference_scope_read_only", "Default preferences are read-only.", {});
			return Q(s.set(e.name, e.value, t), () => ({
				name: e.name,
				value: e.value
			}));
		})),
		"extension.settings.all": $("extension.settings.all", o && (() => o.all())),
		"extension.settings.get": $("extension.settings.get", o && ((e) => o.get(e.key))),
		"extension.settings.set": $("extension.settings.set", o && (async (e) => ({
			key: e.key,
			value: (await o.set(e.key, e.value)).value
		}))),
		"extension.settings.delete": $("extension.settings.delete", o && ((e) => o.delete(e.key))),
		"terminal.session": $("terminal.session", d && ((e) => d(e))),
		"files.upload": $("files.upload", c && ((e) => c.upload(e))),
		"files.list": $("files.list", c && ((e) => c.list(e))),
		"files.delete": $("files.delete", c && ((e) => c.delete(e))),
		"artifacts.read": $("artifacts.read", l && ((e) => l.read(e))),
		"performance.read": $("performance.read", Ne(e.performance, t)),
		"performance.control": $("performance.control", e.performance?.control),
		"account.read": $("account.read", p),
		"account.manage": $("account.manage", p)
	};
};
export { ke as n, et as t };
