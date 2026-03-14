/**
 * In-memory data store for the marketplace.
 * Resets on restart — fine for hackathon demo.
 */

import type { Host, DocumentListing, Purchase } from "./types.js";

class Store {
  hosts: Map<string, Host> = new Map();
  documents: Map<string, DocumentListing> = new Map();
  purchases: Map<string, Purchase> = new Map();

  // --- Hosts ---

  addHost(host: Host): void {
    this.hosts.set(host.id, host);
  }

  getHost(id: string): Host | undefined {
    return this.hosts.get(id);
  }

  getAllHosts(): Host[] {
    return Array.from(this.hosts.values());
  }

  // --- Documents ---

  addDocument(doc: DocumentListing): void {
    this.documents.set(doc.id, doc);
  }

  getDocument(id: string): DocumentListing | undefined {
    return this.documents.get(id);
  }

  getAllDocuments(): DocumentListing[] {
    return Array.from(this.documents.values());
  }

  getDocumentsByHost(hostId: string): DocumentListing[] {
    return this.getAllDocuments().filter((d) => d.hostId === hostId);
  }

  searchDocuments(query: string, tag?: string): DocumentListing[] {
    const q = query.toLowerCase();
    return this.getAllDocuments().filter((doc) => {
      const matchesQuery =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.description.toLowerCase().includes(q);
      const matchesTag = !tag || tag === "All" || doc.tags.includes(tag);
      return matchesQuery && matchesTag;
    });
  }

  // --- Purchases ---

  addPurchase(purchase: Purchase): void {
    this.purchases.set(purchase.id, purchase);
  }

  getPurchase(id: string): Purchase | undefined {
    return this.purchases.get(id);
  }

  updatePurchase(id: string, updates: Partial<Purchase>): void {
    const p = this.purchases.get(id);
    if (p) {
      this.purchases.set(id, { ...p, ...updates });
    }
  }

  getPurchasesByBuyer(buyerAddress: string): Purchase[] {
    return Array.from(this.purchases.values()).filter(
      (p) => p.buyerAddress === buyerAddress
    );
  }
}

export const store = new Store();
