// Separate, minimal Vite config used ONLY for the itch.io CI build.
// Deliberately does NOT include the tanstackStart() or nitro plugins
// from the main vite.config.ts — this is a plain client-side React
// SPA build with no server, no SSR, no prerendering. It reuses the
// same router/routes/components as the main app, just mounted
// directly into index.html at the repo root instead of through
// TanStack Start's server-rendered shell.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: "dist-itch",
  },
});
