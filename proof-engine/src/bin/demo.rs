use proof_engine::DocumentTree;
use std::fs;

fn main() {
    let doc_content = fs::read_to_string("actual_doc.txt").expect("Could not read actual_doc.txt");
    let lines: Vec<String> = doc_content.lines().map(|s| s.to_string()).collect();

    // 1. Build the Tree
    let doc_tree = DocumentTree::new(lines.clone());
    let root = doc_tree.get_root();
    let total_leaves = doc_tree.get_total_leaves();

    // 2. Extract lines 1 to 5 (Index 0 to 4) representing the "public" section
    let start_index = 0;
    let end_index = 4;
    
    let mut testing_lines: Vec<String> = Vec::new();
    let mut testing_salts_hex: Vec<String> = Vec::new();
    let mut pure_rust_salts: Vec<[u8; 32]> = Vec::new();

    for i in start_index..=end_index {
        testing_lines.push(lines[i].clone());
        let salt = doc_tree.get_salt(i);
        
        let mut rust_salt = [0u8; 32];
        rust_salt.copy_from_slice(&salt);
        pure_rust_salts.push(rust_salt);
        testing_salts_hex.push(hex::encode(salt));
    }

    // 3. Extract the proof
    let proof_bytes = doc_tree.extract_range_proof(start_index, end_index);

    // 4. Create "tested_doc.txt" which contains the extracted lines
    let mut tested_doc_out = String::new();
    for line in &testing_lines {
        tested_doc_out.push_str(line);
        tested_doc_out.push('\n');
    }
    fs::write("tested_doc.txt", tested_doc_out).expect("failed to write tested_doc.txt");

    // 5. Create "proof.json" sidecar
    let hex_root = hex::encode(&root);
    let hex_proof = hex::encode(&proof_bytes);
    let salts_json = format!("[\"{}\"]", testing_salts_hex.join("\", \""));

    let json_out = format!(
        r#"{{
  "original_root": "{}",
  "total_leaves": {},
  "range_start": {},
  "range_end": {},
  "salts": {},
  "multi_proof": "{}"
}}"#,
        hex_root, total_leaves, start_index, end_index, salts_json, hex_proof
    );

    fs::write("proof_package.json", json_out).expect("failed to write json");

    println!("✅ Extraction Complete!");
    println!("Created `tested_doc.txt` with exactly {} lines.", testing_lines.len());
    println!("Created `proof_package.json` with multi-proof linking back to Authoritative Root.");
    
    // 6. Verify the extracted lines and proof!
    println!("\n[Bob's Verification Step]");
    
    let is_valid = DocumentTree::verify_range_rust(
        &root,
        start_index,
        testing_lines.clone(),
        pure_rust_salts,
        &proof_bytes,
        total_leaves,
    );
    
    if is_valid {
        println!("✅ Verification SUCCESS! The {} lines in `tested_doc.txt` are mathematically proven to be part of the authoritative Fileverse root.", testing_lines.len());
    } else {
        println!("❌ Verification FAILED!");
    }
}
