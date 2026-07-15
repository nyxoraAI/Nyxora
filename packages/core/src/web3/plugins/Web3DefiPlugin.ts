import { Plugin } from '../../plugin/types';
import { getBalance, getBalanceToolDefinition } from '../skills/getBalance';
import { checkPortfolio, checkPortfolioToolDefinition } from '../skills/checkPortfolio';
import { prepareSwapToken, swapTokenToolDefinition } from '../skills/swapToken';
import { getPriceToolDefinition, getPrice } from '../skills/getPrice';
import { bridgeTokenToolDefinition, prepareBridgeToken } from '../skills/bridgeToken';
import { revokeApprovalToolDefinition, prepareRevokeApproval } from '../skills/revokeApprovals';
import { aaveSupplyToolDefinition, prepareAaveSupply } from '../skills/defiLending';
import { vaultDepositToolDefinition, prepareVaultDeposit } from '../skills/yieldVault';
import { provideLiquidityToolDefinition, prepareProvideLiquidity } from '../skills/provideLiquidity';
import { createLimitOrderToolDefinition, createLimitOrder } from '../skills/createLimitOrder';
import { installDefiProviderDefinition, installDefiProvider } from '../skills/installDefiProvider';
import { confirmPendingTxToolDefinition, confirmPendingTx } from '../skills/confirmPendingTx';

export class Web3DefiPlugin implements Plugin {
  public name = 'Web3DefiPlugin';
  public description = 'Core DeFi operations including balance checking, portfolio analysis, and token swapping.';
  public version = '1.0.1';

  public tools = [
    getBalanceToolDefinition,
    checkPortfolioToolDefinition,
    swapTokenToolDefinition,
    getPriceToolDefinition,
    bridgeTokenToolDefinition,
    revokeApprovalToolDefinition,
    aaveSupplyToolDefinition,
    vaultDepositToolDefinition,
    provideLiquidityToolDefinition,
    createLimitOrderToolDefinition,
    installDefiProviderDefinition,
    confirmPendingTxToolDefinition
  ];

  public handlers = {
    [getBalanceToolDefinition.function.name]: async (args: any) => {
      return await getBalance(args.chainName, args.address, args.token);
    },
    [checkPortfolioToolDefinition.function.name]: async (args: any) => {
      return await checkPortfolio(args.chainName, args.address);
    },
    [swapTokenToolDefinition.function.name]: async (args: any) => {
      return await prepareSwapToken(
        args.chainName,
        args.sellToken || args.fromToken,
        args.buyToken || args.toToken,
        args.sellAmount || args.amountStr || args.amount,
        args.slippagePercentage || args.mode,
        args.aggregator || args.providerName,
        args.destinationAddress
      );
    },
    [getPriceToolDefinition.function.name]: async (args: any) => {
      return await getPrice(args.coinId, args.currency);
    },
    [bridgeTokenToolDefinition.function.name]: async (args: any) => {
      return await prepareBridgeToken(args.fromChain, args.toChain, args.tokenSymbol, args.amountStr, args.mode, args.providerName);
    },
    [revokeApprovalToolDefinition.function.name]: async (args: any) => {
      return await prepareRevokeApproval(args.chainName, args.tokenAddressOrSymbol, args.spenderAddress);
    },
    [aaveSupplyToolDefinition.function.name]: async (args: any) => {
      return await prepareAaveSupply(args.chainName, args.tokenAddressOrSymbol, args.amountStr);
    },
    [vaultDepositToolDefinition.function.name]: async (args: any) => {
      return await prepareVaultDeposit(args.chainName, args.protocol || 'beefy', args.vaultAddress, args.tokenAddressOrSymbol, args.amountStr);
    },
    [provideLiquidityToolDefinition.function.name]: async (args: any) => {
      return await prepareProvideLiquidity(args.chainName, args.token0AddressOrSymbol, args.token1AddressOrSymbol, args.amount0Str, args.amount1Str, args.feeTier, args.tickLower, args.tickUpper);
    },
    [createLimitOrderToolDefinition.function.name]: async (args: any) => {
      return await createLimitOrder(args.tokenSymbol, args.tokenAddress, args.triggerCondition as any, args.triggerPriceUsd, args.action as any, args.amountUsd, args.slippageTolerance);
    },
    [installDefiProviderDefinition.function.name]: async (args: any) => {
      return await installDefiProvider(args.providerName, args.url, args.code);
    },
    [confirmPendingTxToolDefinition.function.name]: async (args: any) => {
      return await confirmPendingTx(args.action);
    }
  };
}
