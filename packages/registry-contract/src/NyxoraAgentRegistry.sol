// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Importing standard, audited security libraries
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title NyxoraAgentRegistry
 * @dev Enterprise-grade decentralized identity registry for Nyxora Autonomous AI agents.
 */
contract NyxoraAgentRegistry is Ownable, Pausable {
    
    // --- Custom Errors (Highly Gas Optimized) ---
    error AgentAlreadyExists(address controller);
    error AgentDoesNotExist(address controller);
    error NameTooLong();

    struct Agent {
        string name;
        address controllerWallet;
        bool isActive;
        uint256 registeredAt;
    }

    mapping(address => Agent) public registeredAgents;
    address[] public agentList;

    // --- Events ---
    event AgentRegistered(address indexed controller, string name, uint256 timestamp);
    event AgentStatusChanged(address indexed controller, bool isActive);

    /**
     * @dev Constructor passes the deployer address to the Ownable contract
     */
    constructor() Ownable(msg.sender) {}

    /**
     * @dev Register a new AI Agent. Can only be called when the contract is not paused.
     * @param _agentName The designated name for the AI agent.
     */
    function registerAgent(string calldata _agentName) external whenNotPaused {
        // Validate string length to prevent state bloat/spam attacks
        if (bytes(_agentName).length > 32) revert NameTooLong();
        
        // Validate existence using Custom Errors
        if (registeredAgents[msg.sender].registeredAt != 0) revert AgentAlreadyExists(msg.sender);

        registeredAgents[msg.sender] = Agent({
            name: _agentName,
            controllerWallet: msg.sender,
            isActive: true,
            registeredAt: block.timestamp
        });

        agentList.push(msg.sender);
        emit AgentRegistered(msg.sender, _agentName, block.timestamp);
    }

    /**
     * @dev Allows agent owner to toggle their agent's active status (e.g., if compromised)
     * @param _status True to activate, False to deactivate.
     */
    function toggleAgentStatus(bool _status) external {
        if (registeredAgents[msg.sender].registeredAt == 0) revert AgentDoesNotExist(msg.sender);
        
        registeredAgents[msg.sender].isActive = _status;
        emit AgentStatusChanged(msg.sender, _status);
    }

    /**
     * @dev Returns the total number of registered agents.
     */
    function getTotalAgents() external view returns (uint256) {
        return agentList.length;
    }

    // --- Admin Security Functions ---

    /**
     * @dev Pause all new registrations in case of an emergency exploit.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract once the system is secured.
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
