interface IconMarkProps {
  size: number;
  radius: number;
}

// The brand mark: a black rounded square with the Prompt Studio ring cut in white.
export const IconMark = (props: IconMarkProps) => {
  const { size, radius } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Prompt Studio</title>
      <rect width="26" height="26" rx={(radius / size) * 26} fill="#0A0D15" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15 11C15 13.7614 12.7614 16 10 16C7.23858 16 5 13.7614 5 11C5 8.23858 7.23858 6 10 6C12.7614 6 15 8.23858 15 11ZM13 11C13 12.6569 11.6569 14 10 14C8.34315 14 7 12.6569 7 11C7 9.34315 8.34315 8 10 8C11.6569 8 13 9.34315 13 11Z"
        fill="#FFFFFF"
      />
    </svg>
  );
};
