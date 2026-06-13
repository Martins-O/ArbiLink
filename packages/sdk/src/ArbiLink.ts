import { ethers } from 'ethers';
import MessageHubABI from './abi/MessageHub.json';
import { MESSAGE_HUB_ADDRESS } from './constants';
import { ArbiLinkError, type Message, type MessageStatus, type RelayerInfo, type SendMessageParams, type WatchOptions } from './types';
import { parseStatusCode, resolveChainId } from './utils';

// ── ArbiLink SDK ──────────────────────────────────────────────────────────────

/**
 * ArbiLink SDK — send cross-chain messages from Arbitrum to any supported chain.
 *
 * @example
 * ```typescript
 * // With a signer (full read/write access)
 * const arbiLink = new ArbiLink(signer);
 *
 * // With a provider (read-only: getMessageStatus)
 * const arbiLink = new ArbiLink(provider);
 * ```
 */
export class ArbiLink {
  private readonly provider: ethers.Provider;
  private readonly signer: ethers.Signer | null;
  private readonly messageHub: ethers.Contract;
  private readonly iface: ethers.Interface;

  constructor(signerOrProvider: ethers.Signer | ethers.Provider) {
    const isSigner = typeof (signerOrProvider as ethers.Signer).getAddress === 'function';

    if (isSigner) {
      this.signer = signerOrProvider as ethers.Signer;
      const p = this.signer.provider;
      if (!p) throw new ArbiLinkError('Signer has no attached provider. Connect your signer to a network first.');
      this.provider = p;
    } else {
      this.signer   = null;
      this.provider = signerOrProvider as ethers.Provider;
    }

    this.iface = new ethers.Interface(MessageHubABI);

    this.messageHub = new ethers.Contract(
      MESSAGE_HUB_ADDRESS,
      MessageHubABI,
      isSigner ? this.signer! : this.provider,
    );
  }

  // ── Core: send ─────────────────────────────────────────────────────────────

  /**
   * Send a cross-chain message from Arbitrum to any supported chain.
   *
   * @returns The message ID assigned by the hub.
   *
   * @example
   * ```typescript
   * const arbiLink = new ArbiLink(signer);
   *
   * const messageId = await arbiLink.sendMessage({
   *   to: 'ethereum',
   *   target: '0x742d35Cc6634C0532925a3b844BC454e4438f44e',
   *   data: encodeCall({
   *     abi: myABI,
   *     functionName: 'mint',
   *     args: [recipient, amount],
   *   }),
   * });
   *
   * console.log('Sent:', formatMessageId(messageId)); // → "#000001"
   * ```
   */
  async sendMessage(params: SendMessageParams): Promise<bigint> {
    this.requireSigner();

    const chainId = resolveChainId(params.to);
    if (!params.fee) throw new ArbiLinkError('fee is required. Provide the fee in wei (call calculateFee or fetch from hub config).');

    let tx: ethers.TransactionResponse;
    try {
      tx = await this.messageHub.sendMessage(
        chainId,
        params.target,
        params.data,
        { value: params.fee },
      ) as ethers.TransactionResponse;
    } catch (err) {
      throw ArbiLinkError.from(err, `Failed to send message to chain ${chainId}`);
    }

    const receipt = await tx.wait();
    if (!receipt) throw new ArbiLinkError('Transaction receipt is null – the tx may have been dropped');

    for (const log of receipt.logs) {
      try {
        const parsed = this.iface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === 'MessageSent') {
          return parsed.args.messageId as bigint;
        }
      } catch {
        // Log from a different contract – skip
      }
    }

    throw new ArbiLinkError(
      'MessageSent event not found in receipt. The transaction may have succeeded but used an unexpected hub version.',
    );
  }

  // ── Core: status ───────────────────────────────────────────────────────────

  /**
   * Query the current status and metadata of a message.
   *
   * @example
   * ```typescript
   * const msg = await arbiLink.getMessageStatus(messageId);
   * console.log(msg.status);           // 'pending' | 'relayed' | 'failed'
   * console.log(msg.destinationChain); // 11155111
   * ```
   */
  async getMessageStatus(messageId: bigint): Promise<Message> {
    try {
      const statusCode = await this.messageHub.getMessageStatus(messageId) as bigint;
      const status: MessageStatus = parseStatusCode(Number(statusCode));

      const sentFilter = this.messageHub.filters['MessageSent'](messageId);
      const sentLogs   = await this.messageHub.queryFilter(sentFilter);

      let sender: string | undefined;
      let destinationChain: number | undefined;
      let target: string | undefined;
      let data: string | undefined;
      let feePaid: bigint | undefined;

      if (sentLogs.length > 0) {
        const e = sentLogs[0] as ethers.EventLog;
        sender           = e.args.sender           as string;
        destinationChain = Number(e.args.destinationChain);
        target           = e.args.target           as string;
        data             = e.args.data             as string;
        feePaid          = e.args.fee              as bigint;
      }

      return {
        id: messageId,
        status,
        sender,
        destinationChain,
        target,
        data,
        feePaid,
      };
    } catch (err) {
      throw ArbiLinkError.from(err, `Failed to fetch status for message #${messageId}`);
    }
  }

  // ── Core: watch ────────────────────────────────────────────────────────────

  /**
   * Subscribe to status changes for a given message by polling.
   *
   * The callback fires whenever the message status changes. Call the returned
   * function to unsubscribe.
   *
   * @example
   * ```typescript
   * const unwatch = arbiLink.watchMessage(messageId, (msg) => {
   *   console.log('Update:', msg.status);
   *   if (msg.status === 'relayed' || msg.status === 'failed') unwatch();
   * });
   * ```
   */
  watchMessage(
    messageId: bigint,
    callback: (message: Message) => void,
    _options: WatchOptions = {},
  ): () => void {
    const filter = this.messageHub.filters['MessageSent'](messageId);

    const listener = async (): Promise<void> => {
      try {
        const msg = await this.getMessageStatus(messageId);
        callback(msg);
      } catch (err) {
        console.error('[ArbiLink] watchMessage error:', err);
      }
    };

    this.messageHub.on(filter, listener);

    return () => {
      this.messageHub.off(filter, listener);
    };
  }

  // ── Relayer helpers ────────────────────────────────────────────────────────

  /**
   * Register the signer as a relayer by staking the required ETH.
   * Fetches the minimum stake from the hub automatically.
   *
   * @param stakeOverride - Override the minimum stake amount (wei).
   */
  async registerRelayer(stakeOverride?: bigint): Promise<void> {
    this.requireSigner();

    const stake = stakeOverride ?? await this.messageHub.minStake() as bigint;

    const tx = await this.messageHub.registerRelayer({ value: stake }) as ethers.TransactionResponse;
    await tx.wait();
  }

  /**
   * Withdraw the signer's relayer stake and deregister.
   */
  async exitRelayer(): Promise<void> {
    this.requireSigner();
    const tx = await this.messageHub.exitRelayer() as ethers.TransactionResponse;
    await tx.wait();
  }

  // ── Hub info ───────────────────────────────────────────────────────────────

  /**
   * Minimum stake (wei) required to register as a relayer.
   */
  async minStake(): Promise<bigint> {
    return await this.messageHub.minStake() as bigint;
  }

  /**
   * Fetch relayer info: active status and stake amount.
   */
  async getRelayerInfo(address: string): Promise<RelayerInfo> {
    const [active, stake] =
      await this.messageHub.getRelayerInfo(address) as [boolean, bigint];
    return { active, stake };
  }

  /**
   * Withdraw accumulated protocol fees. Only callable by the hub owner.
   */
  async withdrawProtocolFees(): Promise<void> {
    this.requireSigner();
    const tx = await this.messageHub.withdrawProtocolFees() as ethers.TransactionResponse;
    await tx.wait();
  }

  /**
   * Fetch the protocol fee balance (wei).
   */
  async protocolFeeBalance(): Promise<bigint> {
    return await this.messageHub.protocolFeeBalance() as bigint;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private requireSigner(): void {
    if (!this.signer) {
      throw new ArbiLinkError(
        'This operation requires a Signer. Initialize ArbiLink with an ethers.Signer instead of a Provider.',
      );
    }
  }
}
