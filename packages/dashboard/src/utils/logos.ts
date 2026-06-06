export const getChainLogoUrl = (chain: string) => {
  const twName: any = {
    ethereum: 'ethereum',
    base: 'base',
    arbitrum: 'arbitrum',
    optimism: 'optimism',
    bsc: 'smartchain',
    polygon: 'polygon',
    sepolia: 'ethereum',
    base_sepolia: 'base'
  };
  const mapped = twName[chain.toLowerCase()] || 'ethereum';
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${mapped}/info/logo.png`;
};

export const getChainId = (chain: string) => {
  switch (chain.toLowerCase()) {
    case 'ethereum': return 1;
    case 'base': return 8453;
    case 'arbitrum': return 42161;
    case 'optimism': return 10;
    case 'bsc': return 56;
    case 'polygon': return 137;
    case 'sepolia': return 11155111;
    case 'base_sepolia': return 84532;
    default: return 1;
  }
};

export const getTokenLogoUrl = (chain: string, address: string, isNative: boolean) => {
  if (isNative) {
    if (chain === 'polygon') return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png';
    if (chain === 'bsc') return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png';
    return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png';
  }
  const chainId = getChainId(chain);
  return `https://logos.covalenthq.com/tokens/${chainId}/${address.toLowerCase()}.png`;
};
