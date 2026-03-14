use wasm_bindgen::prelude::*;
use rs_merkle::{MerkleTree, Hasher};
use sha2::{Sha256, Digest};

#[derive(Clone)]
pub struct DomainSeparatedHasher;

impl Hasher for DomainSeparatedHasher {
    type Hash = [u8; 32];

    fn hash(data: &[u8]) -> [u8; 32] {
        let mut hasher = Sha256::new();
        // rs_merkle hashes pairs of children (64 bytes total) for internal nodes
        if data.len() == 64 {
            hasher.update(&[0x01]); // Domain separation for internal nodes
        } else {
            hasher.update(&[0x00]); // Domain separation for leaf nodes
        }
        hasher.update(data);
        hasher.finalize().into()
    }
}

#[wasm_bindgen]
pub struct MerkleProofEngine {
    tree: MerkleTree<DomainSeparatedHasher>,
}

#[wasm_bindgen]
impl MerkleProofEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> MerkleProofEngine {
        MerkleProofEngine {
            tree: MerkleTree::new(),
        }
    }
    
    // Hash a line with index and salt: Hash(0x00 || Index || Line || Salt)
    #[wasm_bindgen]
    pub fn build_leaf(index: u32, line: &str, salt: &[u8]) -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(&index.to_be_bytes());
        data.extend_from_slice(line.as_bytes());
        data.extend_from_slice(salt);
        // Domain separation byte for leaves is handled via `DomainSeparatedHasher` above.
        DomainSeparatedHasher::hash(&data).to_vec()
    }

    #[wasm_bindgen]
    pub fn build_tree(&mut self, leaf_hashes: Vec<js_sys::Uint8Array>) -> Vec<u8> {
        let mut leaves: Vec<[u8; 32]> = leaf_hashes.into_iter()
            .map(|h| {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&h.to_vec());
                arr
            })
            .collect();
            
        // Pad to next power of 2
        let len = leaves.len();
        if len > 0 && !len.is_power_of_two() {
            let next_power = len.next_power_of_two();
            let pad_diff = next_power - len;
            for _ in 0..pad_diff {
                let mut pad_data = Vec::new();
                pad_data.extend_from_slice(b"PAD");
                pad_data.extend_from_slice(&[0u8; 32]);
                leaves.push(DomainSeparatedHasher::hash(&pad_data));
            }
        }

        self.tree = MerkleTree::<DomainSeparatedHasher>::from_leaves(&leaves);
        
        self.tree.root().unwrap_or([0u8; 32]).to_vec()
    }

    #[wasm_bindgen]
    pub fn get_multi_proof(&self, indices: Vec<usize>) -> Vec<u8> {
        let proof = self.tree.proof(&indices);
        proof.to_bytes()
    }
    
    #[wasm_bindgen]
    pub fn verify_multi_proof(root: &[u8], indices: Vec<usize>, leaves: Vec<js_sys::Uint8Array>, proof_bytes: &[u8], total_leaves_count: usize) -> bool {
        let root_arr: [u8; 32] = match root.try_into() {
            Ok(arr) => arr,
            Err(_) => return false,
        };
        
        let leaves_arr: Vec<[u8; 32]> = leaves.into_iter()
            .map(|l| {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&l.to_vec());
                arr
            })
            .collect();
            
        let proof = rs_merkle::MerkleProof::<DomainSeparatedHasher>::from_bytes(proof_bytes);
        match proof {
            Ok(p) => p.verify(root_arr, &indices, &leaves_arr, total_leaves_count),
            Err(_) => false
        }
    }
}

#[wasm_bindgen]
pub struct DocumentTree {
    engine: MerkleProofEngine,
    leaves: Vec<[u8; 32]>,
    salts: Vec<[u8; 32]>,
    total_padded_len: usize,
}

#[wasm_bindgen]
impl DocumentTree {
    #[wasm_bindgen(constructor)]
    pub fn new(lines: Vec<String>) -> DocumentTree {
        let mut leaves: Vec<[u8; 32]> = Vec::new();
        let mut salts: Vec<[u8; 32]> = Vec::new();

        // 1. Generate salts and hash lines
        for i in 0..lines.len() {
            // For a production app this should use a secure RNG over JS bindings
            // But for simple extraction we can use basic derived bytes
            let mut salt = [0u8; 32];
            salt[0..4].copy_from_slice(&(i as u32).to_le_bytes()); // Dummy salt generation
            salts.push(salt);

            let leaf_hash = MerkleProofEngine::build_leaf(i as u32, &lines[i], &salt);
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&leaf_hash);
            leaves.push(arr);
        }

        // 2. Pad to next power of 2
        let len = leaves.len();
        let total_padded_len = if len > 0 && !len.is_power_of_two() {
            len.next_power_of_two()
        } else {
            len
        };

        let mut padded_leaves = leaves.clone();
        for _ in 0..(total_padded_len - len) {
            let mut pad_data = Vec::new();
            pad_data.extend_from_slice(b"PAD");
            pad_data.extend_from_slice(&[0u8; 32]);
            padded_leaves.push(DomainSeparatedHasher::hash(&pad_data));
        }

        let tree = MerkleTree::<DomainSeparatedHasher>::from_leaves(&padded_leaves);

        DocumentTree {
            engine: MerkleProofEngine { tree },
            leaves,
            salts,
            total_padded_len,
        }
    }

    #[wasm_bindgen]
    pub fn get_root(&self) -> Vec<u8> {
        self.engine.tree.root().unwrap_or([0u8; 32]).to_vec()
    }

    #[wasm_bindgen]
    pub fn get_total_leaves(&self) -> usize {
        self.total_padded_len
    }

    #[wasm_bindgen]
    pub fn get_salt(&self, index: usize) -> Vec<u8> {
        self.salts[index].to_vec()
    }

    #[wasm_bindgen]
    pub fn extract_range_proof(&self, start_index: usize, end_index: usize) -> Vec<u8> {
        let mut indices = Vec::new();
        for i in start_index..=end_index {
            indices.push(i);
        }
        self.engine.get_multi_proof(indices)
    }

    #[wasm_bindgen]
    pub fn verify_range(
        root: &[u8],
        start_index: usize,
        lines: Vec<String>,
        salts: Vec<js_sys::Uint8Array>,
        proof_bytes: &[u8],
        total_leaves_count: usize,
    ) -> bool {
        let root_arr: [u8; 32] = match root.try_into() {
            Ok(arr) => arr,
            Err(_) => return false,
        };

        if lines.len() != salts.len() {
            return false;
        }

        let mut verification_leaves: Vec<[u8; 32]> = Vec::new();
        let mut indices: Vec<usize> = Vec::new();

        for i in 0..lines.len() {
            let original_index = start_index + i;
            let salt_bytes = salts[i].to_vec();

            let leaf_hash = MerkleProofEngine::build_leaf(original_index as u32, &lines[i], &salt_bytes);
            
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&leaf_hash);
            verification_leaves.push(arr);
            indices.push(original_index);
        }

        let proof = rs_merkle::MerkleProof::<DomainSeparatedHasher>::from_bytes(proof_bytes);
        match proof {
            Ok(p) => p.verify(root_arr, &indices, &verification_leaves, total_leaves_count),
            Err(_) => false
        }
    }
}

// Separate standard impl block for pure Rust helpers (not exported to WASM)
impl DocumentTree {
    // Pure Rust verifier (since `js_sys::Uint8Array` panics in `cargo test`)
    pub fn verify_range_rust(
        root: &[u8],
        start_index: usize,
        lines: Vec<String>,
        salts: Vec<[u8; 32]>,
        proof_bytes: &[u8],
        total_leaves_count: usize,
    ) -> bool {
        let root_arr: [u8; 32] = match root.try_into() {
            Ok(arr) => arr,
            Err(_) => return false,
        };

        if lines.len() != salts.len() {
            return false;
        }

        let mut verification_leaves: Vec<[u8; 32]> = Vec::new();
        let mut indices: Vec<usize> = Vec::new();

        for i in 0..lines.len() {
            let original_index = start_index + i;
            let leaf_hash = MerkleProofEngine::build_leaf(original_index as u32, &lines[i], &salts[i]);
            
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&leaf_hash);
            verification_leaves.push(arr);
            indices.push(original_index);
        }

        let proof = rs_merkle::MerkleProof::<DomainSeparatedHasher>::from_bytes(proof_bytes);
        match proof {
            Ok(p) => p.verify(root_arr, &indices, &verification_leaves, total_leaves_count),
            Err(_) => false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_leaf_building() {
        let index = 5;
        let line = "fn main() {";
        let salt = [0u8; 32];
        
        let hash = MerkleProofEngine::build_leaf(index, line, &salt);
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_merkle_path_generation_and_verification() {
        let lines: Vec<String> = (0..10).map(|i| format!("line content {}", i)).collect();
        let doc_tree = DocumentTree::new(lines.clone());
        let root = doc_tree.get_root();
        
        // 4. Generate a Multi-Proof for indices 2 to 7
        let start_index = 2;
        let end_index = 7;
        let proof_bytes = doc_tree.extract_range_proof(start_index, end_index);

        // 5. Verify the Multi-Proof
        let mut extracted_lines = Vec::new();
        let mut extracted_salts = Vec::new();
        for i in start_index..=end_index {
            extracted_lines.push(lines[i].clone());
            
            let mut salt = [0u8; 32];
            salt.copy_from_slice(&doc_tree.get_salt(i));
            extracted_salts.push(salt);
        }

        let total_leaves = doc_tree.get_total_leaves();
        
        let is_valid = DocumentTree::verify_range_rust(
            &root,
            start_index,
            extracted_lines.clone(),
            extracted_salts.clone(),
            &proof_bytes,
            total_leaves
        );
        assert!(is_valid, "Merkle Multi-proof failed verification!");

        // 6. Ensure verification fails with tampered lines
        let mut tampered_lines = extracted_lines.clone();
        tampered_lines[0] = "Tampered code line".to_string();
        
        let is_valid_tampered = DocumentTree::verify_range_rust(
            &root,
            start_index,
            tampered_lines,
            extracted_salts.clone(),
            &proof_bytes,
            total_leaves
        );
        assert!(!is_valid_tampered, "Merkle verification should fail with tampered leaf!");

        // 7. Ensure verification fails with wrong original start index
        let wrong_start_index = 1;
        let is_valid_wrong_indices = DocumentTree::verify_range_rust(
            &root,
            wrong_start_index,
            extracted_lines.clone(),
            extracted_salts.clone(),
            &proof_bytes,
            total_leaves
        );
        assert!(!is_valid_wrong_indices, "Merkle verification should fail with wrong indices!");
    }

    #[test]
    fn test_contiguous_merkle_path_generation_and_verification() {
        let lines: Vec<String> = (0..200).map(|i| format!("Super secret code line {}", i)).collect();
        let doc_tree = DocumentTree::new(lines.clone());
        let root = doc_tree.get_root();

        // Generate proof for 1 to 80 inclusive
        let start_index = 1;
        let end_index = 80;
        let proof_bytes = doc_tree.extract_range_proof(start_index, end_index);

        let mut extracted_lines = Vec::new();
        let mut extracted_salts = Vec::new();
        for i in start_index..=end_index {
            extracted_lines.push(lines[i].clone());
            let mut salt = [0u8; 32];
            salt.copy_from_slice(&doc_tree.get_salt(i));
            extracted_salts.push(salt);
        }

        let is_valid = DocumentTree::verify_range_rust(
            &root,
            start_index,
            extracted_lines,
            extracted_salts,
            &proof_bytes,
            doc_tree.get_total_leaves()
        );
        
        assert!(is_valid, "Contiguous Merkle Multi-proof failed verification!");
    }
}
