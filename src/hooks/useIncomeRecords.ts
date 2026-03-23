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
}

const BLOCK_RANGE = 50000; // ~2 days on BSC

export function useIncomeRecords(userAddress?: string) {
  const { readProvider } = useWeb3();
  const queryClient = useQueryClient();

  const memePlus = useMemo(
    () => new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, readProvider),
    [readProvider]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["incomeRecords", userAddress],
    queryFn: async () => {
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

      const allRecords: IncomeRecord[] = [];
      const blockCache = new Map<number, number>();

      const getBlockTimestamp = async (blockNumber: number): Promise<number> => {
        if (blockCache.has(blockNumber)) return blockCache.get(blockNumber)!;
        const block = await readProvider.getBlock(blockNumber);
        const ts = block?.timestamp ?? 0;
        blockCache.set(blockNumber, ts);
        return ts;
      };

      const getArgs = <T,>(log: unknown) => (log as { args: T }).args;

      for (const log of dailyLogs) {
        const ts = await getBlockTimestamp(log.blockNumber);
        const args = getArgs<{ totalReturn: bigint }>(log);
        allRecords.push({
          name: "DeFi",
          amount: formatUnits(args.totalReturn, USDT_DECIMALS),
          timestamp: ts,
          txHash: log.transactionHash,
        });
      }

      for (const log of referralLogs) {
        const ts = await getBlockTimestamp(log.blockNumber);
        const args = getArgs<{ generation: bigint; amount: bigint }>(log);
        allRecords.push({
          name: `推薦獎勵 G${args.generation}`,
          amount: formatUnits(args.amount, USDT_DECIMALS),
          timestamp: ts,
          txHash: log.transactionHash,
        });
      }

      for (const log of teamLogs) {
        const ts = await getBlockTimestamp(log.blockNumber);
        const args = getArgs<{ rewardType: bigint; amount: bigint }>(log);
        const typeLabel =
          args.rewardType === 1n ? "級差" : args.rewardType === 2n ? "平級" : "團隊";
        allRecords.push({
          name: `${typeLabel}獎勵`,
          amount: formatUnits(args.amount, USDT_DECIMALS),
          timestamp: ts,
          txHash: log.transactionHash,
        });
      }

      for (const log of withdrawnLogs) {
        const ts = await getBlockTimestamp(log.blockNumber);
        const args = getArgs<{ grossAmount: bigint }>(log);
        allRecords.push({
          name: "提現",
          amount: `-${formatUnits(args.grossAmount, USDT_DECIMALS)}`,
          timestamp: ts,
          txHash: log.transactionHash,
        });
      }

      for (const log of mmClaimLogs) {
        const ts = await getBlockTimestamp(log.blockNumber);
        const args = getArgs<{ amount: bigint }>(log);
        allRecords.push({
          name: "BCK領取",
          amount: formatUnits(args.amount, USDT_DECIMALS),
          timestamp: ts,
          txHash: log.transactionHash,
        });
      }

      allRecords.sort((a, b) => b.timestamp - a.timestamp);
      return allRecords;
    },
    enabled: !!userAddress,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    records: data ?? [],
    isLoading,
    refetch: () =>
      queryClient.invalidateQueries({ queryKey: ["incomeRecords", userAddress] }),
  };
}
