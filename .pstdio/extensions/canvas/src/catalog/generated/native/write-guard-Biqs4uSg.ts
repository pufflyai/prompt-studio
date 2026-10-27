// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// extensions/pstdio-planner/src/data/write-guard.ts
var e = Symbol.for("pstdio.pstdio-planner.write-guards"), t = Symbol.for("pstdio.pstdio-planner.write-waiters"), n = globalThis;
n[t] ??= /* @__PURE__ */ new Map();
var r = n[t];
n[e] ??= /* @__PURE__ */ new Set();
var i = n[e];
async function a(e, t, n, a) {
	let o = JSON.stringify([
		e.projectId,
		e.extensionId,
		t
	]);
	if (i.has(o)) {
		if (a) return a();
		throw Error("Another Planner write is running. Retry when it finishes.");
	}
	i.add(o);
	try {
		return await n();
	} finally {
		i.delete(o);
		let e = r.get(o);
		r.delete(o);
		for (let t of e ?? []) t();
	}
}
export { a as t };
