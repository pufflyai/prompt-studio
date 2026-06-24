type Listener = () => void;

interface State {
  open: boolean;
}

const state: State = { open: false };
const listeners = new Set<Listener>();

const notify = () => {
  for (const listener of listeners) listener();
};

export const notificationsModalStore = {
  getState: () => state,
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  open: () => {
    if (state.open) return;
    state.open = true;
    notify();
  },
  close: () => {
    if (!state.open) return;
    state.open = false;
    notify();
  },
  toggle: () => {
    state.open = !state.open;
    notify();
  },
};
