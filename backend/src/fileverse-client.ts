/**
 * Fileverse MCP Client
 * Connects to the Fileverse MCP server via StreamableHTTP transport
 * and calls its tools programmatically.
 * Requires FILEVERSE_API_URL env var pointing to the MCP server URL.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface FileverseDocument {
  ddocId: string;
  title: string;
  content: string;
  syncStatus: "pending" | "synced" | "failed";
  link: string | null;
  localVersion: number;
  onchainVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListResponse {
  ddocs: FileverseDocument[];
  total: number;
  hasNext: boolean;
}

export class FileverseClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport;
  private connected = false;

  constructor(mcpUrl?: string) {
    const url = mcpUrl || process.env.FILEVERSE_API_URL || "";
    if (!url) {
      throw new Error(
        "FILEVERSE_API_URL env var or mcpUrl constructor arg is required"
      );
    }

    this.client = new Client({ name: "dissek-backend", version: "1.0.0" });
    this.transport = new StreamableHTTPClientTransport(new URL(url));
  }

  /** Ensure connected before calling tools */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.client.connect(this.transport);
      this.connected = true;
    }
  }

  /** Call a Fileverse MCP tool and return the parsed JSON result */
  private async callTool(name: string, args: Record<string, any>): Promise<any> {
    await this.ensureConnected();
    const result = await this.client.callTool({ name, arguments: args });
    // MCP tool results come as content items; extract text and parse JSON
    for (const item of result.content as any[]) {
      if (item.type === "text") {
        try {
          return JSON.parse(item.text);
        } catch {
          return item.text;
        }
      }
    }
    return result.content;
  }

  async listDocuments(limit = 10, skip = 0): Promise<ListResponse> {
    return this.callTool("fileverse_list_documents", { limit, skip });
  }

  async getDocument(ddocId: string): Promise<FileverseDocument> {
    return this.callTool("fileverse_get_document", { ddocId });
  }

  async createDocument(
    title: string,
    content: string
  ): Promise<FileverseDocument> {
    return this.callTool("fileverse_create_document", { title, content });
  }

  async updateDocument(
    ddocId: string,
    updates: { title?: string; content?: string }
  ): Promise<FileverseDocument> {
    return this.callTool("fileverse_update_document", {
      ddocId,
      ...updates,
    });
  }

  async getSyncStatus(
    ddocId: string
  ): Promise<{ ddocId: string; syncStatus: string; link: string }> {
    return this.callTool("fileverse_get_sync_status", { ddocId });
  }

  /** Poll until syncStatus is "synced" or timeout */
  async waitForSync(
    ddocId: string,
    timeoutMs = 60000,
    intervalMs = 3000
  ): Promise<FileverseDocument> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const doc = await this.getDocument(ddocId);
      if (doc.syncStatus === "synced") return doc;
      if (doc.syncStatus === "failed")
        throw new Error(`Document ${ddocId} sync failed`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Sync timeout for document ${ddocId}`);
  }

  /** Disconnect the MCP client */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }
}
