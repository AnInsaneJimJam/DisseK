/**
 * Marketplace data store.
 * Tries Firestore for persistence. Falls back to in-memory if unavailable.
 */

import { db } from "./firebase.js";
import type { Host, DocumentListing, Purchase } from "./types.js";

let useFirestore = !!db;
let firestoreVerified = false;

async function ensureFirestore(): Promise<boolean> {
  if (!db) return false;
  if (firestoreVerified) return useFirestore;
  try {
    await db.collection("_ping").limit(1).get();
    firestoreVerified = true;
    useFirestore = true;
    console.log("[Store] Firestore connection verified ✓");
    return true;
  } catch (err: any) {
    firestoreVerified = true;
    useFirestore = false;
    console.warn(`[Store] Firestore unavailable: ${err.message}. Falling back to in-memory.`);
    return false;
  }
}

class Store {
  private hosts: Map<string, Host> = new Map();
  private documents: Map<string, DocumentListing> = new Map();
  private purchases: Map<string, Purchase> = new Map();

  // --- Hosts ---

  async addHost(host: Host): Promise<void> {
    this.hosts.set(host.id, host);
    if (await ensureFirestore()) {
      await db!.collection("hosts").doc(host.id).set(host);
    }
  }

  async getHost(id: string): Promise<Host | undefined> {
    if (await ensureFirestore()) {
      const snap = await db!.collection("hosts").doc(id).get();
      return snap.exists ? (snap.data() as Host) : undefined;
    }
    return this.hosts.get(id);
  }

  async getAllHosts(): Promise<Host[]> {
    if (await ensureFirestore()) {
      const snap = await db!.collection("hosts").get();
      return snap.docs.map((d) => d.data() as Host);
    }
    return Array.from(this.hosts.values());
  }

  // --- Documents ---

  async addDocument(doc: DocumentListing): Promise<void> {
    this.documents.set(doc.id, doc);
    if (await ensureFirestore()) {
      await db!.collection("documents").doc(doc.id).set(doc);
    }
  }

  async getDocument(id: string): Promise<DocumentListing | undefined> {
    if (await ensureFirestore()) {
      const snap = await db!.collection("documents").doc(id).get();
      return snap.exists ? (snap.data() as DocumentListing) : undefined;
    }
    return this.documents.get(id);
  }

  async getAllDocuments(): Promise<DocumentListing[]> {
    if (await ensureFirestore()) {
      const snap = await db!.collection("documents").get();
      return snap.docs.map((d) => d.data() as DocumentListing);
    }
    return Array.from(this.documents.values());
  }

  async getDocumentsByHost(hostId: string): Promise<DocumentListing[]> {
    if (await ensureFirestore()) {
      const snap = await db!.collection("documents").where("hostId", "==", hostId).get();
      return snap.docs.map((d) => d.data() as DocumentListing);
    }
    return Array.from(this.documents.values()).filter((d) => d.hostId === hostId);
  }

  async searchDocuments(query: string, tag?: string): Promise<DocumentListing[]> {
    const all = await this.getAllDocuments();
    const q = query.toLowerCase();
    return all.filter((doc) => {
      const matchesQuery =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.description.toLowerCase().includes(q);
      const matchesTag = !tag || tag === "All" || doc.tags.includes(tag);
      return matchesQuery && matchesTag;
    });
  }

  // --- Purchases ---

  async addPurchase(purchase: Purchase): Promise<void> {
    this.purchases.set(purchase.id, purchase);
    if (await ensureFirestore()) {
      await db!.collection("purchases").doc(purchase.id).set(purchase);
    }
  }

  async getPurchase(id: string): Promise<Purchase | undefined> {
    if (await ensureFirestore()) {
      const snap = await db!.collection("purchases").doc(id).get();
      return snap.exists ? (snap.data() as Purchase) : undefined;
    }
    return this.purchases.get(id);
  }

  async updatePurchase(id: string, updates: Partial<Purchase>): Promise<void> {
    if (await ensureFirestore()) {
      await db!.collection("purchases").doc(id).update(updates);
    }
    const p = this.purchases.get(id);
    if (p) {
      this.purchases.set(id, { ...p, ...updates });
    }
  }

  async getPurchasesByBuyer(buyerAddress: string): Promise<Purchase[]> {
    if (await ensureFirestore()) {
      const snap = await db!.collection("purchases")
        .where("buyerAddress", "==", buyerAddress)
        .get();
      return snap.docs.map((d) => d.data() as Purchase);
    }
    return Array.from(this.purchases.values()).filter(
      (p) => p.buyerAddress === buyerAddress
    );
  }
}

export const store = new Store();
