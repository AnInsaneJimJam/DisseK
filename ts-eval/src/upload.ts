import { eciesEncrypt, getPublicKey } from "@fileverse/crypto";
import * as crypto from "crypto";
// @ts-ignore
import { MerkleProofEngine } from "../../proof-engine/pkg/proof_engine.js";

export async function uploadDocument(agent: Agent, documentContent: string, ownerPrivateKey: string) {
    const lines = documentContent.split("\n");
    const salts: Uint8Array[] = [];
    const leafHashes: Uint8Array[] = [];

    const engine = new MerkleProofEngine();

    // 1. Split & hash leaves
    for (let i = 0; i < lines.length; i++) {
        // Generate secure 32-byte salt for each line
        const salt = crypto.randomBytes(32);
        salts.push(salt);

        // Compute hash via WASM: Hash(0x00 || Index_i || Line_i || Salt_i)
        // Note: build_leaf expects (index, line, salt)
        const leafHash = MerkleProofEngine.build_leaf(i, lines[i], salt);
        leafHashes.push(leafHash);
    }

    // 2. Build Merkle Tree
    const merkleRoot = engine.build_tree(leafHashes);
    const rootHex = Buffer.from(merkleRoot).toString("hex");

    // 3. Encrypt the raw file and salt map with a symmetric key derived from Private Key
    // (In reality, we generate a symmetric key and encrypt it for ourselves, or standard ECIES for self)
    const payload = JSON.stringify({
        content: documentContent,
        salts: salts.map(s => Buffer.from(s).toString("hex"))
    });
    
    // We encrypt it for the owner using their private key for persistence
    // (using Fileverse API, deriving public key from private key to self-encrypt)
    const ownerPub = getPublicKey(ownerPrivateKey);
    const encryptedBlob = await eciesEncrypt(
        ownerPub,
        payload
    );

    // 4. IPFS Commit
    const fileId = await agent.create({
        content: encryptedBlob,
        metadata: {
            name: "SecretDocument.txt",
            description: "A partially verifiable code snippet",
        }
    }, {
        // Store the MerkleRoot in the metadata
        custom_merkle_root: rootHex, 
        total_lines: lines.length
    });

    return { fileId, rootHex, engine, lines, salts };
}

