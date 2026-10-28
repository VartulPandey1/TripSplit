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

const CATEGORY_ALIAS_MAP: Record<string, BudgetCategory> = {
  Stay: 'Stay',
  'Hotel / Camp': 'Stay',
  'Stay & Hotel': 'Stay',
  Hotel: 'Stay',
  Camp: 'Stay',
  Lodging: 'Stay',
  Transport: 'Transport',
  'Fuel & Cab': 'Transport',
  'Transport / Fuel': 'Transport',
  Fuel: 'Transport',
  Cab: 'Transport',
  Transit: 'Transport',
  Flight: 'Transport',
  'Food & Dining': 'Food & Dining',
  'Food & Drinks': 'Food & Dining',
  Food: 'Food & Dining',
  Dining: 'Food & Dining',
  Groceries: 'Food & Dining',
  'Coffee & Snacks': 'Food & Dining',
  Coffee: 'Food & Dining',
  Snacks: 'Food & Dining',
  Activities: 'Activities',
  Activity: 'Activities',
  Shopping: 'Shopping',
  Misc: 'Misc',
  'General / Misc': 'Misc',
  Other: 'Misc',
  Others: 'Misc',
  Solo: 'Shopping',
};

export function detectExpenseCategory(description: string, explicitCategory?: string): ExpenseCategory {
  if (explicitCategory === 'Settlement') {
    return 'Settlement';
  }

  if (explicitCategory) {
    if (CATEGORY_ALIAS_MAP[explicitCategory]) {
      return CATEGORY_ALIAS_MAP[explicitCategory];
    }
    if (BUDGET_CATEGORIES.includes(explicitCategory as BudgetCategory)) {
      return explicitCategory as BudgetCategory;
    }
  }

  const text = (description || '').toLowerCase();

  if (/settlement|settle up|reimbursement|debt payment|settled balance/.test(text)) {
    return 'Settlement';
  }

  if (/hotel|villa|airbnb|resort|hostel|stay|room|booking|lodge|inn|homestay|cottage|camp|camping/.test(text)) {
    return 'Stay';
  }
  if (/flight|airline|indigo|air india|plane|ticket|taxi|cab|uber|ola|rapido|grab|car|gas|petrol|diesel|fuel|train|bus|scooter|metro|toll|parking|auto/.test(text)) {
    return 'Transport';
  }
  if (/dinner|lunch|breakfast|food|drink|drinks|bar|cafe|coffee|starbucks|mcdonalds|kfc|dominos|pizza|chai|tea|restaurant|groceries|snack|snacks|beer|wine|meal|brunch|dessert|bakery/.test(text)) {
    return 'Food & Dining';
  }
  if (/tour|scuba|diving|museum|surf|entry|activity|activities|hike|trek|boat|cruise|park|excursion|spa|guide|safari|sightseeing/.test(text)) {
    return 'Activities';
  }
  if (/shop|shopping|gift|souvenir|market|mall|clothes|clothing|store|haul/.test(text)) {
    return 'Shopping';
  }

  return 'Misc';
}
