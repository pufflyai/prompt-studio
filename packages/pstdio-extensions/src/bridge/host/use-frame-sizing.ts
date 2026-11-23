import { type RefObject, useEffect, useRef } from "react";
import type { HostApi, WebviewSizing } from "../contract";

/** Resizing a retained guest must never replace its browsing context. */
export const useFrameSizing = (
  sizing: WebviewSizing | undefined,
  initialized: RefObject<boolean>,
  remote: RefObject<Pick<HostApi, "sizingUpdate"> | null>,
) => {
  const current = useRef(sizing);
  current.current = sizing;
  useEffect(() => {
    if (initialized.current) remote.current?.sizingUpdate?.({ sizing });
  }, [sizing, initialized, remote]);
  return current;
};
