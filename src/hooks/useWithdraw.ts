"use client";

import { Contract, parseUnits, type InterfaceAbi } from "ethers";
import { ADDRESSES, USDT_DECIMALS } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";
import { useWeb3 } from "@/contexts/Web3Context";
import { useState, useMemo } from "react";
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

  const { data } = useQuery({
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
  });

  const balance = data?.memberInfo ? BigInt(data.memberInfo[9]) : 0n;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["withdraw", userAddress] });
    queryClient.invalidateQueries({ queryKey: ["investment", "userData", userAddress] });
  };

  const withdraw = async (amount: number) => {
    if (!signer) throw new Error("No signer");
    const amountWei = parseUnits(amount.toString(), USDT_DECIMALS);

    setIsWithdrawing(true);
    setIsConfirming(true);
    setIsConfirmed(false);
    try {
      const memePlusWithSigner = new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, signer);
      const tx = await memePlusWithSigner.withdraw(amountWei);
      await tx.wait();
      setIsConfirmed(true);
      setTimeout(invalidate, 3000);
      return tx.hash;
    } finally {
      setIsWithdrawing(false);
      setIsConfirming(false);
    }
  };

  return {
    balance,
    feeBps: data?.withdrawalFeeBps ?? 500,
    minWithdrawal: data?.minWithdrawal ?? parseUnits("10", USDT_DECIMALS),
    withdraw,
    isWithdrawing,
    isConfirming,
    isConfirmed,
  };
}
