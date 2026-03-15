import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { BrowserProvider, JsonRpcProvider, type Signer } from "ethers";
import { SiweMessage } from "siwe";

const BACKEND_URL = "http://localhost:3001";

interface ENSIdentity {
  address: string;
  ensName: string | null;
  forwardVerified: boolean;
  identityType: "individual" | "org-agent" | "unknown";
  parentName: string | null;
}

interface WalletState {
  address: string | null;
  ensName: string | null;
  signer: Signer | null;
  isConnecting: boolean;
  isConnected: boolean;
  identity: ENSIdentity | null;
  identityLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
  address: null,
  ensName: null,
  signer: null,
  isConnecting: false,
  isConnected: false,
  identity: null,
  identityLoading: false,
  connect: async () => {},
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [ensName, setEnsName] = useState<string | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [identity, setIdentity] = useState<ENSIdentity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(false);

  const resolveENSIdentity = useCallback(async (addr: string, chainId?: number) => {
    setIdentityLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/resolve-ens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr, chainId }),
      });
      if (res.ok) {
        const data: ENSIdentity = await res.json();
        setIdentity(data);
        if (data.ensName) setEnsName(data.ensName);
      }
    } catch (err) {
      console.warn("ENS identity resolution failed:", err);
    } finally {
      setIdentityLoading(false);
    }
  }, []);

  const connect = useCallback(async () => {
    if (!(window as any).ethereum) {
      alert("Please install MetaMask or another Ethereum wallet.");
      return;
    }

    setIsConnecting(true);
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      const s = await provider.getSigner();
      const addr = await s.getAddress();

      // Create and sign SIWE message
      let chainId = 1;
      try {
        chainId = Number((await provider.getNetwork()).chainId);
      } catch {
        // fallback to mainnet chainId
      }

      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address: addr,
        statement: "Sign in to DisseK Marketplace",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce: Math.random().toString(36).slice(2),
        issuedAt: new Date().toISOString(),
      });

      const messageStr = siweMessage.prepareMessage();
      await s.signMessage(messageStr);

      // ENS reverse lookup: try connected chain first, then mainnet fallback
      // (ENS names may live on Sepolia or mainnet)
      const ENS_CHAINS: Record<number, string> = {
        1: "https://cloudflare-eth.com",
        11155111: "https://rpc.sepolia.org",
      };
      let ens: string | null = null;
      const chainsToTry = ENS_CHAINS[chainId]
        ? [chainId, ...(chainId !== 1 ? [1] : [])]
        : [1, 11155111];
      for (const cid of chainsToTry) {
        if (ens) break;
        const rpc = ENS_CHAINS[cid];
        if (!rpc) continue;
        try {
          const p = new JsonRpcProvider(rpc);
          ens = await p.lookupAddress(addr);
        } catch (ensErr) {
          console.warn(`ENS reverse lookup failed on chain ${cid}:`, ensErr);
        }
      }

      setAddress(addr);
      setEnsName(ens);
      setSigner(s);

      // Also resolve full identity via backend (includes forward verification + identity type)
      resolveENSIdentity(addr, chainId);
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      if (err.code !== 4001 && err.code !== "ACTION_REJECTED") {
        alert(`Connection failed: ${err.message}`);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [resolveENSIdentity]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setEnsName(null);
    setSigner(null);
    setIdentity(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        ensName,
        signer,
        isConnecting,
        isConnected: !!address,
        identity,
        identityLoading,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
