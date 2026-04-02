import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { loadEnv } from "vite";

function getPackageChunkName(id: string) {
  const normalized = id.split("\\").join("/");
  const nodeModulesIndex = normalized.lastIndexOf("/node_modules/");

  if (nodeModulesIndex === -1) {
    return null;
  }

  const packagePath = normalized.slice(nodeModulesIndex + "/node_modules/".length);
  const packageName = packagePath.startsWith("@")
    ? packagePath.split("/").slice(0, 2).join("/")
    : packagePath.split("/")[0];

  return packageName.replace("@", "").replace("/", "-");
}

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, process.cwd(), "");

  return {
    define: {
      // Expose backend API URLs to the build
      "import.meta.env.VITE_SECURE_API_BASE_URL": JSON.stringify(
        env.VITE_SECURE_API_BASE_URL || env.VITE_API_BASE || ""
      ),
      "import.meta.env.VITE_PINATA_API_BASE_URL": JSON.stringify(
        env.VITE_PINATA_API_BASE_URL || ""
      ),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      // Force cache busting with content hashes
      assetsDir: "assets",
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return;
            }

            const packageName = getPackageChunkName(id);

            if (id.includes("/wagmi/") || id.includes("/viem/")) {
              return "web3-core";
            }

            if (id.includes("@supabase/")) {
              return "supabase";
            }

            if (id.includes("@tanstack/react-query")) {
              return "query";
            }

            if (id.includes("/epubjs/")) {
              return "ebook-reader";
            }

            if (id.includes("@radix-ui/")) {
              return "radix";
            }

            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/react-router/") ||
              id.includes("/scheduler/")
            ) {
              return "react-core";
            }

            if (id.includes("/lucide-react/")) {
              return "icons";
            }

            return packageName ? `pkg-${packageName}` : "vendor";
          },
          entryFileNames: "[name]-[hash].js",
          chunkFileNames: "[name]-[hash].js",
          assetFileNames: "[name]-[hash][extname]",
        },
      },
    },
  };
});
