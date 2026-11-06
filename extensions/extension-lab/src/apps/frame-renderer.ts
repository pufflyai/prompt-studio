export const createFrameRenderer = (
  draw: () => void,
  frames = {
    request: (callback: FrameRequestCallback) => window.requestAnimationFrame(callback),
    cancel: (id: number) => window.cancelAnimationFrame(id),
  },
) => {
  let pending: number | undefined;
  let disposed = false;
  return {
    render() {
      if (disposed || pending !== undefined) return;
      pending = frames.request(() => {
        pending = undefined;
        if (!disposed) draw();
      });
    },
    dispose() {
      disposed = true;
      if (pending !== undefined) frames.cancel(pending);
      pending = undefined;
    },
  };
};
