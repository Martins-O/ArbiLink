import { ethers } from 'ethers';
import MessageHubABI from './abi/MessageHub.json';
import { MESSAGE_HUB_ADDRESS } from './constants';
import { ArbiLinkError, type Message, type MessageStatus, type SendMessageParams, type WatchOptions } from './types';
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
 * // With a provider (read-only: getMessageStatus, calculateFee)
 * const arbiLink = new ArbiLink(provider);
 * ```
 */
export class ArbiLink {
  private readonly provider: ethers.Provider;
  private readonly signer: ethers.Signer | null;
  private readonly messageHub: ethers.Contract;
  private readonly iface: ethers.Interface;

  constructor(signerOrProvider: ethers.Signer | ethers.Provider) {
    // Distinguish signer from provider: signers expose `getAddress()`
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
    const fee     = params.fee ?? await this.calculateFee(chainId);

    let tx: ethers.TransactionResponse;
    try {
      tx = await this.messageHub.sendMessage(
        chainId,
        params.target,
        params.data,
        { value: fee },
      ) as ethers.TransactionResponse;
    } catch (err) {
      throw ArbiLinkError.from(err, `Failed to send message to chain ${chainId}`);
    }

    const receipt = await tx.wait();
    if (!receipt) throw new ArbiLinkError('Transaction receipt is null – the tx may have been dropped');

    // Parse MessageSent event to extract the assigned message ID
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
   * Fetches the status code from the hub and enriches it with data from
   * `MessageSent` and `MessageConfirmed` event logs.
   *
   * @example
   * ```typescript
   * const msg = await arbiLink.getMessageStatus(messageId);
   * console.log(msg.status);           // 'pending' | 'confirmed'
   * console.log(msg.destinationChain); // 11155111
   * ```
   */
  async getMessageStatus(messageId: bigint): Promise<Message> {
    try {
      const statusCode = await this.messageHub.getMessageStatus(messageId) as bigint;
      const status: MessageStatus = parseStatusCode(Number(statusCode));

      // Enrich from MessageSent event
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

      // Enrich from MessageConfirmed event (present only when confirmed)
      let relayer: string | undefined;
      if (status === 'confirmed' || status === 'relayed') {
        const confirmedFilter = this.messageHub.filters['MessageConfirmed'](messageId);
        const confirmedLogs   = await this.messageHub.queryFilter(confirmedFilter);
        if (confirmedLogs.length > 0) {
          relayer = (confirmedLogs[0] as ethers.EventLog).args.relayer as string;
        }
      }

      return {
        id: messageId,
        status,
        sender,
        destinationChain,
        target,
        data,
        feePaid,
        relayer,
      };
    } catch (err) {
      throw ArbiLinkError.from(err, `Failed to fetch status for message #${messageId}`);
    }
  }

  // ── Core: fee ──────────────────────────────────────────────────────────────

  /**
   * Fetch the base fee (in wei) required to send a message to `chainId`.
   *
   * @example
   * ```typescript
   * const fee = await arbiLink.calculateFee(11155111);
   * console.log(formatEth(fee)); // "0.001 ETH"
   * ```
   */
  async calculateFee(chainId: number): Promise<bigint> {
    try {
      return await this.messageHub.calculateFee(chainId) as bigint;
    } catch (err) {
      throw ArbiLinkError.from(err, `Failed to fetch fee for chain ${chainId}`);
    }
  }

  // ── Core: watch ────────────────────────────────────────────────────────────

  /**
   * Subscribe to confirmation events for a given message.
   *
   * The callback fires when a `MessageConfirmed` event is emitted for this
   * message ID. Call the returned function to unsubscribe.
   *
   * @example
   * ```typescript
   * const unwatch = arbiLink.watchMessage(messageId, (msg) => {
   *   console.log('Update:', msg.status);
   *   if (msg.status === 'confirmed') unwatch();
   * });
   * ```
   */
  watchMessage(
    messageId: bigint,
    callback: (message: Message) => void,
    _options: WatchOptions = {},
  ): () => void {
    const confirmedFilter = this.messageHub.filters['MessageConfirmed'](messageId);

    const listener = async (): Promise<void> => {
      try {
        const msg = await this.getMessageStatus(messageId);
        callback(msg);
      } catch (err) {
        // Surface the error through the callback rather than throwing from
        // an event listener (which would be silently swallowed by ethers)
        console.error('[ArbiLink] watchMessage error:', err);
      }
    };

    this.messageHub.on(confirmedFilter, listener);

    return () => {
      this.messageHub.off(confirmedFilter, listener);
    };
  }

  // ── Relayer helpers ────────────────────────────────────────────────────────

  /**
   * Check whether `address` is a registered, active relayer.
   */
  async isActiveRelayer(address: string): Promise<boolean> {
    return await this.messageHub.isActiveRelayer(address) as boolean;
  }

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
   * Total number of messages sent through the hub.
   */
  async messageCount(): Promise<bigint> {
    return await this.messageHub.messageCount() as bigint;
  }

  /**
   * The hub owner address.
   */
  async owner(): Promise<string> {
    return await this.messageHub.owner() as string;
  }

  /**
   * Minimum stake (wei) required to register as a relayer.
   */
  async minStake(): Promise<bigint> {
    return await this.messageHub.minStake() as bigint;
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
