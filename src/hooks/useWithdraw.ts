"use client";

import { Contract, parseUnits, type InterfaceAbi } from "ethers";
import { ADDRESSES, USDT_DECIMALS } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";
import { useWeb3 } from "@/contexts/Web3Context";
import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function useWithdraw(userAddress?: string) {
  const { signer, readProvider } = useWeb3();
  const queryClient = useQueryClient();

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const memePlus = useMemo(
    () => new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, readProvider),
    [readProvider]
  );

  // Memoize signer-connected contract to avoid re-creating on every withdraw call
  const memePlusWrite = useMemo(
    () => signer ? new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, signer) : null,
    [signer]
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["withdraw", userAddress],
    queryFn: async () => {
      if (!userAddress) return null;
      const [info, wFee, minW] = await Promise.all([
        memePlus.getMemberInfo(userAddress),
        memePlus.withdrawalFee(),
        memePlus.minWithdrawal(),
      ]);
      return {
        memberInfo: info,
        withdrawalFeeBps: Number(wFee),
        minWithdrawal: minW as bigint,
      };
    },
    enabled: !!userAddress,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const balance = data?.memberInfo ? BigInt(data.memberInfo[9]) : 0n;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["withdraw", userAddress] });
    queryClient.invalidateQueries({ queryKey: ["investment", "userData", userAddress] });
  }, [queryClient, userAddress]);

  const withdraw = useCallback(async (amount: number) => {
    if (!memePlusWrite) throw new Error("No signer connected");
    if (amount <= 0) throw new Error("Invalid amount");

    const amountWei = parseUnits(amount.toString(), USDT_DECIMALS);

    setIsWithdrawing(true);
    setIsConfirming(true);
    setIsConfirmed(false);
    try {
      const tx = await memePlusWrite.withdraw(amountWei);
      setIsWithdrawing(false);
      // Now waiting for confirmation
      await tx.wait();
      setIsConfirmed(true);
      invalidate();
      return tx.hash as string;
    } catch (error) {
      setIsConfirmed(false);
      throw error;
    } finally {
      setIsWithdrawing(false);
      setIsConfirming(false);
    }
  }, [memePlusWrite, invalidate]);

  return {
    balance,
    feeBps: data?.withdrawalFeeBps ?? 500,
    minWithdrawal: data?.minWithdrawal ?? parseUnits("10", USDT_DECIMALS),
    withdraw,
    isWithdrawing,
    isConfirming,
    isConfirmed,
    isLoading,
    isError,
  };
}
