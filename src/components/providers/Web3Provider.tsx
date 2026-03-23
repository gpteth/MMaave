"use client";

import { Web3Provider as Web3ContextProvider } from "@/contexts/Web3Context";

export default function Web3Provider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Web3ContextProvider>{children}</Web3ContextProvider>;
}
