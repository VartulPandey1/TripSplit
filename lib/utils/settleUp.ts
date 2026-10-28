/**
 * Debt calculation algorithms:
 * 1. Simplified: Minimum set of transactions to settle all group debts using net balances.
 * 2. Pairwise (Unsimplified): Direct bilateral settlements between each pair of travelers.
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

/**
 * Direct bilateral (pairwise/unsimplified) settlement calculation.
 * Computes direct who-paid-for-whom balances without multi-party debt transitive simplification.
 */
export function calculatePairwiseSettlements(
  expenses: any[],
  allMemberIds: string[] = []
): Transaction[] {
  // Map of A -> B -> amount A owes B
  const pairwiseDebt: Record<string, Record<string, number>> = {};

  const ensureEntry = (from: string, to: string) => {
    if (!pairwiseDebt[from]) pairwiseDebt[from] = {};
    if (typeof pairwiseDebt[from][to] !== 'number') pairwiseDebt[from][to] = 0;
  };

  expenses.forEach((e) => {
    // Skip personal expenses
    if (e.isPersonal || e.splitType === 'personal') return;

    const payerId = e.paidBy?._id ? e.paidBy._id.toString() : e.paidBy?.toString();
    if (!payerId) return;

    const totalAmount = Number(e.amount) || 0;
    if (totalAmount <= 0) return;

    // IF SETTLEMENT: Debtor paid Creditor, so Debtor's debt to Creditor is directly reduced
    if (e.category === 'Settlement') {
      const rawRecipient = (Array.isArray(e.includedMembers) && e.includedMembers[0])
        ? e.includedMembers[0]
        : (e.splitDetails?.[0]?.userId);
      const recipientId = rawRecipient?._id ? rawRecipient._id.toString() : rawRecipient?.toString();
      if (payerId && recipientId) {
        ensureEntry(payerId, recipientId);
        pairwiseDebt[payerId][recipientId] -= totalAmount;
      }
      return;
    }

    if (
      (e.splitType === 'exact' || e.splitType === 'percentage') &&
      Array.isArray(e.splitDetails) &&
      e.splitDetails.length > 0
    ) {
      e.splitDetails.forEach((detail: any) => {
        const uId = detail.userId?._id ? detail.userId._id.toString() : detail.userId?.toString();
        if (!uId || uId === payerId) return;
        const owed = Number(detail.amountOwed) || 0;
        if (owed > 0) {
          ensureEntry(uId, payerId);
          pairwiseDebt[uId][payerId] += owed;
        }
      });
    } else {
      // Equal split
      const rawIncluded = Array.isArray(e.includedMembers) && e.includedMembers.length > 0
        ? e.includedMembers
        : allMemberIds;
      const included = rawIncluded.map((m: any) => (m?._id ? m._id.toString() : m.toString()));

      if (included.length > 0) {
        const share = totalAmount / included.length;
        included.forEach((uId: string) => {
          if (!uId || uId === payerId) return;
          ensureEntry(uId, payerId);
          pairwiseDebt[uId][payerId] += share;
        });
      }
    }
  });

  // Calculate net bilateral debt between every unique pair (A, B)
  const processedPairs = new Set<string>();
  const transactions: Transaction[] = [];

  const allInvolvedUsers = new Set<string>([
    ...allMemberIds,
    ...Object.keys(pairwiseDebt),
  ]);

  const userList = Array.from(allInvolvedUsers);

  for (let i = 0; i < userList.length; i++) {
    for (let j = i + 1; j < userList.length; j++) {
      const u1 = userList[i];
      const u2 = userList[j];
      const pairKey = u1 < u2 ? `${u1}-${u2}` : `${u2}-${u1}`;
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const u1OwesU2 = pairwiseDebt[u1]?.[u2] || 0;
      const u2OwesU1 = pairwiseDebt[u2]?.[u1] || 0;

      const net = Math.round((u1OwesU2 - u2OwesU1) * 100) / 100;

      if (net > 0.01) {
        transactions.push({ from: u1, to: u2, amount: net });
      } else if (net < -0.01) {
        transactions.push({ from: u2, to: u1, amount: Math.abs(net) });
      }
    }
  }

  // Sort descending by amount for clean hierarchy
  return transactions.sort((a, b) => b.amount - a.amount);
}

