// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, i as t, n, o as r, r as i, t as a } from "./file-CwzjPVtd.ts";
import { t as o } from "./file-code-Bdj5XAS8.ts";
import { t as s } from "./file-image-C-vmn7dP.ts";
import { t as c } from "./file-text-B9-uT4dU.ts";
// packages/ui/src/utils/get-file-type-icon.ts
var l = (l) => {
	let u = l.split(".").pop()?.toLowerCase() ?? "";
	return [
		"csv",
		"tsv",
		"xlsx",
		"xls",
		"parquet"
	].includes(u) ? n : [
		"sql",
		"py",
		"js",
		"ts",
		"jsx",
		"tsx",
		"java",
		"cpp",
		"c",
		"h",
		"css",
		"scss",
		"sass",
		"php",
		"rb",
		"go",
		"rs",
		"kt",
		"swift"
	].includes(u) ? o : [
		"json",
		"jsonl",
		"ndjson"
	].includes(u) ? l.includes("/visualizations/") ? t : e : [
		"md",
		"txt",
		"rst",
		"org",
		"pdf",
		"doc",
		"docx",
		"rtf"
	].includes(u) ? c : [
		"yaml",
		"yml",
		"toml",
		"ini",
		"conf",
		"config"
	].includes(u) ? i : [
		"png",
		"jpg",
		"jpeg",
		"gif",
		"svg",
		"webp",
		"ico"
	].includes(u) ? s : [
		"zip",
		"tar",
		"gz",
		"rar",
		"7z"
	].includes(u) ? r : a;
};
export { l as t };
