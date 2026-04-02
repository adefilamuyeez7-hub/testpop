import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { initializeFromSupabase } from "@/lib/artistStore";
import "./index.css";

// Register a minimal service worker so mobile browsers can offer install-to-homescreen behavior.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
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
