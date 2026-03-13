import Footer from "./footer";
import { RootProvider } from "./root-provider";

export const MarkdownFooter = () => {
  return (
    <RootProvider>
      <Footer
        links={[
          { item: "GitHub", url: "https://github.com/pufflyai/prompt-studio" },
          { item: "Discord", url: "https://discord.gg/PYjnYVgR" },
          { item: "Privacy Policy", url: "/privacy-policy/" },
          { item: "Terms", url: "/terms/" },
        ]}
      />
    </RootProvider>
  );
};
