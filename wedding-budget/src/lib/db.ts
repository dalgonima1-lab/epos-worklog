import { promises as fs } from "fs";
import path from "path";
import { getFirebaseDb, isFirebaseConfigured, formatFirestoreUserError } from "./firebaseAdmin";
import type { WeddingBudgetData } from "./types";

const DATA_PATH = path.join(process.cwd(), "data", "store.json");
const CLOUD_COLLECTION = "couple-budget";
const CLOUD_DOC = "main";

export const DEFAULT_DATA: WeddingBudgetData = {
  settings: {
    weddingDate: "2027-05-18",
    goalAmount: 80_000_000,
    groomName: "예비신랑",
    brideName: "예비신부",
  },
  entries: [],
  budgets: [],
};

function mergeData(parsed: Partial<WeddingBudgetData>): WeddingBudgetData {
  return {
    settings: { ...DEFAULT_DATA.settings, ...parsed.settings },
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
  };
}

export async function getBudgetData(): Promise<WeddingBudgetData> {
  if (isFirebaseConfigured()) {
    try {
      const ref = getFirebaseDb().collection(CLOUD_COLLECTION).doc(CLOUD_DOC);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        await ref.set(DEFAULT_DATA);
        return structuredClone(DEFAULT_DATA);
      }
      return mergeData(snapshot.data() as Partial<WeddingBudgetData>);
    } catch (e) {
      throw new Error(formatFirestoreUserError(e));
    }
  }

  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    return mergeData(JSON.parse(raw) as Partial<WeddingBudgetData>);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(DEFAULT_DATA, null, 2), "utf-8");
    return structuredClone(DEFAULT_DATA);
  }
}

export async function saveBudgetData(data: WeddingBudgetData): Promise<void> {
  const normalized = mergeData(data);
  if (isFirebaseConfigured()) {
    try {
      await getFirebaseDb().collection(CLOUD_COLLECTION).doc(CLOUD_DOC).set(normalized);
      return;
    } catch (e) {
      throw new Error(formatFirestoreUserError(e));
    }
  }
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(normalized, null, 2), "utf-8");
}
