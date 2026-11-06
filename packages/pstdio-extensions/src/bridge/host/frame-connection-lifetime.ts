interface FrameConnection {
  close(): void;
}

/** StrictMode and retained views can release effects while the browsing context stays live. */
export const createFrameConnectionLifetime = (isCurrent: () => boolean) => {
  let connection: FrameConnection | undefined;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    connection?.close();
    connection = undefined;
  };
  return {
    attach(next: FrameConnection) {
      if (disposed || !isCurrent()) {
        dispose();
        next.close();
        return false;
      }
      connection = next;
      return true;
    },
    dispose,
    releaseIfDetached() {
      queueMicrotask(() => {
        if (!isCurrent()) dispose();
      });
    },
  };
};
