import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Workout Buddy",
    short_name: "Workout Buddy",
    description: "Il tuo diario di allenamento: schede, sessioni e progressi.",
    lang: "it",
    start_url: "/",
    scope: "/",
    display: "fullscreen",
    background_color: "#090c0d",
    theme_color: "#090c0d",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
