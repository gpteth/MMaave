import { formatUnits, parseUnits } from "ethers";
import { USDT_DECIMALS } from "./contracts";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSDT(amount: bigint): string {
  return formatUnits(amount, USDT_DECIMALS);
}

export function parseUSDT(amount: string): bigint {
  return parseUnits(amount, USDT_DECIMALS);
}

export function formatNumber(value: string | number, decimals = 2): string {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function basisPointsToPercent(bp: number): string {
  return (bp / 100).toFixed(2);
}

export function calculateCapRemaining(
  totalInvested: bigint,
  totalEarned: bigint,
  capMultiplier: number = 250
): bigint {
  const cap = (totalInvested * BigInt(capMultiplier)) / 100n;
  return cap > totalEarned ? cap - totalEarned : 0n;
}

export function calculateWithdrawalFee(
  amount: bigint,
  feeBps: number = 800
): { net: bigint; fee: bigint } {
  const fee = (amount * BigInt(feeBps)) / 10000n;
  return { net: amount - fee, fee };
}

export function getErrorMessage(error: unknown, fallback = "操作失败"): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const shortMessage = record["shortMessage"];
    if (typeof shortMessage === "string" && shortMessage.trim()) {
      return shortMessage;
    }
    const reason = record["reason"];
    if (typeof reason === "string" && reason.trim()) {
      return reason;
    }
    const message = record["message"];
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}
