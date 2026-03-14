use proof_engine::{MerkleProofEngine, DomainSeparatedHasher};
use rs_merkle::{Hasher, MerkleTree};
use std::fs;

fn main() {
    let doc_content = fs::read_to_string("actual_doc.txt").expect("Could not read actual_doc.txt");
    let lines: Vec<&str> = doc_content.lines().collect();
    
    let mut leaves: Vec<[u8; 32]> = Vec::new();
    let mut salts: Vec<[u8; 32]> = Vec::new();

    // 1. Hash all leaves
    for (i, line) in lines.iter().enumerate() {
        let salt = [i as u8; 32]; // dummy salt for demo
        salts.push(salt);
        let leaf_hash = MerkleProofEngine::build_leaf(i as u32, line, &salt);
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&leaf_hash);
        leaves.push(arr);
    }

    // 2. Pad tree to power of 2
    let len = leaves.len();
    let next_power = len.next_power_of_two();
    let pad_diff = next_power - len;
    for _ in 0..pad_diff {
        let mut pad_data = Vec::new();
        pad_data.extend_from_slice(b"PAD");
        pad_data.extend_from_slice(&[0u8; 32]);
        leaves.push(DomainSeparatedHasher::hash(&pad_data));
    }

    // 3. Build tree
    let tree = MerkleTree::<DomainSeparatedHasher>::from_leaves(&leaves);
    let root = tree.root().expect("Should have root");

    // 4. Extract lines 1 to 5 (Index 0 to 4) representing the "public" section
    let mut indices_to_prove = Vec::new();
    let mut testing_lines = Vec::new();
    let mut testing_salts = Vec::new();

    for i in 0..5 {
        indices_to_prove.push(i);
        testing_lines.push(lines[i]);
        testing_salts.push(salts[i]);
    }

    let proof = tree.proof(&indices_to_prove);
    let proof_bytes = proof.to_bytes();

    // 5. Create "tested_doc.txt" which contains the extracted lines
    let mut tested_doc_out = String::new();
    for line in &testing_lines {
        tested_doc_out.push_str(line);
        tested_doc_out.push('\n');
    }
    fs::write("tested_doc.txt", tested_doc_out).expect("failed to write tested_doc.txt");

    // 6. Create "proof.json" sidecar
    // We manually construct JSON string to avoid adding serde dependency for this demo
    let hex_root = hex::encode(root);
    let hex_proof = hex::encode(&proof_bytes);
    let hex_salts: Vec<String> = testing_salts.iter().map(|s| hex::encode(s)).collect();
    
    let salts_json = format!("[\"{}\"]", hex_salts.join("\", \""));

    let json_out = format!(
        r#"{{
  "original_root": "{}",
  "total_leaves": {},
  "range_start": 0,
  "range_end": 4,
  "salts": {},
  "multi_proof": "{}"
}}"#,
        hex_root, len, salts_json, hex_proof
    );

    fs::write("proof_package.json", json_out).expect("failed to write json");

    println!("✅ Extraction Complete!");
    println!("Created `tested_doc.txt` with exactly 5 lines (1-5).");
    println!("Created `proof_package.json` with multi-proof linking back to Authoritative Root.");
    // 7. Verify the extracted lines and proof!
    println!("\n[Bob's Verification Step]");
    let mut verification_leaves: Vec<[u8; 32]> = Vec::new();
    let mut verification_indices: Vec<usize> = Vec::new();

    // Replay Bob hashing the received lines with the received salts
    for i in 0..5 {
        let original_index = i as u32; // from 0 to 4
        let leaf_hash = MerkleProofEngine::build_leaf(original_index, testing_lines[i], &testing_salts[i]);
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&leaf_hash);
        verification_leaves.push(arr);
        verification_indices.push(i);
    }

    // Load the proof bytes
    let parsed_proof = rs_merkle::MerkleProof::<DomainSeparatedHasher>::from_bytes(&proof_bytes).unwrap();
    
    // Verify against the authoritative root
    let is_valid = parsed_proof.verify(root, &verification_indices, &verification_leaves, len);
    
    if is_valid {
        println!("✅ Verification SUCCESS! The {} lines in `tested_doc.txt` are mathematically proven to be part of the authoritative Fileverse root.", testing_lines.len());
    } else {
        println!("❌ Verification FAILED!");
    }
}
