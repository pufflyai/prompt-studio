export const reserveAccountBrowser = () => {
  const page = window.open("about:blank", "_blank");
  if (page) page.opener = null;
  let opened = false;
  return {
    show: (url: string) => {
      if (!page || page.closed || opened) return;
      page.location.href = url;
      opened = true;
    },
    closeUnused: () => {
      if (!opened) page?.close();
    },
  };
};
