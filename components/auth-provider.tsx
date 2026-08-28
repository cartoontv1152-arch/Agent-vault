"use client";

import { SiweMessage } from "siwe";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import { apiFetch } from "@/lib/client";
import { publicConfig } from "@/lib/network";
import {
  deriveVaultKey,
  vaultKeyStorageKey,
  vaultUnlockMessage,
} from "@/lib/vault-key";

type Session = { address: `0x${string}`; chainId: number };

type AuthContextValue = {
  address?: `0x${string}`;
  connected: boolean;
  authenticated: boolean;
  loading: boolean;
  vaultKey: `0x${string}` | null;
  error: string | null;
  unlock: () => Promise<void>;
  unlockVault: () => Promise<void>;
  lock: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const [session, setSession] = useState<Session | null>(null);
  const [vaultKey, setVaultKey] = useState<`0x${string}` | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ session: Session | null }>("/api/auth/session")
      .then(({ session: active }) => setSession(active))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!address) {
      setVaultKey(null);
      return;
    }
    const stored = sessionStorage.getItem(vaultKeyStorageKey(address));
    if (stored?.match(/^0x[0-9a-fA-F]{64}$/)) {
      setVaultKey(stored as `0x${string}`);
    }
  }, [address]);

  useEffect(() => {
    if (
      session &&
      address &&
      session.address.toLowerCase() !== address.toLowerCase()
    ) {
      setSession(null);
      setVaultKey(null);
      void apiFetch("/api/auth/session", { method: "DELETE" });
    }
  }, [address, session]);

  const deriveKey = useCallback(
    async (owner: `0x${string}`) => {
      const signature = await signMessageAsync({
        account: owner,
        message: vaultUnlockMessage(owner),
      });
      const key = deriveVaultKey(signature);
      sessionStorage.setItem(vaultKeyStorageKey(owner), key);
      setVaultKey(key);
    },
    [signMessageAsync],
  );

  const unlockVault = useCallback(async () => {
    if (!address) throw new Error("Connect a wallet first.");
    setError(null);
    try {
      await deriveKey(address);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Wallet unlock failed.";
      setError(message);
      throw cause;
    }
  }, [address, deriveKey]);

  const unlock = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      let owner = address;
      let activeChainId = chainId;
      if (!owner) {
        const connector = connectors[0];
        if (!connector) throw new Error("No browser wallet was found.");
        const result = await connectAsync({ connector });
        owner = result.accounts[0];
        activeChainId = result.chainId;
      }
      if (!owner) throw new Error("The wallet did not return an account.");
      if (activeChainId !== publicConfig.chainId) {
        await switchChainAsync({ chainId: publicConfig.chainId });
      }

      if (
        !session ||
        session.address.toLowerCase() !== owner.toLowerCase()
      ) {
        const { nonce } = await apiFetch<{ nonce: string }>("/api/auth/nonce");
        const message = new SiweMessage({
          domain: window.location.host,
          address: owner,
          statement: "Sign in to your private AgentVault.",
          uri: window.location.origin,
          version: "1",
          chainId: publicConfig.chainId,
          nonce,
        });
        const prepared = message.prepareMessage();
        const signature = await signMessageAsync({ account: owner, message: prepared });
        const authenticated = await apiFetch<Session>("/api/auth/verify", {
          method: "POST",
          body: JSON.stringify({ message: prepared, signature }),
        });
        setSession(authenticated);
      }

      const stored = sessionStorage.getItem(vaultKeyStorageKey(owner));
      if (stored?.match(/^0x[0-9a-fA-F]{64}$/)) {
        setVaultKey(stored as `0x${string}`);
      } else {
        await deriveKey(owner);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Wallet unlock failed.";
      setError(message);
      throw cause;
    } finally {
      setLoading(false);
    }
  }, [
    address,
    chainId,
    connectors,
    connectAsync,
    deriveKey,
    session,
    signMessageAsync,
    switchChainAsync,
  ]);

  const lock = useCallback(async () => {
    if (address) sessionStorage.removeItem(vaultKeyStorageKey(address));
    await apiFetch("/api/auth/session", { method: "DELETE" }).catch(() => null);
    setSession(null);
    setVaultKey(null);
    await disconnectAsync();
  }, [address, disconnectAsync]);

  const value = useMemo<AuthContextValue>(
    () => ({
      address,
      connected: isConnected,
      authenticated: Boolean(
        session &&
          address &&
          session.address.toLowerCase() === address.toLowerCase(),
      ),
      loading,
      vaultKey,
      error,
      unlock,
      unlockVault,
      lock,
    }),
    [address, error, isConnected, loading, lock, session, unlock, unlockVault, vaultKey],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
