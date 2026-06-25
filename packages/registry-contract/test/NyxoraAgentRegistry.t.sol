// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/NyxoraAgentRegistry.sol";

contract NyxoraAgentRegistryTest is Test {
    NyxoraAgentRegistry public registry;
    address public owner = address(1);
    address public user = address(2);

    function setUp() public {
        vm.prank(owner);
        registry = new NyxoraAgentRegistry();
    }

    function test_RegisterAgent() public {
        vm.prank(user);
        registry.registerAgent("AgentSmith");

        (string memory name, address controller, bool isActive, ) = registry.registeredAgents(user);
        assertEq(name, "AgentSmith");
        assertEq(controller, user);
        assertTrue(isActive);
        assertEq(registry.getTotalAgents(), 1);
    }

    function test_ToggleAgentStatus() public {
        vm.prank(user);
        registry.registerAgent("AgentSmith");

        vm.prank(user);
        registry.toggleAgentStatus(false);

        (, , bool isActive, ) = registry.registeredAgents(user);
        assertFalse(isActive);
    }

    function test_PauseUnpause() public {
        // Owner pauses the contract
        vm.prank(owner);
        registry.pause();

        // User tries to register, should fail
        vm.prank(user);
        vm.expectRevert();
        registry.registerAgent("AgentSmith");

        // Owner unpauses the contract
        vm.prank(owner);
        registry.unpause();

        // User tries to register, should succeed
        vm.prank(user);
        registry.registerAgent("AgentSmith");

        (string memory name, , , ) = registry.registeredAgents(user);
        assertEq(name, "AgentSmith");
    }
}
