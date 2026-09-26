// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Only when the itch.io CI build sets NITRO_PRESET=static: also enable
// TanStack Start's SPA mode, which prerenders a proper static "_shell.html"
// for the app. The normal Cloudflare deploy build is unaffected.
const isItchBuild = process.env.NITRO_PRESET === "static";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(isItchBuild ? { spa: { enabled: true } } : {}),
  },
  vite: {
    plugins: [
      {
        // The dev-only devtools transform injects data-tsd-source into every JSX
        // element, including react-three-fiber intrinsics (mesh, group, ...). R3F
        // warns on mount but throws on prop updates (e.g. switching tracks),
        // crashing the scene. Strip the attribute after injection.
        name: "strip-tsd-source",
        enforce: "post",
        transform(code, id) {
          if (!id.includes("/src/") || !code.includes("data-tsd-source")) return null;
          return code.replace(/ data-tsd-source="[^"]*"/g, "");
        },
      },
    ],
  },
});
