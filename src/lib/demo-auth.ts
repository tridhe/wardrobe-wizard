const DEMO_AUTH_KEY = "wardrobe-wizard-demo-auth";
const DEMO_AUTH_EVENT = "wardrobe-wizard-demo-auth-change";

export function isDemoAuthenticated() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DEMO_AUTH_KEY) === "true";
}

export function signInDemo() {
  window.localStorage.setItem(DEMO_AUTH_KEY, "true");
  window.dispatchEvent(new Event(DEMO_AUTH_EVENT));
}

export function signOutDemo() {
  window.localStorage.removeItem(DEMO_AUTH_KEY);
  window.dispatchEvent(new Event(DEMO_AUTH_EVENT));
}

export function onDemoAuthChange(callback: () => void) {
  window.addEventListener(DEMO_AUTH_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(DEMO_AUTH_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
