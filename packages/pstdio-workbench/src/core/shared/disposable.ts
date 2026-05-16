export interface Disposable {
  dispose(): void;
}

export const createDisposable = (onDispose: () => void): Disposable => {
  let disposed = false;

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      onDispose();
    },
  };
};
