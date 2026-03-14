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
        // 1. Generate 10 leaves
        let mut leaves: Vec<[u8; 32]> = Vec::new();
        for i in 0..10 {
            let line = format!("line content {}", i);
            let salt = [i as u8; 32]; // dummy salt
            let leaf_hash = MerkleProofEngine::build_leaf(i, &line, &salt);
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&leaf_hash);
            leaves.push(arr);
        }

        // 2. Pad to the next power of 2 (16)
        let len = leaves.len();
        let next_power = len.next_power_of_two();
        assert_eq!(next_power, 16);
        let pad_diff = next_power - len;
        for _ in 0..pad_diff {
            let mut pad_data = Vec::new();
            pad_data.extend_from_slice(b"PAD");
            pad_data.extend_from_slice(&[0u8; 32]);
            leaves.push(DomainSeparatedHasher::hash(&pad_data));
        }

        // 3. Construct the Merkle Tree
        let tree = MerkleTree::<DomainSeparatedHasher>::from_leaves(&leaves);
        let root = tree.root().expect("Should have a root");

        // 4. Generate a Multi-Proof for indices 2, 5, and 7
        let indices_to_prove = vec![2, 5, 7];
        let proof = tree.proof(&indices_to_prove);
        let proof_bytes = proof.to_bytes();

        // 5. Verify the Multi-Proof
        let leaves_to_prove = vec![
            leaves[2],
            leaves[5],
            leaves[7],
        ];

        let parsed_proof = rs_merkle::MerkleProof::<DomainSeparatedHasher>::from_bytes(&proof_bytes).unwrap();
        let is_valid = parsed_proof.verify(root, &indices_to_prove, &leaves_to_prove, leaves.len());
        assert!(is_valid, "Merkle Multi-proof failed verification!");

        // 6. Ensure verification fails if we tamper with a leaf
        let mut tampered_leaves = leaves_to_prove.clone();
        tampered_leaves[0][0] ^= 1; // flip a bit
        let is_valid_tampered = parsed_proof.verify(root, &indices_to_prove, &tampered_leaves, leaves.len());
        assert!(!is_valid_tampered, "Merkle verification should fail with tampered leaf!");

        // 7. Ensure verification fails with wrong indices
        let wrong_indices = vec![2, 5, 8];
        let is_valid_wrong_indices = parsed_proof.verify(root, &wrong_indices, &leaves_to_prove, leaves.len());
        assert!(!is_valid_wrong_indices, "Merkle verification should fail with wrong indices!");
    }

    #[test]
    fn test_contiguous_merkle_path_generation_and_verification() {
        // 1. Generate 200 leaves (simulating a 200 line document)
        let mut leaves: Vec<[u8; 32]> = Vec::new();
        for i in 0..200 {
            let line = format!("Super secret code line {}", i);
            let salt = [i as u8; 32];
            let leaf_hash = MerkleProofEngine::build_leaf(i, &line, &salt);
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&leaf_hash);
            leaves.push(arr);
        }

        // 2. Pad to the next power of 2 (256)
        let len = leaves.len();
        let next_power = len.next_power_of_two();
        assert_eq!(next_power, 256);
        let pad_diff = next_power - len;
        for _ in 0..pad_diff {
            let mut pad_data = Vec::new();
            pad_data.extend_from_slice(b"PAD");
            pad_data.extend_from_slice(&[0u8; 32]);
            leaves.push(DomainSeparatedHasher::hash(&pad_data));
        }

        // 3. Construct the Merkle Tree
        let tree = MerkleTree::<DomainSeparatedHasher>::from_leaves(&leaves);
        let root = tree.root().expect("Should have a root");

        // 4. Generate a Multi-Proof for a contiguous range (e.g. lines 1 to 80 inclusive)
        let mut indices_to_prove = Vec::new();
        let mut leaves_to_prove = Vec::new();
        for i in 1..=80 {
            indices_to_prove.push(i);
            leaves_to_prove.push(leaves[i]);
        }
        
        let proof = tree.proof(&indices_to_prove);
        let proof_bytes = proof.to_bytes();

        // 5. Verify the contiguous Multi-Proof against the full tree root
        let parsed_proof = rs_merkle::MerkleProof::<DomainSeparatedHasher>::from_bytes(&proof_bytes).unwrap();
        let is_valid = parsed_proof.verify(root, &indices_to_prove, &leaves_to_prove, leaves.len());
        
        assert!(is_valid, "Contiguous Merkle Multi-proof failed verification!");
    }
}
