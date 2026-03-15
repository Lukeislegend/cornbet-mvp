Refactor betting logic to enforce a strict 3-bet limit and unlock simulation properly.

Ensure the following state variables exist and are functional:

PlayWallet = 100
InvestmentHouse = 0
BetCount = 0
PlacedBets = []

BET SLIP LOGIC UPDATE

When “Place Bet” is tapped:

IF BetCount < 3:

Deduct stake from PlayWallet

Add bet object to PlacedBets array

Increment BetCount by 1

Close bet sheet

IF BetCount == 3:

Disable all betting line taps

Disable Place Bet button

Show persistent button on Super Bowl Hub:
“Simulate Game Results”

Ensure Place Bet button becomes inactive (50% opacity and non-clickable) once BetCount reaches 3.

SIMULATE BUTTON LOGIC

The “Simulate Game Results” button should:

Only be visible when BetCount == 3

On tap:
→ Resolve all bets in PlacedBets
→ Update PlayWallet and InvestmentHouse
→ Navigate to Results Screen
→ Lock betting until reset

Ensure the navigation is explicitly wired, not conditional only on visual state.

RESULT LOCK

After simulation:

Reset BetCount to 0

Clear PlacedBets array

Keep updated wallet balances

Allow new betting session

VISUAL FEEDBACK

When BetCount reaches 3:
Animate:

Betting cards slightly dim

Simulate button fades in with violet glow

No automatic navigation.
User must press Simulate.

This ensures:

• Exactly 3 bets per cycle
• No infinite betting
• Clear progression
• Simulation always fires