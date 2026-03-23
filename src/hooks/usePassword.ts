"use client";

import { Contract, keccak256, toUtf8Bytes, type InterfaceAbi } from "ethers";
import { ADDRESSES } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";
import { useWeb3 } from "@/contexts/Web3Context";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export function usePassword(userAddress?: string) {
  const { signer, readProvider } = useWeb3();
  const queryClient = useQueryClient();

  const [isSetting, setIsSetting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const memePlus = useMemo(
    () => new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, readProvider),
    [readProvider]
  );

  const { data: passwordHash } = useQuery({
    queryKey: ["passwordHash", userAddress],
    queryFn: async () => {
      if (!userAddress) return null;
      return (await memePlus.getPasswordHash(userAddress)) as string;
    },
    enabled: !!userAddress,
    staleTime: Infinity,
  });

  const hasPassword = !!passwordHash && passwordHash !== ZERO_BYTES32;

  const setPassword = async (password: string) => {
    if (!signer) throw new Error("No signer");
    const hash = keccak256(toUtf8Bytes(password));

    setIsSetting(true);
    setIsConfirming(true);
    setIsConfirmed(false);
    try {
      const memePlusWithSigner = new Contract(
        ADDRESSES.MEMEPLUS,
        memePlusAbi as InterfaceAbi,
        signer
      );
      const tx = await memePlusWithSigner.setPassword(hash);
      await tx.wait();
      setIsConfirmed(true);
      setTimeout(
        () => queryClient.invalidateQueries({ queryKey: ["passwordHash", userAddress] }),
        3000
      );
      return tx.hash;
    } finally {
      setIsSetting(false);
      setIsConfirming(false);
    }
  };

  const getPasswordProof = (password: string): string => {
    if (!password) return ZERO_BYTES32;
    return keccak256(toUtf8Bytes(password));
  };

  return {
    hasPassword,
    setPassword,
    getPasswordProof,
    isSetting,
    isConfirming,
    isConfirmed,
  };
}
