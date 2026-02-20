import { useEffect, useState, useRef } from 'react'
import { JsonRpcProvider, Contract } from 'ethers'
import type { MockMessage } from '@/components/MessageCard'
import MessageHubABI from '../../../sdk/src/abi/MessageHub.json'
import { MESSAGE_HUB_ADDRESS, ARBITRUM_SEPOLIA_RPC } from '@arbilink/sdk'

const LOOK_BACK_BLOCKS = 50_000
const POLL_MS = 30_000

function deriveStatus(
  idStr: string,
  confirmedIds: Set<string>,
  failedIds: Set<string>,
  confirmTimestamps: Map<string, number>,
  challengePeriod: number,
  now: number,
): MockMessage['status'] {
  if (failedIds.has(idStr)) return 'failed'
  if (confirmedIds.has(idStr)) {
    const ts = confirmTimestamps.get(idStr) ?? 0
    return now - ts > challengePeriod ? 'confirmed' : 'relayed'
  }
  return 'pending'
}

export function useMessages(mockMessages: MockMessage[]) {
  const [messages, setMessages] = useState<MockMessage[]>(mockMessages)
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
        // challenge_period has no on-chain getter; use the deployment value
        const cp = 300 // 5 minutes, matches initialize() call

        const fromBlock = Math.max(0, currentBlock - LOOK_BACK_BLOCKS)

        const [sentEvents, confirmedEvents] = await Promise.all([
          hub.queryFilter(hub.filters.MessageSent(),      fromBlock),
          hub.queryFilter(hub.filters.MessageConfirmed(), fromBlock),
        ])

        // Overlay maps
        const confirmedIds      = new Set(confirmedEvents.map((e: any) => e.args.messageId.toString()))
        const failedIds         = new Set<string>() // no challenge mechanism on-chain yet
        const confirmTimestamps = new Map<string, number>(
          confirmedEvents.map((e: any) => [e.args.messageId.toString(), Number(e.args.timestamp)])
        )

        // Fetch block timestamps for sent events (batch unique blocks)
        const uniqueBlocks = [...new Set(sentEvents.map((e: any) => e.blockNumber))]
        const blockData    = await Promise.all(uniqueBlocks.map(n => provider.getBlock(n)))
        const blockTs      = new Map<number, number>(
          blockData.map((b, i) => [uniqueBlocks[i], b?.timestamp ?? 0])
        )

        const now = Math.floor(Date.now() / 1000)

        const msgs: MockMessage[] = sentEvents
          .map((e: any) => ({
            id:               e.args.messageId  as bigint,
            sender:           e.args.sender     as string,
            destinationChain: Number(e.args.destinationChain),
            target:           e.args.target     as string,
            status:           deriveStatus(
              e.args.messageId.toString(),
              confirmedIds, failedIds, confirmTimestamps, cp, now, // cp is the hardcoded 300s above
            ),
            feePaid:   e.args.fee as bigint,
            timestamp: blockTs.get(e.blockNumber) ?? 0,
            demo:      'Cross-chain',
          }))
          .reverse()

        setMessages(msgs)
      } catch (err) {
        console.error('[Explorer] Failed to fetch live messages:', err)
        // keep showing whatever we had before
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
