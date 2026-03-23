"use client";

import { useState, useEffect, useCallback } from "react";
import { useWeb3 } from "@/contexts/Web3Context";
import { Contract, isAddress, type InterfaceAbi } from "ethers";
import { ADDRESSES } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { getErrorMessage } from "@/lib/utils";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const SKIP_GATE_ADDRESSES = [
  "0x769ddC8B629a6D8158Cd6B2f335aE33fe9544fBF",
].map((a) => a.toLowerCase());

export function ReferrerGate({ children }: { children: React.ReactNode }) {
  const { address, isConnected, readProvider, signer } = useWeb3();
  const [referrerInput, setReferrerInput] = useState("");
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  const [bindError, setBindError] = useState("");
  const { t } = useLanguage();

  const checkRegistration = useCallback(async () => {
    if (!address || !readProvider) return;
    setIsLoading(true);
    try {
      const memePlus = new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, readProvider);
      const registered = await memePlus.isMemberRegistered(address);
      setIsRegistered(registered);
    } catch (e) {
      console.error("checkRegistration error:", e);
      setIsRegistered(null);
    } finally {
      setIsLoading(false);
    }
  }, [address, readProvider]);

  useEffect(() => {
    checkRegistration();
  }, [checkRegistration]);

  // Load referrer from URL or localStorage
  useEffect(() => {
    const urlRef = new URLSearchParams(window.location.search).get("ref") || "";
    if (urlRef) {
      setReferrerInput(urlRef);
      localStorage.setItem("rockplan-referrer", urlRef);
    } else {
      setReferrerInput(localStorage.getItem("rockplan-referrer") || "");
    }
  }, []);

  const handleConfirm = async () => {
    if (!signer) return;
    const ref = referrerInput.trim();

    // Validate referrer address format if provided
    if (ref && !isAddress(ref)) {
      setBindError(t("bind.invalidAddress") || "Invalid address format");
      return;
    }

    const referrerAddr = ref && isAddress(ref) ? ref : ZERO_ADDRESS;

    // If referrer provided, check if they are registered on-chain
    if (referrerAddr !== ZERO_ADDRESS && readProvider) {
      try {
        const memePlus = new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, readProvider);
        const refRegistered = await memePlus.isMemberRegistered(referrerAddr);
        if (!refRegistered) {
          setBindError(t("bind.referrerNotRegistered") || "Referrer address is not registered");
          return;
        }
      } catch (e) {
        console.error("referrer check error:", e);
      }
    }

    setIsBinding(true);
    setBindError("");
    try {
      const memePlusWithSigner = new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, signer);
      const tx = await memePlusWithSigner.register(referrerAddr, { gasLimit: 300000 });
      await tx.wait();
      localStorage.setItem("rockplan-referrer", referrerAddr);
      localStorage.setItem("rockplan-referrer-bound", "true");
      setIsRegistered(true);
    } catch (e: unknown) {
      console.error("register error:", e);
      setBindError(getErrorMessage(e, t("bind.bindError") || "绑定失败"));
    } finally {
      setIsBinding(false);
    }
  };

  const isSkipped = address && SKIP_GATE_ADDRESSES.includes(address.toLowerCase());
  const showModal = isConnected && !isLoading && isRegistered === false && !isSkipped;

  return (
    <>
      {children}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="card glow-accent max-w-md w-full">
            <div className="text-center mb-6">
              <svg className="w-12 h-12 mx-auto text-accent mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <h2 className="text-xl font-bold mb-2">{t("bind.title")}</h2>
              <p className="text-muted text-sm">{t("bind.subtitle")}</p>
            </div>

            <div className="mb-5">
              <label className="block text-sm text-muted mb-2">{t("gate.referrerLabel")}</label>
              <input
                type="text"
                className="input font-mono text-sm"
                placeholder="0x..."
                value={referrerInput}
                onChange={(e) => {
                  setReferrerInput(e.target.value);
                  setBindError("");
                }}
                disabled={isBinding}
              />
              <p className="text-xs text-muted mt-1">{t("gate.referrerHint")}</p>
            </div>

            {bindError && (
              <p className="text-red-500 text-sm mb-3">{bindError}</p>
            )}

            <button
              onClick={handleConfirm}
              className="btn-primary w-full text-center"
              disabled={isBinding}
            >
              {isBinding ? t("bind.binding") : referrerInput.trim() ? t("gate.confirm") : t("gate.skipReferrer") || "Register without referrer"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
