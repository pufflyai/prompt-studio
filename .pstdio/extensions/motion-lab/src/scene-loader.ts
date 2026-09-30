import * as Chakra from "@chakra-ui/react";
import * as Ui from "@pstdio/ui";
import * as ChatUi from "@pstdio/ui/chat-ui";
import * as Icons from "lucide-react";
import * as React from "react";
import * as Jsx from "react/jsx-runtime";
import * as Remotion from "remotion";
import * as Kit from "./kit";

Object.assign(globalThis, {
  __motionLabShared: {
    react: React,
    "react/jsx-runtime": Jsx,
    remotion: Remotion,
    "@chakra-ui/react": Chakra,
    "@pstdio/ui": Ui,
    "@pstdio/ui/chat-ui": ChatUi,
    "lucide-react": Icons,
    "motion-lab/kit": Kit,
  },
});
export const loadScene = async (code: string) => {
  const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  try {
    const module = await import(/* @vite-ignore */ url);
    if (typeof module.default !== "function") throw new Error("scene.tsx must default-export a React component");
    return module.default as React.ComponentType<Kit.SceneProps>;
  } finally {
    URL.revokeObjectURL(url);
  }
};
