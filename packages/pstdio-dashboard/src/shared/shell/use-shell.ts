import { useEffect, useRef, useState } from "react";

/**
 * Owns a shell whose lifetime matches the mounted component, safely across
 * React StrictMode's mount → unmount → mount probe.
 *
 * The shell is created once and stays the same instance for the component's
 * whole life, so every render and every sibling effect always sees a live
 * shell — disposing and rebuilding it would leave those sibling effects holding
 * a disposed shell when StrictMode replays them.
 *
 * Disposal is deferred to a microtask and skipped while the component is still
 * mounted. StrictMode's probe unmounts then synchronously re-mounts, so the
 * re-mount restores `mounted` before the microtask runs and the shell survives.
 * A real unmount has no re-mount, so the microtask disposes the shell.
 */
export const useShell = <T extends { dispose: () => void }>(create: () => T) => {
  const [shell] = useState(create);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      queueMicrotask(() => {
        if (!mountedRef.current) shell.dispose();
      });
    };
  }, [shell]);

  return shell;
};
