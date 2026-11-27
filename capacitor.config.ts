import type { CapacitorConfig } from "@capacitor/cli";

// iOS app shell for WealthFlow. The app loads the live site, so every web
// deploy reaches the phone without a new IPA. dist/ is bundled as a fallback
// copy of the web assets.
const config: CapacitorConfig = {
  appId: "com.swiftlk.wealthflow",
  appName: "WealthFlow",
  webDir: "dist",
  server: {
    url: "https://wealthflow.shehandsandeep.workers.dev",
    cleartext: false,
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#0b1220",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    StatusBar: { overlaysWebView: true, style: "DARK" },
  },
};

export default config;
