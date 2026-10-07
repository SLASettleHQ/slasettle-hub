import { defineConfig } from "vitepress";

export default defineConfig({
  title: "SLASettle",
  description: "Documentation for SLASettle: Soroban contracts, watcher, indexer, SDK, and frontend.",
  lastUpdated: false,
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "Getting Started", link: "/getting-started/overview" },
      { text: "Protocol", link: "/protocol/architecture" },
      { text: "Contracts", link: "/contracts/overview" },
      { text: "User Guides", link: "/users/provider-guide" },
      { text: "Developers", link: "/developers/local-setup" },
      { text: "Security", link: "/security/security-model" },
      { text: "Testnet", link: "/testnet-deployment" },
    ],
    sidebar: [
      {
        text: "Getting Started",
        collapsed: false,
        items: [
          { text: "Overview", link: "/getting-started/overview" },
          { text: "How It Works", link: "/getting-started/how-it-works" },
          { text: "Problem Statement", link: "/getting-started/problem" },
          { text: "Quick Start", link: "/getting-started/quick-start" },
        ],
      },
      {
        text: "Protocol",
        collapsed: false,
        items: [
          { text: "System Architecture", link: "/protocol/architecture" },
          { text: "SLA Lifecycle", link: "/protocol/lifecycle" },
          { text: "Trust Model", link: "/protocol/trust-model" },
          { text: "Economic Model", link: "/protocol/economics" },
          { text: "Watcher Topology", link: "/protocol/watcher-model" },
          { text: "Current Limitations", link: "/protocol/limitations" },
        ],
      },
      {
        text: "Contracts",
        collapsed: false,
        items: [
          { text: "Contract Overview", link: "/contracts/overview" },
          { text: "Watcher Registry", link: "/contracts/watcher-registry" },
          { text: "SLA Vault", link: "/contracts/sla-vault" },
          { text: "Events & Errors", link: "/contracts/events-and-errors" },
        ],
      },
      {
        text: "User Guides",
        collapsed: false,
        items: [
          { text: "Service Provider Guide", link: "/users/provider-guide" },
          { text: "Beneficiary Guide", link: "/users/beneficiary-guide" },
          { text: "Watcher Operator Guide", link: "/users/watcher-guide" },
          { text: "Public Status Page Guide", link: "/users/public-status-guide" },
        ],
      },
      {
        text: "Developers",
        collapsed: false,
        items: [
          { text: "Local Setup", link: "/developers/local-setup" },
          { text: "Environment Configuration", link: "/developers/environment" },
          { text: "SDK Reference", link: "/developers/sdk" },
          { text: "Indexer API", link: "/developers/indexer-api" },
          { text: "Watcher Daemon", link: "/developers/watcher-daemon" },
          { text: "Deployment Runbook", link: "/developers/deployment" },
          { text: "Testing & Verification", link: "/developers/testing" },
        ],
      },
      {
        text: "Security",
        collapsed: false,
        items: [
          { text: "Security Model", link: "/security/security-model" },
          { text: "Threat Model", link: "/security/threat-model" },
          { text: "Vulnerability Reporting", link: "/security/reporting" },
        ],
      },
      {
        text: "Reference & Community",
        collapsed: false,
        items: [
          { text: "Testnet Deployment", link: "/testnet-deployment" },
          { text: "Contributing Guide", link: "/contributing" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/SLASettleHQ/slasettle-hub" }],
    search: { provider: "local" },
  },
});
