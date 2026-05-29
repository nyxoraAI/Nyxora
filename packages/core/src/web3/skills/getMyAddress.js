"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyAddressToolDefinition = void 0;
exports.getMyAddress = getMyAddress;
const config_1 = require("../config");
async function getMyAddress() {
    try {
        const address = (0, config_1.getAddress)();
        if (!address) {
            return "Error: Could not retrieve public address from the keystore.";
        }
        return `Your Public Address is: ${address}`;
    }
    catch (error) {
        return `Failed to get public address: ${error.message}`;
    }
}
exports.getMyAddressToolDefinition = {
    type: "function",
    function: {
        name: "get_my_address",
        description: "Retrieve the agent's own public wallet address derived from the local keystore.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    }
};
