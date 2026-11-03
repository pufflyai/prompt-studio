import { type RefObject, useEffect } from "react";
import type { FileEditController } from "./file-renderer-edit-state";

export const useFlushFileOnHide = (manualSave: boolean, controller: RefObject<FileEditController | null>) => {
  useEffect(() => {
    if (manualSave) return;
    const flush = () => controller.current?.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [manualSave, controller]);
};
