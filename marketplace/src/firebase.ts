import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(__dirname, "..", "serviceAccountKey.json");

let db: Firestore | null = null;

if (existsSync(keyPath)) {
  try {
    const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8")) as ServiceAccount;
    const app = initializeApp({ credential: cert(serviceAccount) });
    db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });
    console.log("[Firebase] Initialized successfully.");
  } catch (err: any) {
    console.warn(`[Firebase] Init failed: ${err.message}. Using in-memory store.`);
  }
} else {
  console.warn("[Firebase] No serviceAccountKey.json found. Using in-memory store.");
}

export { db };
