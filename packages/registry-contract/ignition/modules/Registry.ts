import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RegistryModule = buildModule("RegistryModule", (m) => {
  const registry = m.contract("NyxoraAgentRegistry");

  return { registry };
});

export default RegistryModule;
