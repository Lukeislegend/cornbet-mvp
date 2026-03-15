Extend the existing PackBet iPhone 15 prototype.

Maintain the established plum background (#120A1F), card surface (#1A1328), and gloss gradient CTA style.

Add state variables to simulate balances and betting logic:

Initial State:
Play Wallet = $100
Investment House = $0
Bet Count = 0

Use interactive prototype variables to simulate balance updates.

GLOBAL ADDITION — WALLET STATE BAR

At the top of all screens after Welcome, add a persistent horizontal wallet bar.

Left side:
Play Wallet balance (teal accent)
Label: “Play”
Initial: $100

Right side:
Investment House balance (violet accent)
Label: “Investment”
Initial: $0

Use subtle glow edges matching their accent colors.
Keep it minimal and premium.

SCREEN — SUPER BOWL HUB

Title:
Super Bowl XLIX
Seahawks vs Patriots

Add realistic pregame odds:

Moneyline:
Seahawks +100
Patriots -120

Spread:
Seahawks +1 (-110)
Patriots -1 (-110)

Over/Under:
47.5 points (-110 both sides)

Use stacked betting cards.

Each line should be tappable.

When tapped:
Open a bottom-sheet Bet Slip.

BET SLIP

Fields:
Selected bet type
Odds
Stake input (default $10, editable)

“Place Bet” button (gradient gloss style)

On Place Bet:

Deduct stake from Play Wallet

Add bet object to placed bets list

Increase Bet Count by 1

Close sheet

Do NOT resolve outcome yet.

Display small counter somewhere:
“Bets Placed: X / 3”

SIMULATE LOGIC

When Bet Count reaches 3:
Reveal button:
“Simulate Game Results”

Button style:
Violet glow, slightly dramatic.

When tapped:
Navigate to Results Screen.

RESULTS SCREEN

Use real game result:

Final Score:
Patriots 28
Seahawks 24

Under 47.5 = WIN (total 52 → Over wins)
Moneyline Patriots = WIN
Spread Patriots -1 = WIN

Resolve each placed bet correctly based on selection.

Logic:

If bet wins:
Return stake + profit to Play Wallet.

If bet loses:
Add stake to Investment House.

Animate:
Winning bets glow teal briefly.
Losing bets fade pink → violet and move to Investment total.

After resolution:
Update wallet bar balances.

POST-RESULT MESSAGE

Display summary card:

If net positive:
“You won today.”

If net negative:
“Short-term variance. Long-term accumulation.”

Below summary:
Button:
“View Investment House”

INVESTMENT HOUSE SCREEN

Show:

Total Investment Balance (violet large text)

Bitcoin Conversion Preview:
Assume BTC price = $65,000

Projected BTC = Investment Balance / 65000

Display to 6 decimal places.

Example:
$130 → 0.002000 BTC

Text below:
“Losses convert every Monday at market price.”

Back button returns to Super Bowl Hub.

INTERACTION FEEL

Use smart animate 300ms.
Wallet numbers animate smoothly when changing.
Winning balance ticks upward.
Investment balance ticks upward for losses.

No chaotic motion.
Controlled premium transitions.