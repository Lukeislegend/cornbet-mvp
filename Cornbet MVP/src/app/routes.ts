import { createBrowserRouter } from "react-router";
import { Login } from "./components/Login";
import { Welcome } from "./components/Welcome";
import { HowItWorks } from "./components/HowItWorks";
import { Results } from "./components/Results";
import { MyBets } from "./components/MyBets";
import { PlayWallet } from "./components/PlayWallet";
import { CornBank } from "./components/CornBank";

// Heavy routes — lazy-loaded to reduce initial JS bundle
// React Router 7 handles the Suspense boundary automatically.

export const router = createBrowserRouter([
  // ── Lightweight routes (loaded eagerly) ────────────────────────────────────
  { path: "/",                 Component: Login        },
  { path: "/welcome",          Component: Welcome      },
  { path: "/how-it-works",     Component: HowItWorks   },
  { path: "/results",          Component: Results      },
  { path: "/my-bets",          Component: MyBets       },
  { path: "/wallet",           Component: PlayWallet   },
  { path: "/corn-bank",        Component: CornBank     },

  // ── Heavy routes (lazy-loaded) ─────────────────────────────────────────────
  {
    path: "/hub",
    lazy: () => import("./components/SuperBowlHub").then(m => ({ Component: m.SuperBowlHub })),
  },
  {
    path: "/bracket",
    lazy: () => import("./components/BracketView").then(m => ({ Component: m.BracketView })),
  },
  {
    path: "/investment-house",
    lazy: () => import("./components/InvestmentHouse").then(m => ({ Component: m.InvestmentHouse })),
  },
  {
    path: "/performance",
    lazy: () => import("./components/Performance").then(m => ({ Component: m.Performance })),
  },
  {
    path: "/admin",
    lazy: () => import("./components/AdminResults").then(m => ({ Component: m.AdminResults })),
  },
]);
