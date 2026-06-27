export const getChainLogoUrl = (chain: string) => {
  if (!chain) return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png';
  
  const twName: any = {
    ethereum: 'ethereum',
    base: 'base',
    arbitrum: 'arbitrum',
    optimism: 'optimism',
    bsc: 'smartchain',
    polygon: 'polygon',
    sepolia: 'ethereum',
    base_sepolia: 'base',
    arbitrum_sepolia: 'arbitrum',
    optimism_sepolia: 'optimism'
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
    case 'arbitrum_sepolia': return 421614;
    case 'optimism_sepolia': return 11155420;
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

export const getRouterLogoUrl = (router: string) => {
  switch (router.toLowerCase()) {
    case '1inch':
    case 'inch_key': return '/routers/1inch.png';
    case '0x':
    case 'zero_x_key': return '/routers/0x.png';
    case 'kyberswap': return '/routers/kyberswap.png';
    case 'openocean':
    case 'openocean_key': return '/routers/openocean.png';
    case 'lifi':
    case 'lifi_key': return '/routers/lifi.png';
    case 'relay':
    case 'relay_key': return '/routers/relay.png';
    case 'cmc_key':
    case 'cmc_pro_key': return '/routers/cmc.png';
    case 'coingecko_key':
    case 'coingecko_pro_key': return '/routers/coingecko.png';
    case 'zerion_key': return '/routers/zerion.png';
    case 'auto': return ''; // Handled by NyxoraLogo
    default: return '';
  }
};
