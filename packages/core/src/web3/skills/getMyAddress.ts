import { getAddress } from '../config';

export async function getMyAddress(): Promise<string> {
  try {
    const address = await getAddress();
    if (!address) {
      return "Error: Could not retrieve public address from the keystore.";
    }
    return `Your Public Address is: ${address}`;
  } catch (error: any) {
    return `Failed to get public address: ${error.message}`;
  }
}

export const getMyAddressToolDefinition = {
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
