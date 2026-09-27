// Standalone client-only entry point for the itch.io static build.
// Mounts <RacingGame> directly with no router in the loop at all.
// itch.io loads the page as .../index.html (not "/"), so a router
// that only matches the "/" path would render a NotFound screen on
// first load (fixed by navigating "home", which is exactly what was
// happening). This is a single-screen game, so there's nothing to
// route between — just render it unconditionally.
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { RacingGame } from "@/components/RacingGame";

const rootElement = document.getElementById("root")!;
ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <RacingGame />
  </StrictMode>,
);
