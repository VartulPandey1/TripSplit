export const BUDGET_CATEGORIES = [
  'Stay',
  'Transport',
  'Food & Dining',
  'Activities',
  'Shopping',
  'Misc',
] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];
export type ExpenseCategory = BudgetCategory | 'Settlement';

export function detectExpenseCategory(description: string, explicitCategory?: string): ExpenseCategory {
  if (explicitCategory === 'Settlement') {
    return 'Settlement';
  }

  if (explicitCategory && BUDGET_CATEGORIES.includes(explicitCategory as BudgetCategory)) {
    return explicitCategory as BudgetCategory;
  }

  const text = (description || '').toLowerCase();

  if (/settlement|settle up|reimbursement|debt payment|settled balance/.test(text)) {
    return 'Settlement';
  }

  if (/hotel|villa|airbnb|resort|hostel|stay|room|booking|lodge|inn/.test(text)) {
    return 'Stay';
  }
  if (/flight|flight|plane|ticket|taxi|cab|uber|grab|car|gas|fuel|train|bus|scooter|metro|toll|parking/.test(text)) {
    return 'Transport';
  }
  if (/dinner|lunch|breakfast|food|drink|drinks|bar|cafe|coffee|restaurant|groceries|snack|beer|wine|meal|brunch/.test(text)) {
    return 'Food & Dining';
  }
  if (/tour|scuba|diving|museum|surf|entry|ticket|activity|hike|boat|cruise|park|excursion|spa/.test(text)) {
    return 'Activities';
  }
  if (/shop|gift|souvenir|market|clothes|store/.test(text)) {
    return 'Shopping';
  }

  return 'Misc';
}
