import { useEffect, useState, useRef } from 'react'
import { JsonRpcProvider, Contract } from 'ethers'
import type { Message } from '@/components/MessageCard'
import { MessageHubABI, MESSAGE_HUB_ADDRESS } from '@arbilink/sdk'

const ARBITRUM_SEPOLIA_RPC = import.meta.env.VITE_INFURA_KEY
  ? `https://arbitrum-sepolia.infura.io/v3/${import.meta.env.VITE_INFURA_KEY}`
  : 'https://sepolia-rollup.arbitrum.io/rpc'

const LOOK_BACK_BLOCKS = 50_000
const POLL_MS = 30_000

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading,  setLoading]  = useState(false)
  const [isLive,   setIsLive]   = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setIsLive(true)

    const provider = new JsonRpcProvider(ARBITRUM_SEPOLIA_RPC)
    const hub      = new Contract(MESSAGE_HUB_ADDRESS, MessageHubABI, provider)

    async function fetchMessages() {
      try {
        setLoading(true)

        const currentBlock = await provider.getBlockNumber()
        const fromBlock = Math.max(0, currentBlock - LOOK_BACK_BLOCKS)

        const sentEvents = await hub.queryFilter(hub.filters.MessageSent(), fromBlock)

        // Fetch block timestamps for sent events (batch unique blocks)
        const uniqueBlocks = [...new Set(sentEvents.map((e: any) => e.blockNumber))]
        const blockData    = await Promise.all(uniqueBlocks.map(n => provider.getBlock(n)))
        const blockTs      = new Map<number, number>(
          blockData.map((b, i) => [uniqueBlocks[i], b?.timestamp ?? 0])
        )

        const msgs: Message[] = []
        for (const e of sentEvents) {
          let status: number
          try {
            status = Number(await hub.getMessageStatus(e.args.messageId))
          } catch {
            status = 0
          }
          msgs.push({
            id:               e.args.messageId  as bigint,
            sender:           e.args.sender     as string,
            destinationChain: Number(e.args.destinationChain),
            target:           e.args.target     as string,
            status:           status === 0 ? 'pending' : status === 3 ? 'failed' : 'relayed',
            feePaid:          e.args.fee as bigint,
            timestamp:        blockTs.get(e.blockNumber) ?? 0,
            demo:             'Cross-chain',
            txHash:           e.transactionHash as string,
          })
        }
        msgs.reverse()

        setMessages(msgs)
      } catch (err) {
        console.error('[Explorer] Failed to fetch live messages:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
    intervalRef.current = setInterval(fetchMessages, POLL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { messages, loading, isLive }
}
