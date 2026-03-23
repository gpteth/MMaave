"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { BrowserProvider, JsonRpcProvider, type Signer } from "ethers";

const BSC_MAINNET_CHAIN_ID = 56;
const BSC_MAINNET_RPC = "https://rpc.ankr.com/bsc/d0aa0f304df5a955af83a4408799daff26c284a6d311a4994e90394592c6e6a2";
const BSC_MAINNET_CONFIG = {
  chainId: "0x38",
  chainName: "BNB Smart Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: [BSC_MAINNET_RPC],
  blockExplorerUrls: ["https://bscscan.com"],
};

interface Web3ContextType {
  provider: BrowserProvider | null;
  readProvider: JsonRpcProvider;
  signer: Signer | null;
  address: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToBscMainnet: () => Promise<void>;
}

const readProvider = new JsonRpcProvider(BSC_MAINNET_RPC, BSC_MAINNET_CHAIN_ID);

type Eip1193ProviderLike = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

const Web3Context = createContext<Web3ContextType>({
  provider: null,
  readProvider,
  signer: null,
  address: undefined,
  isConnected: false,
  isConnecting: false,
  chainId: null,
  connect: async () => {},
  disconnect: () => {},
  switchToBscMainnet: async () => {},
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [address, setAddress] = useState<string | undefined>();
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const isConnected = !!address;

  const setupProvider = useCallback(async (ethereum: Eip1193ProviderLike) => {
    const bp = new BrowserProvider(ethereum);
    setProvider(bp);

    const network = await bp.getNetwork();
    setChainId(Number(network.chainId));

    // If user previously connected, use eth_requestAccounts to re-authorize
    const wasConnected = localStorage.getItem("rockplan-wallet-connected") === "true";
    const method = wasConnected ? "eth_requestAccounts" : "eth_accounts";
    const accounts = (await ethereum.request({ method })) as string[];
    if (accounts.length > 0) {
      const s = await bp.getSigner();
      setSigner(s);
      setAddress(accounts[0]);
      localStorage.setItem("rockplan-wallet-connected", "true");
    }
  }, []);

  // Auto-connect on mount if previously connected
  useEffect(() => {
    const ethereum = (window as Window & { ethereum?: Eip1193ProviderLike }).ethereum;
    if (!ethereum) return;

    setupProvider(ethereum);

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setSigner(null);
        setAddress(undefined);
        localStorage.removeItem("rockplan-wallet-connected");
      } else {
        setAddress(accounts[0]);
        // Re-create signer for new account
        const bp = new BrowserProvider(ethereum);
        setProvider(bp);
        bp.getSigner().then(setSigner);
      }
    };

    const handleChainChanged = (hexChainId: string) => {
      setChainId(parseInt(hexChainId, 16));
      // Re-create provider on chain change
      const bp = new BrowserProvider(ethereum);
      setProvider(bp);
      if (address) {
        bp.getSigner().then(setSigner);
      }
    };

    ethereum.on?.("accountsChanged", handleAccountsChanged as (...args: unknown[]) => void);
    ethereum.on?.("chainChanged", handleChainChanged as (...args: unknown[]) => void);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged as (...args: unknown[]) => void);
      ethereum.removeListener?.("chainChanged", handleChainChanged as (...args: unknown[]) => void);
    };
  }, [setupProvider, address]);

  const connect = useCallback(async () => {
    const ethereum = (window as Window & { ethereum?: Eip1193ProviderLike }).ethereum;
    if (!ethereum) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const bp = new BrowserProvider(ethereum);
      setProvider(bp);

      const network = await bp.getNetwork();
      setChainId(Number(network.chainId));

      if (accounts.length > 0) {
        const s = await bp.getSigner();
        setSigner(s);
        setAddress(accounts[0]);
        localStorage.setItem("rockplan-wallet-connected", "true");
      }
    } catch (err) {
      console.error("Failed to connect wallet:", err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setSigner(null);
    setAddress(undefined);
    setProvider(null);
    setChainId(null);
    localStorage.removeItem("rockplan-wallet-connected");
  }, []);

  const switchToBscMainnet = useCallback(async () => {
    const ethereum = (window as Window & { ethereum?: Eip1193ProviderLike }).ethereum;
    if (!ethereum) return;

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BSC_MAINNET_CONFIG.chainId }],
      });
    } catch (switchError: unknown) {
      const code =
        switchError && typeof switchError === "object"
          ? (switchError as Record<string, unknown>)["code"]
          : null;
      if (code === 4902) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [BSC_MAINNET_CONFIG],
        });
      }
    }
  }, []);

  return (
    <Web3Context.Provider
      value={{
        provider,
        readProvider,
        signer,
        address,
        isConnected,
        isConnecting,
        chainId,
        connect,
        disconnect,
        switchToBscMainnet,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return useContext(Web3Context);
}

export { readProvider, BSC_MAINNET_CHAIN_ID };
