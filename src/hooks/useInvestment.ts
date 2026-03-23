"use client";

import { Contract, parseUnits, type InterfaceAbi } from "ethers";
import { ADDRESSES, USDT_DECIMALS } from "@/lib/contracts";
import { memePlusAbi, erc20Abi } from "@/lib/abi";
import { useWeb3 } from "@/contexts/Web3Context";
import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface ParsedOrder {
  id: number;
  amount: bigint;
  totalReturned: bigint;
  createdAt: number;
  lastClaimedAt: number;
  isActive: boolean;
  capLimit: bigint;
}

export function useInvestment(userAddress?: string) {
  const { signer, readProvider } = useWeb3();
  const queryClient = useQueryClient();

  const [isApproving, setIsApproving] = useState(false);
  const [isInvesting, setIsInvesting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const memePlus = useMemo(
    () => new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, readProvider),
    [readProvider]
  );
  const usdt = useMemo(
    () => new Contract(ADDRESSES.USDT, erc20Abi as InterfaceAbi, readProvider),
    [readProvider]
  );
  const mmToken = useMemo(
    () => new Contract(ADDRESSES.BCK_TOKEN, erc20Abi as InterfaceAbi, readProvider),
    [readProvider]
  );

  // Memoize signer-connected contract instances (avoid re-creating on every tx)
  const memePlusWrite = useMemo(
    () => signer ? new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, signer) : null,
    [signer]
  );
  const usdtWrite = useMemo(
    () => signer ? new Contract(ADDRESSES.USDT, erc20Abi as InterfaceAbi, signer) : null,
    [signer]
  );

  // User data query
  const { data: userData } = useQuery({
    queryKey: ["investment", "userData", userAddress],
    queryFn: async () => {
      if (!userAddress) return null;
      const [info, ords, registered, uBal, mBal, allow, tokenLock, mmRelease] =
        await Promise.all([
          memePlus.getMemberInfo(userAddress),
          memePlus.getOrders(userAddress),
          memePlus.isMemberRegistered(userAddress),
          usdt.balanceOf(userAddress),
          mmToken.balanceOf(userAddress),
          usdt.allowance(userAddress, ADDRESSES.MEMEPLUS),
          memePlus.getTokenLock(userAddress),
          memePlus.restartMMReleaseRate(),
        ]);
      return {
        memberInfo: info,
        orders: ords,
        isRegistered: registered as boolean,
        usdtBalance: uBal as bigint,
        mmBalance: mBal as bigint,
        allowance: allow as bigint,
        tokenLockResult: [BigInt(tokenLock[0]), BigInt(tokenLock[1]), Number(tokenLock[2])] as [bigint, bigint, number],
        restartMMRelease: Number(mmRelease),
      };
    },
    enabled: !!userAddress,
  });

  // Config query (changes less often)
  const { data: configData } = useQuery({
    queryKey: ["investment", "config"],
    queryFn: async () => {
      const [minInv, capMul, dailyRate, wFee] = await Promise.all([
        memePlus.minInvestment(),
        memePlus.capMultiplier(),
        memePlus.dailyReturnRate(),
        memePlus.withdrawalFee(),
      ]);
      return {
        minInvestment: minInv as bigint,
        capMultiplier: Number(capMul),
        dailyReturnRate: Number(dailyRate),
        withdrawalFeeBps: Number(wFee),
      };
    },
    staleTime: 300_000,
    refetchInterval: 300_000,
  });

  const config = configData ?? {
    minInvestment: parseUnits("100", USDT_DECIMALS),
    capMultiplier: 250,
    dailyReturnRate: 100,
    withdrawalFeeBps: 500,
  };

  // Parse member info
  const memberInfo = userData?.memberInfo;
  const balance = memberInfo ? BigInt(memberInfo[9]) : 0n;
  const totalInvested = memberInfo ? BigInt(memberInfo[7]) : 0n;
  const totalWithdrawn = memberInfo ? BigInt(memberInfo[8]) : 0n;
  const totalEarned = memberInfo ? BigInt(memberInfo[10]) : 0n;
  const isActive = memberInfo ? memberInfo[3] : false;
  const capLimit = config.capMultiplier
    ? (totalInvested * BigInt(config.capMultiplier)) / 100n
    : 0n;
  const capRemaining = capLimit > totalEarned ? capLimit - totalEarned : 0n;

  // BCK (Token Lock) calculations
  const tokenLockResult = userData?.tokenLockResult;
  const restartMMRelease = userData?.restartMMRelease ?? 100;
  const bckRemaining = tokenLockResult?.[0] ?? 0n;
  const bckOriginal = tokenLockResult?.[1] ?? 0n;
  const bckLockedAt = Number(tokenLockResult?.[2] ?? 0);
  const bckReleased = bckOriginal - bckRemaining;
  const bckUnreleased = bckRemaining;

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const bckElapsed = bckLockedAt > 0 ? nowSec - BigInt(bckLockedAt) : 0n;
  const bckDaysPassed = bckElapsed / 86400n;
  const bckTotalReleasable =
    bckOriginal > 0n
      ? ((bckOriginal * BigInt(restartMMRelease)) / 10000n) * bckDaysPassed
      : 0n;
  const bckTotalReleasableCapped =
    bckTotalReleasable > bckOriginal ? bckOriginal : bckTotalReleasable;
  const bckClaimable =
    bckTotalReleasableCapped > bckReleased
      ? bckTotalReleasableCapped - bckReleased
      : 0n;

  // Parse orders (memoized to avoid recomputation on every render)
  const parsedOrders = useMemo(
    () =>
      (userData?.orders || []).map((order: unknown, index: number) => {
        const o = order as {
          amount: bigint | number | string;
          totalReturned: bigint | number | string;
          createdAt: bigint | number | string;
          lastClaimedAt: bigint | number | string;
          isActive: boolean;
        };
        return {
        id: index + 1,
          amount: BigInt(o.amount),
          totalReturned: BigInt(o.totalReturned),
          createdAt: Number(o.createdAt),
          lastClaimedAt: Number(o.lastClaimedAt),
          isActive: o.isActive,
          capLimit: config.capMultiplier
            ? (BigInt(o.amount) * BigInt(config.capMultiplier)) / 100n
            : 0n,
        };
      }),
    [userData?.orders, config.capMultiplier]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["investment", "userData", userAddress] });
  }, [queryClient, userAddress]);

  // Approve USDT
  const approve = useCallback(async (amount: bigint) => {
    if (!usdtWrite) throw new Error("No signer");
    setIsApproving(true);
    try {
      const tx = await usdtWrite.approve(ADDRESSES.MEMEPLUS, amount);
      await tx.wait();
      return tx.hash;
    } finally {
      setIsApproving(false);
    }
  }, [usdtWrite]);

  // Invest
  const invest = useCallback(async (amount: number, referrer: string) => {
    if (!memePlusWrite) throw new Error("No signer");
    const amountWei = parseUnits(amount.toString(), USDT_DECIMALS);
    const refAddress = referrer || ZERO_ADDRESS;
    const currentAllowance = userData?.allowance ?? 0n;

    if (currentAllowance < amountWei) {
      await approve(amountWei);
      invalidate();
    }

    setIsInvesting(true);
    setIsConfirming(true);
    setIsConfirmed(false);
    try {
      const tx = await memePlusWrite.invest(amountWei, refAddress);
      await tx.wait();
      setIsConfirmed(true);
      setTimeout(invalidate, 3000);
      return tx.hash;
    } finally {
      setIsInvesting(false);
      setIsConfirming(false);
    }
  }, [memePlusWrite, userData?.allowance, approve, invalidate]);

  // Invest from income balance (no USDT approval needed)
  const investFromBalance = useCallback(async (amount: number, referrer: string) => {
    if (!memePlusWrite) throw new Error("No signer");
    const amountWei = parseUnits(amount.toString(), USDT_DECIMALS);
    const refAddress = referrer || ZERO_ADDRESS;

    setIsInvesting(true);
    setIsConfirming(true);
    setIsConfirmed(false);
    try {
      const tx = await memePlusWrite.investFromBalance(amountWei, refAddress);
      await tx.wait();
      setIsConfirmed(true);
      setTimeout(invalidate, 3000);
      return tx.hash;
    } finally {
      setIsInvesting(false);
      setIsConfirming(false);
    }
  }, [memePlusWrite, invalidate]);

  // Claim daily return
  const claimDailyReturn = useCallback(async () => {
    if (!userAddress || !memePlusWrite) return;
    const tx = await memePlusWrite.claimDailyReturn(userAddress);
    await tx.wait();
    invalidate();
  }, [userAddress, memePlusWrite, invalidate]);

  return {
    balance,
    totalInvested,
    totalEarned,
    totalWithdrawn,
    capLimit,
    capRemaining,
    isActive,
    isRegistered: userData?.isRegistered ?? false,
    usdtBalance: userData?.usdtBalance ?? 0n,
    mmBalance: userData?.mmBalance ?? 0n,
    allowance: userData?.allowance ?? 0n,
    minInvestment: config.minInvestment,
    capMultiplier: config.capMultiplier,
    dailyReturnRate: config.dailyReturnRate,
    withdrawalFeeBps: config.withdrawalFeeBps,
    orders: parsedOrders,
    bckOriginal,
    bckReleased,
    bckUnreleased,
    bckClaimable,
    bckDailyRelease:
      bckOriginal > 0n
        ? (bckOriginal * BigInt(restartMMRelease)) / 10000n
        : 0n,
    invest,
    investFromBalance,
    approve,
    claimDailyReturn,
    isApproving,
    isInvesting,
    isConfirming,
    isConfirmed,
    refetch: invalidate,
  };
}
