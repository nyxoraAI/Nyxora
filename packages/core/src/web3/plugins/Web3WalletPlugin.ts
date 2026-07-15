import { Plugin } from '../../plugin/types';
import { mintNftToolDefinition, prepareMintNft } from '../skills/mintNft';
import { customTxToolDefinition, prepareCustomTx } from '../skills/customTx';
import { checkAddressToolDefinition, checkAddress } from '../skills/checkAddress';
import { getMyAddressToolDefinition, getMyAddress } from '../skills/getMyAddress';
import { manageCustomTokensDefinition, executeManageCustomTokens } from '../skills/manageCustomTokens';
import { getTxHistoryToolDefinition, getTxHistory } from '../skills/getTxHistory';
import { transferToolDefinition, prepareTransfer } from '../skills/transfer';

export class Web3WalletPlugin implements Plugin {
  public name = 'Web3WalletPlugin';
  public description = 'Core wallet and transaction operations including transfer, custom tx, and history.';
  public version = '1.0.1';

  public tools = [
    transferToolDefinition,
    mintNftToolDefinition,
    customTxToolDefinition,
    checkAddressToolDefinition,
    getMyAddressToolDefinition,
    manageCustomTokensDefinition,
    getTxHistoryToolDefinition
  ];

  public handlers = {
    ['transfer_token']: async (args: any) => {
      return await prepareTransfer(args.chainName, args.toAddress, args.amountStr || args.amountEth, args.token);
    },
    ['transfer_native']: async (args: any) => {
      return await prepareTransfer(args.chainName, args.toAddress, args.amountStr || args.amountEth, args.token);
    },
    [mintNftToolDefinition.function.name]: async (args: any) => {
      return await prepareMintNft(args.chainName, args.contractAddress, args.functionSignature, args.argsStr, args.valueEth);
    },
    [customTxToolDefinition.function.name]: async (args: any) => {
      return await prepareCustomTx(args.chainName, args.toAddress, args.dataHex, args.valueEth, args.gasLimitStr);
    },
    [checkAddressToolDefinition.function.name]: async (args: any) => {
      return await checkAddress(args.chainName, args.address);
    },
    [getMyAddressToolDefinition.function.name]: async (args: any) => {
      return await getMyAddress();
    },
    [manageCustomTokensDefinition.function.name]: async (args: any) => {
      return await executeManageCustomTokens(args);
    },
    [getTxHistoryToolDefinition.function.name]: async (args: any) => {
      return await getTxHistory(args.chainName, args.address, args.days);
    }
  };
}
