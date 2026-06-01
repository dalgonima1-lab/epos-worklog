import { promises as fs } from "fs";
import path from "path";
import { getFirebaseDb, isFirebaseConfigured, formatFirestoreUserError } from "../firebaseAdmin";
import type { WeddingBudgetData } from "./types";

const DATA_PATH = path.join(process.cwd(), "data", "wedding-budget.json");
const CLOUD_COLLECTION = "wedding-budget";
const CLOUD_DOC = "main";

export const DEFAULT_WEDDING_DATA: WeddingBudgetData = {
  settings: {
    weddingDate: "2027-05-18",
    goalAmount: 80_000_000,
    groomName: "예비신랑",
    brideName: "예비신부",
  },
  entries: [],
  budgets: [],
};

function mergeWeddingData(parsed: Partial<WeddingBudgetData>): WeddingBudgetData {
  return {
    settings: { ...DEFAULT_WEDDING_DATA.settings, ...parsed.settings },
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
  };
}

async function readLocal(): Promise<WeddingBudgetData> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    return mergeWeddingData(JSON.parse(raw) as Partial<WeddingBudgetData>);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(DEFAULT_WEDDING_DATA, null, 2), "utf-8");
    return structuredClone(DEFAULT_WEDDING_DATA);
  }
}

async function writeLocal(data: WeddingBudgetData): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function getWeddingBudgetData(): Promise<WeddingBudgetData> {
  if (isFirebaseConfigured()) {
    try {
      const ref = getFirebaseDb().collection(CLOUD_COLLECTION).doc(CLOUD_DOC);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        await ref.set(DEFAULT_WEDDING_DATA);
        return structuredClone(DEFAULT_WEDDING_DATA);
      }
      return mergeWeddingData(snapshot.data() as Partial<WeddingBudgetData>);
    } catch (e) {
      throw new Error(formatFirestoreUserError(e));
    }
  }
  return readLocal();
}

export async function saveWeddingBudgetData(data: WeddingBudgetData): Promise<void> {
  const normalized = mergeWeddingData(data);
  if (isFirebaseConfigured()) {
    try {
      await getFirebaseDb().collection(CLOUD_COLLECTION).doc(CLOUD_DOC).set(normalized);
      return;
    } catch (e) {
      throw new Error(formatFirestoreUserError(e));
    }
  }
  await writeLocal(normalized);
}
