"use client";

import { Contract, formatUnits, type InterfaceAbi } from "ethers";
import { ADDRESSES, USDT_DECIMALS } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";
import { useWeb3 } from "@/contexts/Web3Context";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface IncomeRecord {
  name: string;
  amount: string;
  timestamp: number;
  txHash: string;
  source: string; // address that triggered the income, or "系統" for system rewards
}

const BLOCK_RANGE = 50000; // ~2 days on BSC
const BATCH_SIZE = 10; // Max concurrent block timestamp fetches

// Module-level cache persists across re-renders and remounts
const globalBlockTimestampCache = new Map<number, number>();

// Helper: fetch block timestamps in controlled batches to avoid RPC rate limits
async function fetchBlockTimestamps(
  blockNumbers: number[],
  provider: { getBlock: (bn: number) => Promise<{ timestamp: number } | null> }
): Promise<void> {
  for (let i = 0; i < blockNumbers.length; i += BATCH_SIZE) {
    const batch = blockNumbers.slice(i, i + BATCH_SIZE);
    const blocks = await Promise.all(
      batch.map((bn) => provider.getBlock(bn))
    );
    for (let j = 0; j < batch.length; j++) {
      globalBlockTimestampCache.set(batch[j], blocks[j]?.timestamp ?? 0);
    }
  }
}

type LogEntry = { blockNumber: number; transactionHash: string; args: Record<string, unknown> };

export function useIncomeRecords(userAddress?: string) {
  const { readProvider } = useWeb3();
  const queryClient = useQueryClient();

  const memePlus = useMemo(
    () => new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, readProvider),
    [readProvider]
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["incomeRecords", userAddress],
    queryFn: async (): Promise<IncomeRecord[]> => {
      if (!userAddress || !readProvider) return [];
      const currentBlock = await readProvider.getBlockNumber();
      const fromBlock = Math.max(currentBlock - BLOCK_RANGE, 0);

      const [dailyLogs, referralLogs, teamLogs, withdrawnLogs, mmClaimLogs] =
        await Promise.all([
          memePlus.queryFilter(memePlus.filters.DailyReturnClaimed(userAddress), fromBlock, currentBlock),
          memePlus.queryFilter(memePlus.filters.ReferralRewardPaid(null, userAddress), fromBlock, currentBlock),
          memePlus.queryFilter(memePlus.filters.TeamRewardPaid(null, userAddress), fromBlock, currentBlock),
          memePlus.queryFilter(memePlus.filters.Withdrawn(userAddress), fromBlock, currentBlock),
          memePlus.queryFilter(memePlus.filters.MMCompensationClaimed(userAddress), fromBlock, currentBlock),
        ]);

      // Collect all unique block numbers that need timestamps
      const allLogs = [...dailyLogs, ...referralLogs, ...teamLogs, ...withdrawnLogs, ...mmClaimLogs];
      const uniqueBlocks: number[] = [];
      for (const log of allLogs) {
        if (!globalBlockTimestampCache.has(log.blockNumber)) {
          uniqueBlocks.push(log.blockNumber);
        }
      }
      // Deduplicate
      const dedupedBlocks = [...new Set(uniqueBlocks)];

      // Batch fetch all missing block timestamps
      if (dedupedBlocks.length > 0) {
        await fetchBlockTimestamps(dedupedBlocks, readProvider);
      }

      const getTimestamp = (blockNumber: number): number =>
        globalBlockTimestampCache.get(blockNumber) ?? 0;

      const allRecords: IncomeRecord[] = [];

      for (const log of dailyLogs as unknown[] as LogEntry[]) {
        allRecords.push({
          name: "DeFi",
          amount: formatUnits(BigInt(log.args.totalReturn as bigint), USDT_DECIMALS),
          timestamp: getTimestamp(log.blockNumber),
          txHash: log.transactionHash,
          source: "系統",
        });
      }

      for (const log of referralLogs as unknown[] as LogEntry[]) {
        allRecords.push({
          name: `推薦獎勵 G${log.args.generation}`,
          amount: formatUnits(BigInt(log.args.amount as bigint), USDT_DECIMALS),
          timestamp: getTimestamp(log.blockNumber),
          txHash: log.transactionHash,
          source: log.args.investor as string,
        });
      }

      for (const log of teamLogs as unknown[] as LogEntry[]) {
        const rewardType = BigInt(log.args.rewardType as bigint);
        const typeLabel =
          rewardType === 1n ? "級差" : rewardType === 2n ? "平級" : "團隊";
        allRecords.push({
          name: `${typeLabel}獎勵`,
          amount: formatUnits(BigInt(log.args.amount as bigint), USDT_DECIMALS),
          timestamp: getTimestamp(log.blockNumber),
          txHash: log.transactionHash,
          source: log.args.investor as string,
        });
      }

      for (const log of withdrawnLogs as unknown[] as LogEntry[]) {
        allRecords.push({
          name: "提現",
          amount: `-${formatUnits(BigInt(log.args.grossAmount as bigint), USDT_DECIMALS)}`,
          timestamp: getTimestamp(log.blockNumber),
          txHash: log.transactionHash,
          source: "自己",
        });
      }

      for (const log of mmClaimLogs as unknown[] as LogEntry[]) {
        allRecords.push({
          name: "BCK領取",
          amount: formatUnits(BigInt(log.args.amount as bigint), USDT_DECIMALS),
          timestamp: getTimestamp(log.blockNumber),
          txHash: log.transactionHash,
          source: "系統",
        });
      }

      allRecords.sort((a, b) => b.timestamp - a.timestamp);
      return allRecords;
    },
    enabled: !!userAddress,
    staleTime: 60_000,
    refetchInterval: 120_000,
    placeholderData: (previousData) => previousData,
  });

  return {
    records: data ?? [],
    isLoading,
    isError,
    refetch: () =>
      queryClient.invalidateQueries({ queryKey: ["incomeRecords", userAddress] }),
  };
}
