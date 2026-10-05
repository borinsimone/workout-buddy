export type IconName =
  | "calendar"
  | "history"
  | "settings"
  | "plus"
  | "back"
  | "play"
  | "check"
  | "weight"
  | "timer"
  | "copy"
  | "arrow"
  | "trash"
  | "download"
  | "upload"
  | "trophy";
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string> = {
    calendar:
      "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2M7 14h2m4 0h2m-8 4h2",
    history: "M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2",
    settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6",
    plus: "M12 5v14M5 12h14",
    back: "M19 12H5m6-6-6 6 6 6",
    play: "m8 4 12 8-12 8Z",
    check: "m5 12 4 4 10-10",
    weight: "m5 3 4 4m6 10 4 4M3 5l4-4 4 4-4 4Zm10 14 4-4 4 4-4 4ZM8 8l8 8",
    timer: "M9 2h6m-3 6v5l3 2M17 5l2-2M21 13a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    copy: "M8 8h13v13H8ZM16 4V2H2v14h2",
    arrow: "m9 5 7 7-7 7",
    trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
    download: "M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5",
    upload: "M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5",
    trophy:
      "M8 3h8v7a4 4 0 0 1-8 0ZM8 5H3v3a4 4 0 0 0 5 4m8-7h5v3a4 4 0 0 1-5 4m-4 2v6m-4 1h8",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
