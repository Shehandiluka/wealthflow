import type { CapacitorConfig } from "@capacitor/cli";

// iOS app for WealthFlow. The whole app (dist/) is bundled inside the IPA and
// runs from the phone itself — it does not load the website. It talks to the
// same Supabase backend, so data is shared with the web version.
const config: CapacitorConfig = {
  appId: "com.swiftlk.wealthflow",
  appName: "WealthFlow",
  webDir: "dist",
  ios: {
    contentInset: "never",
    backgroundColor: "#0b1220",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    StatusBar: { overlaysWebView: true, style: "DARK" },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1200,
      backgroundColor: "#0b1220",
      showSpinner: false,
    },
  },
};

export default config;
