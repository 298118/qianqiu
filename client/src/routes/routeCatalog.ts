export type RouteSurface = "primary" | "session";

export type RouteCatalogEntry = {
  id: string;
  href: string;
  label: string;
  surface: RouteSurface;
};

const demoSessionId = "s74-preview";

export const routeCatalog: RouteCatalogEntry[] = [
  { id: "home", href: "/", label: "首页", surface: "primary" },
  { id: "game", href: `/game/${demoSessionId}`, label: "主卷", surface: "primary" },
  { id: "map", href: `/game/${demoSessionId}/map`, label: "舆图", surface: "primary" },
  { id: "people", href: `/game/${demoSessionId}/people`, label: "人物", surface: "primary" },
  { id: "inventory", href: `/game/${demoSessionId}/inventory`, label: "囊箧", surface: "primary" },
  { id: "archive", href: `/game/${demoSessionId}/archive`, label: "史册", surface: "primary" },
  { id: "exam", href: `/game/${demoSessionId}/exam`, label: "科举", surface: "session" },
  { id: "ranking", href: `/game/${demoSessionId}/ranking`, label: "皇榜", surface: "session" },
  { id: "court", href: `/game/${demoSessionId}/court`, label: "朝议", surface: "session" },
  { id: "settings", href: `/game/${demoSessionId}/settings`, label: "印匣", surface: "session" }
];
