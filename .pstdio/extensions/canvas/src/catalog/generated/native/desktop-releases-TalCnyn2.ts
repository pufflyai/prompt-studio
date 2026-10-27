// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// clients/landing-page/src/services/release-assets.ts
var e = [
	{
		target: "darwin-arm64",
		platform: "macOS",
		architecture: "Apple silicon",
		suffixes: [".dmg"]
	},
	{
		target: "darwin-x64",
		platform: "macOS",
		architecture: "Intel",
		suffixes: [".dmg"]
	},
	{
		target: "linux-x64",
		platform: "Linux",
		architecture: "x64",
		suffixes: [".deb", ".zip"]
	},
	{
		target: "win32-x64",
		platform: "Windows",
		architecture: "x64",
		suffixes: ["-Setup.exe"]
	}
], t = (e) => /^pstdio@(\d+)\.(\d+)\.(\d+)$/.exec(e)?.slice(1).map(Number), n = (e, n) => {
	let r = t(e.tag_name), i = t(n.tag_name);
	for (let e = 0; e < 3; e++) if (r[e] !== i[e]) return i[e] - r[e];
	return 0;
}, r = (t) => {
	let n = t.tag_name.slice(7);
	return e.flatMap(({ target: e, platform: r, architecture: i, suffixes: a }) => a.flatMap((a) => {
		let o = t.assets.find((t) => t.name === `Prompt-Studio-${n}-${e}${a}`);
		if (!o) return [];
		let s = a.slice(a.lastIndexOf(".") + 1);
		return [{
			id: `${e}-${s}`,
			platform: r,
			architecture: i,
			format: s,
			url: o.browser_download_url,
			size: o.size
		}];
	}));
}, i = (e) => {
	for (let i of e.filter((e) => !e.draft && !e.prerelease && t(e.tag_name)).sort(n)) {
		let e = r(i);
		if (e.length) return {
			version: i.tag_name.slice(7),
			downloads: e
		};
	}
}, a = (e, t, n) => {
	let r = /Macintosh|Mac OS X/i.test(t);
	if (/Android|iPhone|iPad|iPod|Windows Phone|CrOS/i.test(t) || r && n > 1) return;
	if (r) return e.find((e) => e.platform === "macOS");
	let i = /aarch64|arm64/i.test(t) ? "ARM64" : "x64";
	if (/Windows/i.test(t)) return e.find((e) => e.platform === "Windows" && e.architecture === i);
	if (/Linux/i.test(t)) return e.find((e) => e.platform === "Linux" && e.architecture === i);
}, o = (e) => e.format === "deb" ? "Debian / Ubuntu · DEB" : e.format === "zip" ? "ZIP archive" : e.format.toUpperCase(), s = "https://github.com/pufflyai/prompt-studio/releases", c = "https://api.github.com/repos/pufflyai/prompt-studio/releases?per_page=100", l = async (e) => {
	let t = c;
	for (; t;) {
		let n = await fetch(t, {
			signal: e,
			headers: { Accept: "application/vnd.github+json" }
		});
		if (!n.ok) throw Error("Desktop downloads could not be loaded.");
		let r = i(await n.json());
		if (r) return r;
		t = n.headers.get("Link")?.match(/<([^>]+)>; rel="next"/)?.[1];
	}
	throw Error("No desktop release is available.");
};
export { a as i, l as n, o as r, s as t };
