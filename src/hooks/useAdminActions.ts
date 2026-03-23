"use client";

import { Contract, keccak256, toUtf8Bytes, type InterfaceAbi } from "ethers";
import { ADDRESSES } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";
import { useWeb3 } from "@/contexts/Web3Context";
import { useState, useEffect, useCallback, useMemo } from "react";

// Hardcoded: keccak256("ADMIN_ROLE") — matches Modifiers.sol constant
// The ADMIN_ROLE() getter selector is not registered on the Diamond
const ADMIN_ROLE = keccak256(toUtf8Bytes("ADMIN_ROLE"));

export function useAdminActions(userAddress?: string) {
  const { signer, readProvider } = useWeb3();
  const address = userAddress;

  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const memePlus = useMemo(() => {
    return new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, readProvider);
  }, [readProvider]);

  const fetchAdmin = useCallback(async () => {
    if (!address || !readProvider) return;
    try {
      const owner = await memePlus.owner();
      const hasAdminRole = await memePlus.hasRole(ADMIN_ROLE, address);
      setIsAdmin(hasAdminRole);
      setIsOwner(address.toLowerCase() === (owner as string).toLowerCase());
    } catch (e) {
      console.error("fetchAdmin error:", e);
    }
  }, [address, memePlus]);

  useEffect(() => {
    fetchAdmin();
  }, [fetchAdmin]);

  const write = async (functionName: string, args: readonly unknown[]) => {
    if (!signer) throw new Error("No signer");
    setIsPending(true);
    try {
      const memePlusWithSigner = new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, signer);
      const fn = (memePlusWithSigner as unknown as Record<string, (...a: readonly unknown[]) => Promise<{ wait: () => Promise<unknown>; hash: string }>>)[functionName];
      const tx = await fn(...args);
      await tx.wait();
      return tx.hash;
    } finally {
      setIsPending(false);
    }
  };

  return {
    isAdmin,
    isOwner,
    isPending,

    // Member management
    pauseMember: (member: string) => write("pauseMember", [member]),
    unpauseMember: (member: string) => write("unpauseMember", [member]),
    freezeMember: (member: string) => write("freezeMember", [member]),
    unfreezeMember: (member: string) => write("unfreezeMember", [member]),
    setCommunityLevel: (member: string, level: number) =>
      write("setCommunityLevel", [member, level]),
    setCommunityLevelBatch: (members: string[], levels: number[]) =>
      write("setCommunityLevelBatch", [members, levels]),
    setMemberVLevel: (member: string, level: number) =>
      write("setMemberVLevel", [member, level]),
    setMemberVLevelBatch: (members: string[], levels: number[]) =>
      write("setMemberVLevelBatch", [members, levels]),

    // Restart
    restartUser: (user: string) => write("restart", [user]),
    globalRestart: (users: string[]) => write("globalRestart", [users]),

    // Data clean
    purgeNonAdminData: () => write("purgeNonAdminData", []),

    // Contract control
    pause: () => write("pause", []),
    unpause: () => write("unpause", []),

    // Admin management (owner only)
    addAdmin: (account: string) => write("addAdmin", [account]),
    removeAdmin: (account: string) => write("removeAdmin", [account]),

    // Config setters
    setCapMultiplier: (val: number) => write("setCapMultiplier", [val]),
    setDailyReturnRate: (val: number) => write("setDailyReturnRate", [val]),
    setMinInvestment: (val: bigint) => write("setMinInvestment", [val]),
    setMinWithdrawal: (val: bigint) => write("setMinWithdrawal", [val]),
    setWithdrawalFee: (val: number) => write("setWithdrawalFee", [val]),
    setStaticDynamicSplit: (s: number, d: number) =>
      write("setStaticDynamicSplit", [s, d]),
    setReferralRates: (g1: number, g2: number, g3: number) =>
      write("setReferralRates", [g1, g2, g3]),
    setDynamicPoolSplit: (referral: number, team: number) =>
      write("setDynamicPoolSplit", [referral, team]),
    setStaticDistribution: (toBalance: number, toBurn: number, toLock: number) =>
      write("setStaticDistribution", [toBalance, toBurn, toLock]),
    setVLevelRates: (rates: number[]) => write("setVLevelRates", [rates]),
    setVLevelThresholds: (thresholds: bigint[]) => write("setVLevelThresholds", [thresholds]),
    setCommunityRates: (rates: number[]) => write("setCommunityRates", [rates]),
    setSameLevelBonus: (val: number) => write("setSameLevelBonus", [val]),
    setRestartReferralRate: (val: number) => write("setRestartReferralRate", [val]),
    setRestartReferralCap: (val: number) => write("setRestartReferralCap", [val]),
    setRestartMMCompPercent: (val: number) => write("setRestartMMCompPercent", [val]),
    setRestartMMReleaseRate: (val: number) => write("setRestartMMReleaseRate", [val]),
    setPerpetualBCKPercent: (val: number) => write("setPerpetualBCKPercent", [val]),
    setBCKPrice: (val: bigint) => write("setBCKPrice", [val]),

    // Owner-only setters
    setReceiverWallet: (addr: string) => write("setReceiverWallet", [addr]),
    setFeeCollector: (addr: string) => write("setFeeCollector", [addr]),

    // Token rescue
    rescueTokens: (token: string, amount: bigint) =>
      write("rescueTokens", [token, amount]),

    // Settlement
    settle: () => write("settle", []),

    // Batch claim
    batchClaimDailyReturn: (users: string[]) =>
      write("batchClaimDailyReturn", [users]),

    // Settle epoch + batch claim (one-step)
    settleAndBatchClaim: (users: string[]) =>
      write("settleAndBatchClaim", [users]),

    // Recalculate V-levels
    recalculateVLevels: (users: string[]) =>
      write("recalculateVLevels", [users]),
  };
}
