import { createFileRoute } from "@tanstack/react-router";
import { RacingGame } from "@/components/RacingGame";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Apex / Drive — Arcade Racing" },
      {
        name: "description",
        content: "Race five drivers across three scenic circuits in a 3D arcade racer.",
      },
      { property: "og:title", content: "Apex / Drive — Arcade Racing" },
      {
        property: "og:description",
        content: "Race five drivers across three scenic circuits in a 3D arcade racer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <RacingGame />;
}