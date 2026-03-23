"use client";

import { Contract, type InterfaceAbi } from "ethers";
import { ADDRESSES } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";
import { useWeb3 } from "@/contexts/Web3Context";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export function useTeamData(userAddress?: string) {
  const { readProvider } = useWeb3();

  const memePlus = useMemo(
    () => new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, readProvider),
    [readProvider]
  );

  const { data } = useQuery({
    queryKey: ["teamData", userAddress],
    queryFn: async () => {
      if (!userAddress) return null;

      const [team, member, directRefs] = await Promise.all([
        memePlus.getTeamInfo(userAddress),
        memePlus.getMemberInfo(userAddress),
        memePlus.getDirectReferrals(userAddress),
      ]);

      const refs = directRefs as string[];

      // Fetch V1-V6 thresholds + V7 threshold
      const thresholdPromises = [0, 1, 2, 3, 4, 5].map((i) =>
        memePlus.vLevelThresholds(BigInt(i)).catch(() => 0n)
      );
      const [thresholds, v7Threshold] = await Promise.all([
        Promise.all(thresholdPromises),
        memePlus.vLevelThreshold7().catch(() => 0n),
      ]);

      // Build full threshold array: V1-V7 (index 0=V1, ..., 6=V7)
      const allThresholds = [...thresholds, v7Threshold].map((t) =>
        t !== undefined ? BigInt(t) : 0n
      );

      // Fetch referral infos (up to 20)
      const limited = refs.slice(0, 20);
      let referralInfos: unknown[] = [];
      if (limited.length > 0) {
        referralInfos = await Promise.all(
          limited.map((addr: string) =>
            memePlus.getMemberInfo(addr).catch(() => null)
          )
        );
      }

      return {
        teamInfo: team,
        memberInfo: member,
        directReferralAddresses: refs,
        allThresholds,
        referralInfos,
      };
    },
    enabled: !!userAddress,
  });

  // Parse team info
  const teamInfo = data?.teamInfo;
  const memberInfo = data?.memberInfo;
  const directReferralAddresses = data?.directReferralAddresses ?? [];
  const allThresholds = data?.allThresholds ?? [];
  const referralInfos = data?.referralInfos ?? [];

  const teamPerf = teamInfo ? BigInt(teamInfo[0]) : 0n;
  const smallZonePerf = teamInfo ? BigInt(teamInfo[1]) : 0n;
  const directCount = teamInfo ? Number(teamInfo[2]) : 0;
  const vLevel = teamInfo ? Number(teamInfo[3]) : 0;

  const largeZone = teamPerf - smallZonePerf;
  // Next threshold: V1 at index 0 ... V7 at index 6
  const nextVLevelThreshold =
    vLevel < 7 ? (allThresholds[vLevel] ?? 0n) : 0n;

  const limitedReferrals = directReferralAddresses.slice(0, 20);
  const referrals = limitedReferrals.map((addr: string, i: number) => {
    const info = referralInfos[i] as readonly unknown[] | null | undefined;
    return {
      address: addr,
      invested: info ? BigInt(info[7] as bigint | number | string) : 0n,
      isActive: Boolean(info?.[3]),
    };
  });

  const communityLevel = memberInfo ? Number(memberInfo[2]) : 0;
  const referrer = memberInfo ? (memberInfo[0] as string) : undefined;

  return {
    referrer,
    vLevel,
    communityLevel,
    directReferrals: directCount,
    totalPerformance: teamPerf,
    largeZone,
    smallZone: smallZonePerf,
    nextVLevelThreshold,
    allThresholds,
    referrals,
    totalReferralCount: directReferralAddresses.length,
  };
}
