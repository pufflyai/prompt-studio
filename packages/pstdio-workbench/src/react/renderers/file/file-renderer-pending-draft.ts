export type RegisterFilePendingDraft = (pending: () => boolean) => () => void;

/** The mounted editor owns its draft; removal only reads its current pending state. */
export const createFileRendererPendingDraft = () => {
  let active: { key: string; pending: () => boolean } | undefined;
  return {
    register(key: string, pending: () => boolean) {
      const registration = { key, pending };
      active = registration;
      return () => {
        if (active === registration) active = undefined;
      };
    },
    hasPending: (key: string) => (active?.key === key ? active.pending() : false),
  };
};
