"use client";

import { Contract, type InterfaceAbi } from "ethers";
import { ADDRESSES } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";
import { useWeb3 } from "@/contexts/Web3Context";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export function useDynamicBonus(userAddress?: string) {
  const { readProvider } = useWeb3();

  const memePlus = useMemo(
    () => new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, readProvider),
    [readProvider]
  );

  // Config data (rarely changes - admin-set parameters)
  const { data: configData } = useQuery({
    queryKey: ["dynamicBonus", "config"],
    queryFn: async () => {
      const [g1, g2, refShare, teamShare, slBonus] = await Promise.all([
        memePlus.referralGen1(),
        memePlus.referralGen2(),
        memePlus.referralSharePercent(),
        memePlus.teamSharePercent(),
        memePlus.sameLevelBonus(),
      ]);
      const refShareNum = Number(refShare);
      const gen1Raw = Number(g1);
      const gen2Raw = Number(g2);
      // 计算绝对比例: genRate * referralSharePercent / 10000
      // 例如 50% of 20% pool = 10% 绝对
      const gen1Effective = (gen1Raw * refShareNum) / 10000;
      const gen2Effective = (gen2Raw * refShareNum) / 10000;
      return {
        gen1Effective,
        gen2Effective,
        referralShareBps: refShareNum,
        teamShareBps: Number(teamShare),
        sameLevelBonusBps: Number(slBonus),
      };
    },
    staleTime: 300_000,
    refetchInterval: 300_000,
    enabled: !!readProvider,
  });

  // User-specific data
  const { data: userData } = useQuery({
    queryKey: ["dynamicBonus", "user", userAddress],
    queryFn: async () => {
      const teamInfo = await memePlus.getTeamInfo(userAddress);
      return {
        teamPerformance: BigInt(teamInfo.teamPerf),
      };
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: !!userAddress && !!readProvider,
  });

  return {
    referralRewards: [
      {
        gen: 1,
        rateBps: configData?.gen1Effective ?? 1000,
        rateDisplay: `${((configData?.gen1Effective ?? 1000) / 100).toFixed(0)}%`,
      },
      {
        gen: 2,
        rateBps: configData?.gen2Effective ?? 1000,
        rateDisplay: `${((configData?.gen2Effective ?? 1000) / 100).toFixed(0)}%`,
      },
    ],
    referralShareBps: configData?.referralShareBps ?? 2000,
    teamShareBps: configData?.teamShareBps ?? 7000,
    sameLevelBonusBps: configData?.sameLevelBonusBps ?? 1000,
    teamPerformance: userData?.teamPerformance ?? 0n,
  };
}
