import { Capacitor } from "@capacitor/core";

/** True inside the iOS app (the bundled build), false in a normal browser. */
export const isNativeApp = Capacitor.isNativePlatform();

/** Public address of the web app — used for e-mail links, which must open a real site. */
export const WEB_ORIGIN = isNativeApp
  ? "https://wealthflow.shehandsandeep.workers.dev"
  : window.location.origin;

/** Native setup for the iOS app: status bar style and hiding the launch screen. */
export async function initNativeApp() {
  if (!isNativeApp) return;
  document.documentElement.classList.add("native-app");
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    const light = document.documentElement.classList.contains("light");
    await StatusBar.setStyle({ style: light ? Style.Light : Style.Dark });
  } catch (_) { /* plugin unavailable */ }
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch (_) { /* plugin unavailable */ }
}
