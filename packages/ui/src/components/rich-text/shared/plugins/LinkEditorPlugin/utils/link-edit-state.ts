export function shouldCancelLinkEdit(isLinkEditMode: boolean, isLink: boolean, linkUrl: string) {
  return isLinkEditMode && isLink && linkUrl === "";
}
