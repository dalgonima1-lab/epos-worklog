export type WeddingPerson = "groom" | "bride";
export type WeddingEntryType = "income" | "expense" | "saving";

export interface WeddingSettings {
  weddingDate: string;
  goalAmount: number;
  groomName: string;
  brideName: string;
}

export interface WeddingEntry {
  id: string;
  date: string;
  person: WeddingPerson;
  type: WeddingEntryType;
  amount: number;
  category: string;
  memo: string;
}

export interface WeddingBudgetItem {
  id: string;
  name: string;
  expected: number;
  paid: number;
  memo: string;
}

export interface WeddingBudgetData {
  settings: WeddingSettings;
  entries: WeddingEntry[];
  budgets: WeddingBudgetItem[];
}
