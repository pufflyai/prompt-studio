const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

/** A post's publication day, such as "October 5, 2026". */
export const PostDate = (props: { published: string }) => {
  const { published } = props;
  return <time dateTime={published}>{DATE_FORMAT.format(new Date(published))}</time>;
};
