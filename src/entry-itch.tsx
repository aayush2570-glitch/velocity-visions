// Standalone client-only entry point for the itch.io static build.
// Bypasses TanStack Start's server/SSR/prerender pipeline entirely —
// this is a plain client-side mount of the same router used by the
// normal app, so it needs no server at runtime and builds to plain
// static files that any static host (including itch.io) can serve.
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import "./styles.css";
import { getRouter } from "./router";

const router = getRouter();

const rootElement = document.getElementById("root")!;
ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
