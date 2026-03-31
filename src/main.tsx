import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { initializeFromSupabase } from "@/lib/artistStore";
import "./index.css";

// Clear service worker cache on all devices
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

// Load artist bootstrap data from Supabase (async, non-blocking)
initializeFromSupabase().catch((err) =>
  console.error("Supabase initialization failed:", err)
);

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
