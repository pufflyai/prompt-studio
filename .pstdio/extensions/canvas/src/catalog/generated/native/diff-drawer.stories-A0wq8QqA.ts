// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./lazy-diff-BWp6ftx2.ts";
import { t } from "./diff-size-BfcOlnSz.ts";
import { Box as n } from "@chakra-ui/react";
import { jsx as r } from "react/jsx-runtime";
// packages/ui/src/components/diff-viewer/diff-drawer.stories.tsx
var i = [
	{
		change: "modified",
		oldPath: "src/index.ts",
		newPath: "src/index.ts",
		oldContent: "import { foo } from \"./foo\";\n\nconsole.log(foo);\n",
		newContent: "import { foo, bar } from \"./foo\";\n\nconsole.log(foo);\nconsole.log(bar);\n",
		additions: 2,
		deletions: 0
	},
	{
		change: "added",
		newPath: "src/new-file.tsx",
		oldContent: "",
		newContent: "export const NewFile = () => {\n  return <div>New File</div>;\n};\n",
		additions: 3,
		deletions: 0
	},
	{
		change: "deleted",
		oldPath: "src/old-file.ts",
		oldContent: "export const old = true;\n",
		newContent: "",
		additions: 0,
		deletions: 1
	},
	{
		change: "renamed",
		oldPath: "src/utils.ts",
		newPath: "src/helpers.ts",
		oldContent: "export const util = () => {};\n",
		newContent: "export const helper = () => {};\n",
		additions: 1,
		deletions: 1
	},
	{
		change: "modified",
		oldPath: "packages/very-long-directory-name-that-should-be-truncated-because-it-is-so-long/and-another-subdirectory/even-more-nesting/the-final-file-name-which-is-also-quite-long.ts",
		newPath: "packages/very-long-directory-name-that-should-be-truncated-because-it-is-so-long/and-another-subdirectory/even-more-nesting/the-final-file-name-which-is-also-quite-long.ts",
		oldContent: "// long path test\n",
		newContent: "// long path test - updated\n",
		additions: 1,
		deletions: 0
	}
], a = {
	title: "Patterns/Diff/Diff Panel",
	component: e,
	parameters: { layout: "fullscreen" },
	decorators: [(e) => /* @__PURE__ */ r(n, {
		height: "100vh",
		width: "100vw",
		border: "1px solid",
		borderColor: "border.subtle",
		overflow: "hidden",
		children: /* @__PURE__ */ r(e, {})
	})]
}, o = {
	render: (t) => /* @__PURE__ */ r(e, { ...t }),
	args: { diffs: i }
}, s = {
	render: (t) => /* @__PURE__ */ r(e, { ...t }),
	args: { diffs: [i[0]] }
}, c = "import { useState } from \"react\";\nimport { Button } from \"@chakra-ui/react\";\n\ninterface User {\n  id: string;\n  name: string;\n  email: string;\n}\n\nconst formatName = (user: User) => {\n  return `${user.name} <${user.email}>`;\n};\n\nconst greetUser = (user: User) => {\n  return `Hello, ${user.name}!`;\n};\n\nexport const UserList = ({ users }: { users: User[] }) => {\n  const [selected, setSelected] = useState<string | null>(null);\n\n  return (\n    <div>\n      {users.map((user) => (\n        <Button key={user.id} onClick={() => setSelected(user.id)}>\n          {formatName(user)}\n        </Button>\n      ))}\n    </div>\n  );\n};\n", l = "import { useEffect, useState } from \"react\";\nimport { Button, Stack } from \"@chakra-ui/react\";\n\ninterface User {\n  id: string;\n  name: string;\n  email: string;\n  role: \"admin\" | \"user\";\n}\n\nconst formatName = (user: User) => {\n  return `${user.name} <${user.email}>`;\n};\n\nconst greetUser = (user: User) => {\n  return `Hello, ${user.name}!`;\n};\n\nexport const UserList = ({ users }: { users: User[] }) => {\n  const [selected, setSelected] = useState<string | null>(null);\n  const admins = users.filter((user) => user.role === \"admin\");\n\n  useEffect(() => {\n    if (!selected && admins[0]) setSelected(admins[0].id);\n  }, [admins, selected]);\n\n  return (\n    <Stack gap=\"2\">\n      {users.map((user) => (\n        <Button key={user.id} onClick={() => setSelected(user.id)}>\n          {formatName(user)}\n        </Button>\n      ))}\n    </Stack>\n  );\n};\n", u = "export const defaultConfig = {\n  appName: \"Prompt Studio\",\n  version: \"1.0.0\",\n  features: {\n    chat: true,\n    workspaces: true,\n    snippets: false,\n  },\n  limits: {\n    maxTokens: 4096,\n    maxAttachments: 5,\n  },\n  theme: {\n    mode: \"light\",\n    accent: \"blue\",\n  },\n};\n", d = "export const defaultConfig = {\n  appName: \"Prompt Studio\",\n  version: \"1.1.0\",\n  features: {\n    chat: true,\n    workspaces: true,\n    snippets: true,\n    diffViewer: true,\n  },\n  limits: {\n    maxTokens: 8192,\n    maxAttachments: 10,\n  },\n  theme: {\n    mode: \"dark\",\n    accent: \"violet\",\n  },\n};\n", f = {
	render: (t) => /* @__PURE__ */ r(e, { ...t }),
	args: { diffs: [{
		change: "modified",
		oldPath: "src/features/users/UserList.tsx",
		newPath: "src/features/users/UserList.tsx",
		oldContent: c,
		newContent: l,
		additions: 7,
		deletions: 3
	}] }
}, p = {
	render: (t) => /* @__PURE__ */ r(e, { ...t }),
	args: { diffs: [{
		change: "modified",
		oldPath: "src/features/users/UserList.tsx",
		newPath: "src/features/users/UserList.tsx",
		oldContent: c,
		newContent: l,
		additions: 7,
		deletions: 3
	}, {
		change: "modified",
		oldPath: "src/config/defaults.ts",
		newPath: "src/config/defaults.ts",
		oldContent: u,
		newContent: d,
		additions: 5,
		deletions: 4
	}] }
}, m = Array.from({ length: t + 1 }, (e, t) => `export const value${t + 1} = ${t + 1};`), h = {
	render: (t) => /* @__PURE__ */ r(e, { ...t }),
	args: { diffs: [{
		change: "added",
		newPath: "src/generated/large-fixture.ts",
		oldContent: "",
		newContent: m.join("\n"),
		additions: m.length,
		deletions: 0
	}] }
}, g = {
	render: (t) => /* @__PURE__ */ r(e, { ...t }),
	args: { diffs: [{
		change: "modified",
		oldPath: "src/lazy-file.ts",
		newPath: "src/lazy-file.ts",
		additions: 1,
		deletions: 1
	}] }
}, _ = {
	render: (t) => /* @__PURE__ */ r(e, { ...t }),
	args: { diffs: Array.from({ length: 30 }, (e, t) => {
		let n = t % 3;
		return n === 0 ? {
			change: "modified",
			oldPath: `src/features/users/UserList${t}.tsx`,
			newPath: `src/features/users/UserList${t}.tsx`,
			oldContent: c,
			newContent: l,
			additions: 7,
			deletions: 3
		} : n === 1 ? {
			change: "modified",
			oldPath: `src/config/defaults${t}.ts`,
			newPath: `src/config/defaults${t}.ts`,
			oldContent: u,
			newContent: d,
			additions: 5,
			deletions: 4
		} : {
			change: "added",
			newPath: `src/generated/snippet${t}.ts`,
			oldContent: "",
			newContent: `export const value${t} = ${t};\n`,
			additions: 1,
			deletions: 0
		};
	}) }
}, v = {
	render: (t) => /* @__PURE__ */ r(e, { ...t }),
	args: {
		diffViewMode: "split",
		diffs: [{
			change: "modified",
			oldPath: "src/features/users/UserList.tsx",
			newPath: "src/features/users/UserList.tsx",
			oldContent: c,
			newContent: l,
			additions: 7,
			deletions: 3
		}, {
			change: "modified",
			oldPath: "src/config/defaults.ts",
			newPath: "src/config/defaults.ts",
			oldContent: u,
			newContent: d,
			additions: 5,
			deletions: 4
		}]
	}
};
export { o as Default, h as LargeDiffPlaceholder, _ as ManyFilesScrolling, p as MultipleFilesWithContext, g as NotLoaded, f as ScatteredChanges, s as SingleFile, v as SplitMode, a as default };
