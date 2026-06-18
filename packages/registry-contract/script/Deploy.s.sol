// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {NyxoraAgentRegistry} from "../src/NyxoraAgentRegistry.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy the NyxoraAgentRegistry contract
        NyxoraAgentRegistry registry = new NyxoraAgentRegistry();

        vm.stopBroadcast();
        
        // Log the deployed address for the backend
        console.log("NyxoraAgentRegistry deployed at:", address(registry));
    }
}
