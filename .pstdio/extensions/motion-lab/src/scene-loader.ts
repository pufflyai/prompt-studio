import * as Chakra from "@chakra-ui/react";
import * as Ui from "@pstdio/ui";
import * as ChatUi from "@pstdio/ui/chat-ui";
import * as Icons from "lucide-react";
import * as React from "react";
import * as Jsx from "react/jsx-runtime";
import * as Remotion from "remotion";
import * as Kit from "./kit";
import { type SharedSpecifier, sharedImportPrefix } from "./shared-modules";

const sharedModules: Record<SharedSpecifier, object> = {
  react: React,
  "react/jsx-runtime": Jsx,
  remotion: Remotion,
  "@chakra-ui/react": Chakra,
  "@pstdio/ui": Ui,
  "@pstdio/ui/chat-ui": ChatUi,
  "lucide-react": Icons,
  "motion-lab/kit": Kit,
};
Object.assign(globalThis, { __motionLabShared: sharedModules });

// Blob modules cannot import this bundle's modules directly, so each shared
// library gets a blob module that re-exports it from the global above.
const sharedModuleUrls = new Map(
  Object.entries(sharedModules).map(([specifier, module]) => {
    const names = Object.keys(module).filter((name) => name !== "default");
    const source = [
      `const m = globalThis.__motionLabShared[${JSON.stringify(specifier)}];`,
      "export default m.default ?? m;",
      ...names.map((name, index) => `const e${index} = m[${JSON.stringify(name)}];`),
      `export { ${names.map((name, index) => `e${index} as ${JSON.stringify(name)}`).join(", ")} };`,
    ].join("\n");
    return [specifier, URL.createObjectURL(new Blob([source], { type: "text/javascript" }))];
  }),
);
const sharedImport = new RegExp(`"${sharedImportPrefix}([^"]+)"`, "g");

export const loadScene = async (code: string) => {
  const linked = code.replace(sharedImport, (_, specifier: string) => JSON.stringify(sharedModuleUrls.get(specifier)));
  const url = URL.createObjectURL(new Blob([linked], { type: "text/javascript" }));
  try {
    const module = await import(/* @vite-ignore */ url);
    if (typeof module.default !== "function") throw new Error("scene.tsx must default-export a React component");
    return module.default as React.ComponentType<Kit.SceneProps>;
  } finally {
    URL.revokeObjectURL(url);
  }
};
