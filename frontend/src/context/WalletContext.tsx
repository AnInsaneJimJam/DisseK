import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { BrowserProvider, type Signer } from 'ethers';
import { SiweMessage } from 'siwe';

interface WalletState {
  address: string | null;
  ensName: string | null;
  signer: Signer | null;
  isConnecting: boolean;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
  address: null,
  ensName: null,
  signer: null,
  isConnecting: false,
  isConnected: false,
  connect: async () => {},
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [ensName, setEnsName] = useState<string | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async () => {
    if (!(window as any).ethereum) {
      alert('Please install MetaMask or another Ethereum wallet.');
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
        statement: 'Sign in to DisseK Marketplace',
        uri: window.location.origin,
        version: '1',
        chainId,
        nonce: Math.random().toString(36).slice(2),
        issuedAt: new Date().toISOString(),
      });

      const messageStr = siweMessage.prepareMessage();
      await s.signMessage(messageStr);

      // Try ENS reverse lookup — never throw, just default to null
      let ens: string | null = null;
      try {
        ens = await provider.lookupAddress(addr);
      } catch {
        // ENS lookup not available on this network — that's fine
      }

      setAddress(addr);
      setEnsName(ens);
      setSigner(s);
    } catch (err: any) {
      console.error('Wallet connection failed:', err);
      // 4001 = user rejected, ACTION_REJECTED = ethers v6 equivalent
      if (err.code !== 4001 && err.code !== 'ACTION_REJECTED') {
        alert(`Connection failed: ${err.message}`);
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setEnsName(null);
    setSigner(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        ensName,
        signer,
        isConnecting,
        isConnected: !!address,
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
