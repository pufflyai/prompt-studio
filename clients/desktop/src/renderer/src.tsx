import "@pstdio/ui/style.css";

// Give the packaged startup document a painted frame before initializing the theme and React.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    void import("./hydrate");
  });
});
