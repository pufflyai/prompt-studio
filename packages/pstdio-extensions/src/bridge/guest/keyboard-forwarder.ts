export const installGuestKeyboardForwarder = (
  target: Pick<EventTarget, "addEventListener">,
  dispatch: (event: KeyboardEventInit) => Promise<unknown>,
  isEditable: (target: EventTarget | null) => boolean,
) => {
  const forward = (event: KeyboardEvent) =>
    dispatch({
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      repeat: event.repeat,
    }).catch(() => {});
  target.addEventListener(
    "keydown",
    ((event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) return;
      if (isEditable(event.target) && !event.shiftKey) return;
      void forward(event);
    }) as EventListener,
    true,
  );
  target.addEventListener("keydown", ((event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.ctrlKey || event.metaKey || event.altKey) return;
    // Later document/window listeners may still consume a menu's Escape.
    setTimeout(() => {
      if (!event.defaultPrevented) void forward(event);
    }, 0);
  }) as EventListener);
};
