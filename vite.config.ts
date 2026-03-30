import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { loadEnv } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, process.cwd(), "");

  return {
    define: {
      // Expose VITE_SECURE_API_BASE_URL to the build
      "import.meta.env.VITE_SECURE_API_BASE_URL": JSON.stringify(
        env.VITE_SECURE_API_BASE_URL || env.VITE_API_BASE || ""
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
          entryFileNames: "[name]-[hash].js",
          chunkFileNames: "[name]-[hash].js",
          assetFileNames: "[name]-[hash][extname]",
        },
      },
    },
  };
});
