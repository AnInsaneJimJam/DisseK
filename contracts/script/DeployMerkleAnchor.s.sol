// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MerkleAnchor.sol";

contract DeployMerkleAnchor is Script {
    function run() external {
        vm.startBroadcast();
        MerkleAnchor anchor = new MerkleAnchor();
        vm.stopBroadcast();

        console.log("MerkleAnchor deployed at:", address(anchor));
    }
}
