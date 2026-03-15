Update the existing CornBet prototype to support full betting functionality.

Do NOT rebuild the project.
Extend the existing system and reuse current components.

Remove the simulation-based system and replace it with real bet tracking.

Remove Simulation

Delete or disable any feature called:

Simulate Results

Simulation Engine

Mock results generation

Games should now resolve based on real game results from the sports API.

Add a server function:

resolveGameResults()

This function should:

Fetch final scores from the sports data API.

Compare each bet selection against the final result.

Update bet status to:

pending
won
lost

If a bet loses:

move wager_amount to Group Bank

If a bet wins:

calculate payout and add to player Play Balance

Unlimited Bets

Remove the previous restriction of 3 bets.

Users should be able to place unlimited bets.

A user can place multiple bets on the same game.

Betting Markets

Support the following bet types:

Moneyline
Spread
Parlay
Futures

Remove player props entirely.

Parlays

Add a Parlay Bet Slip.

Users can select multiple games and combine them.

Parlay rules:

minimum 2 legs

maximum unlimited

calculate combined odds automatically

Example:

Leg 1
Duke ML

Leg 2
Kansas -4

Leg 3
UConn ML

The bet slip should show:

Combined Odds
Wager
Potential Payout

When submitted:

create a parlay record and store all legs.

Futures Betting

Add a Futures tab.

Allow users to bet on:

Tournament Champion
Final Four Teams
Conference Winners

Each futures bet should store:

team
market
odds
wager
status

Futures bets remain pending until tournament completion.

Group Bank Logic

Implement the shared bank system.

Starting values:

Player starting balance: $500

Group Bank starting value: $1000

Bet outcome logic:

If a player loses:

player balance decreases
group bank increases by wager

If a player wins:

player balance increases by payout
group bank remains unchanged

Leaderboard

Add a dynamic leaderboard showing:

Player name
Current balance

Sort by highest balance.

Game Resolution

Games should automatically update when final scores are available.

When a game finishes:

all related bets should be evaluated.

Update the UI to show:

Won
Lost
Pending

Bet History

Add a My Bets page.

Show:

Game
Selection
Odds
Wager
Status
Payout

Include filters:

All
Pending
Won
Lost

Important

Do NOT break the existing:

authentication
wallet display
games API integration

Only extend functionality.

UI Behavior

Keep the CornBet design system already created.

Maintain:

yellow theme
group bank card
leaderboard
bet slip interactions

End Goal

The prototype should now behave like a real sportsbook for a private group, with:

real bets
parlays
futures
group bank accounting
real result resolution

What should happen after you run it

The prototype should now allow:

placing unlimited bets
building parlays
betting futures
tracking bets in history
automatic results resolution