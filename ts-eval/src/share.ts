import { eciesEncrypt, eciesDecrypt } from "@fileverse/crypto";
// @ts-ignore
import { MerkleProofEngine } from "../../proof-engine/pkg/proof_engine.js";

// Simulates Owner sharing a range of lines with Bob
export async function shareRange(
    lines: string[],
    salts: Uint8Array[],
    engine: any,
    startLine: number,
    endLine: number,
    bobPublicKey: string
) {
    // 1. Extract lines and salts 1-80 (0-indexed: startLine to endLine-1)
    const sharedLines = lines.slice(startLine, endLine);
    const sharedSalts = salts.slice(startLine, endLine);

    // We need the original indices for the multi-proof to work correctly since
    // they were hashed with their line numbers.
    const indices: number[] = [];
    for (let i = startLine; i < endLine; i++) {
        indices.push(i);
    }

    // 2. Generate Multi-proof from the WASM engine
    const proofBytes = engine.get_multi_proof(new Uint32Array(indices));

    // 3. Create Proof Package
    const proofPackage = {
        startIndex: startLine,
        endIndex: endLine,
        lines: sharedLines,
        salts: sharedSalts.map(s => Buffer.from(s).toString("hex")),
        proof: Buffer.from(proofBytes).toString("hex"),
        totalLeaves: Math.max(lines.length, Math.pow(2, Math.ceil(Math.log2(lines.length)))) // Padded length
    };

    // 4. Encrypt for Bob
    const payload = JSON.stringify(proofPackage);
    const encryptedSidecar = await eciesEncrypt(
        bobPublicKey,
        payload
    );

    return encryptedSidecar;
}

export async function verifySharedRange(
    authoritativeRootHex: string,
    encryptedSidecar: string,
    bobPrivateKey: string
) {
    // 1. Decrypt Proof Package
    const decryptedPayload = await eciesDecrypt(
        bobPrivateKey,
        encryptedSidecar
    );

    const proofPackage = JSON.parse(decryptedPayload);
    const { startIndex, endIndex, lines, salts, proof, totalLeaves } = proofPackage;

    // 2. Re-hash the shared leaves
    const leafHashes: Uint8Array[] = [];
    const indices: number[] = [];

    for (let i = 0; i < lines.length; i++) {
        const originalIndex = startIndex + i;
        indices.push(originalIndex);

        const saltBytes = Buffer.from(salts[i], "hex");
        // Re-hash via WASM
        const leafHash = MerkleProofEngine.build_leaf(originalIndex, lines[i], saltBytes);
        leafHashes.push(leafHash);
    }

    // 3. Verify Multi-proof
    const rootBytes = Buffer.from(authoritativeRootHex, "hex");
    const proofBytes = Buffer.from(proof, "hex");

    const isValid = MerkleProofEngine.verify_multi_proof(
        rootBytes,
        new Uint32Array(indices),
        leafHashes,
        proofBytes,
        totalLeaves
    );

    return {
        isValid,
        lines: isValid ? lines : null
    };
}
