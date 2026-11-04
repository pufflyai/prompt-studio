// Include presentation visibility so any framework can suspend work with visibilitychange.
export const createViewVisibility = (doc: Document) => {
  const read = (key: "hidden" | "visibilityState") => {
    let target: object | null = doc;
    while (target) {
      const getter = Object.getOwnPropertyDescriptor(target, key)?.get;
      if (getter) return () => getter.call(doc);
      target = Object.getPrototypeOf(target);
    }
    return () => (key === "hidden" ? false : "visible");
  };
  const browserHidden = read("hidden");
  const browserVisibility = read("visibilityState");
  let visible = true;
  Object.defineProperties(doc, {
    hidden: { configurable: true, get: () => !visible || browserHidden() },
    visibilityState: { configurable: true, get: () => (visible ? browserVisibility() : "hidden") },
  });
  return {
    setVisible(next: boolean) {
      const wasHidden = doc.hidden;
      visible = next;
      if (doc.hidden !== wasHidden) doc.dispatchEvent(new Event("visibilitychange"));
    },
  };
};
