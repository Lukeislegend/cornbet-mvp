import { createBrowserRouter } from "react-router";
import { Login } from "./components/Login";
import { Welcome } from "./components/Welcome";
import { HowItWorks } from "./components/HowItWorks";
import { SuperBowlHub } from "./components/SuperBowlHub";
import { Results } from "./components/Results";
import { InvestmentHouse } from "./components/InvestmentHouse";
import { Performance } from "./components/Performance";
import { MyBets } from "./components/MyBets";
import { BracketView } from "./components/BracketView";
import { AdminResults } from "./components/AdminResults";
import { PlayWallet } from "./components/PlayWallet";
import { CornBank } from "./components/CornBank";

export const router = createBrowserRouter([
  { path: "/",                 Component: Login          },
  { path: "/welcome",          Component: Welcome        },
  { path: "/how-it-works",     Component: HowItWorks     },
  { path: "/hub",              Component: SuperBowlHub   },
  { path: "/results",          Component: Results        },
  { path: "/investment-house", Component: InvestmentHouse},
  { path: "/performance",      Component: Performance    },
  { path: "/my-bets",          Component: MyBets         },
  { path: "/bracket",          Component: BracketView    },
  { path: "/admin",            Component: AdminResults   },
  { path: "/wallet",           Component: PlayWallet     },
  { path: "/corn-bank",        Component: CornBank       },
]);