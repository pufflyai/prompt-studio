export type RegisterFilePendingDraft = (pending: () => boolean, onRemoved: () => void) => () => void;

/** The mounted editor owns its draft; its binding signals removal without copying text. */
export const createFileRendererPendingDraft = () => {
  let active: { key: string; pending: () => boolean; onRemoved: () => void } | undefined;
  return {
    register(key: string, pending: () => boolean, onRemoved: () => void) {
      const registration = { key, pending, onRemoved };
      active = registration;
      return () => {
        if (active === registration) active = undefined;
      };
    },
    retainRemoved(key: string) {
      if (active?.key !== key || !active.pending()) return false;
      active.onRemoved();
      return true;
    },
  };
};
