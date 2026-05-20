import { createBrowserRouter, type RouteObject } from "react-router";
import { App } from "./App";
import { ArchivePage } from "./pages/ArchivePage";
import { CourtPage } from "./pages/CourtPage";
import { ErrorPage } from "./pages/ErrorPage";
import { ExamPage } from "./pages/ExamPage";
import { GamePage } from "./pages/GamePage";
import { HomePage } from "./pages/HomePage";
import { InventoryPage } from "./pages/InventoryPage";
import { MapPage } from "./pages/MapPage";
import { PeoplePage } from "./pages/PeoplePage";
import { RankingPage } from "./pages/RankingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "game/:sessionId",
        element: <GamePage />,
        children: [
          { path: "map", element: <MapPage /> },
          { path: "people", element: <PeoplePage /> },
          { path: "inventory", element: <InventoryPage /> },
          { path: "archive", element: <ArchivePage /> },
          { path: "exam", element: <ExamPage /> },
          { path: "ranking", element: <RankingPage /> },
          { path: "court", element: <CourtPage /> },
          { path: "settings", element: <SettingsPage /> }
        ]
      },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
];

export const router = createBrowserRouter(routes);
