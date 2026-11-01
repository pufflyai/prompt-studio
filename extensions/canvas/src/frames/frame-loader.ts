import { frameBootstrap } from "@pstdio/canvas";
import { createContext } from "react";
import type { FrameLoader } from "./asset-loader";

// The UI Canvas view provides a loader that reads the project's build. Inside a frame, as when a
// canvas shows UI Canvas itself, frames ask their own host through the package's bridge instead.
export const FrameLoaderContext = createContext<FrameLoader>((source) => frameBootstrap(source));
