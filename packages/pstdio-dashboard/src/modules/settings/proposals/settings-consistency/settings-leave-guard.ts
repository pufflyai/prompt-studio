interface SettingsDraft {
  title: string;
  dirty: boolean;
  save: () => void;
  reset: () => void;
}

export const createSettingsLeaveGuard = (showPrompt: (title: string | null) => void) => {
  let draft: SettingsDraft | undefined;
  let pending: (() => void) | undefined;
  const stay = () => {
    pending = undefined;
    showPrompt(null);
  };
  return {
    register(next: SettingsDraft) {
      draft = next;
      return () => {
        if (draft === next) draft = undefined;
      };
    },
    request(leave: () => void) {
      if (!draft?.dirty) return leave();
      pending = leave;
      showPrompt(draft.title);
    },
    stay,
    leave(save: boolean) {
      if (!pending) return;
      // A failed save must leave the confirmation and current page in place.
      if (save) draft?.save();
      else draft?.reset();
      const navigate = pending;
      draft = undefined;
      stay();
      navigate();
    },
  };
};
