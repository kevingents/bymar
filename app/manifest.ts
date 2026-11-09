import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Huisraad",
    short_name: "Huisraad",
    description: "Bedenk, ontwerp en maak je interieur.",
    start_url: "/projecten",
    display: "standalone",
    background_color: "#f6f2ec",
    theme_color: "#f6f2ec",
    lang: "nl",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
