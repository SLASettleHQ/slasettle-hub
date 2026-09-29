import { defineConfig } from "vitepress";

export default defineConfig({
  title: "SLASettle",
  description: "Documentation for SLASettle: Soroban contracts, watcher, indexer, SDK, and frontend.",
  lastUpdated: false,
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "Introduction", link: "/introduction" },
      { text: "How it works", link: "/how-it-works" },
      { text: "Contracts", link: "/contracts" },
      { text: "Developer setup", link: "/developer-setup" },
      { text: "API", link: "/api" },
    ],
    sidebar: [
      {
        text: "Overview",
        items: [
          { text: "Introduction", link: "/introduction" },
          { text: "Problem", link: "/problem" },
          { text: "How SLASettle works", link: "/how-it-works" },
          { text: "Architecture", link: "/architecture" },
          { text: "Lifecycle", link: "/lifecycle" },
          { text: "Economics", link: "/economics" },
        ],
      },
      {
        text: "Contracts and deployment",
        items: [
          { text: "Contract reference", link: "/contracts" },
          { text: "Current Testnet deployment", link: "/testnet-deployment" },
        ],
      },
      {
        text: "Using SLASettle",
        items: [{ text: "End-user guide", link: "/end-user-guide" }],
      },
      {
        text: "Building SLASettle",
        items: [
          { text: "Developer setup", link: "/developer-setup" },
          { text: "Environment variables", link: "/environment-variables" },
          { text: "SDK", link: "/sdk" },
          { text: "Indexer API", link: "/api" },
          { text: "Testing", link: "/testing" },
          { text: "Contributing", link: "/contributing" },
        ],
      },
      {
        text: "Trust and status",
        items: [
          { text: "Security", link: "/security" },
          { text: "Limitations", link: "/limitations" },
          { text: "Deployment topology", link: "/deployment-topology" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/SLASettleHQ/slasettle-hub" }],
    search: { provider: "local" },
  },
});
