/**
 * Debt simplification algorithm.
 * Given a map of userId -> net balance (positive = owed money, negative = owes money),
 * returns the minimum set of transactions to settle all debts.
 */
export interface Transaction {
  from: string;
  to: string;
  amount: number;
}

export function calculateSettlements(balances: Record<string, number>): Transaction[] {
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [id, balance] of Object.entries(balances)) {
    if (balance > 0.01) creditors.push({ id, amount: balance });
    else if (balance < -0.01) debtors.push({ id, amount: -balance });
  }

  const transactions: Transaction[] = [];

  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    const amount = Math.min(credit.amount, debt.amount);

    transactions.push({ from: debt.id, to: credit.id, amount: Math.round(amount * 100) / 100 });

    credit.amount -= amount;
    debt.amount -= amount;

    if (credit.amount < 0.01) ci++;
    if (debt.amount < 0.01) di++;
  }

  return transactions;
}
