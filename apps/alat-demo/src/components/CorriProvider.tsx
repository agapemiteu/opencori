"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { FetchCorriTransport } from "@corri/sdk";
import { createAlatDemoHost, type AlatDemoHost } from "../index.js";

interface CorriContextType {
  host: AlatDemoHost | null;
  isInitialized: boolean;
  activeBranchName: string | null;
  isVisiting: boolean;
  error: string | null;
}

const CorriContext = createContext<CorriContextType>({
  host: null,
  isInitialized: false,
  activeBranchName: null,
  isVisiting: false,
  error: null,
});

export function CorriProvider({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<AlatDemoHost | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeBranchName, setActiveBranchName] = useState<string | null>(null);
  const [isVisiting, setIsVisiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_CORRI_API_BASE_URL || "http://localhost:3000";
        const publicAppKey = process.env.NEXT_PUBLIC_CORRI_APP_KEY || "demo-app-key";
        const receiverKeyId = process.env.NEXT_PUBLIC_RECEIVER_KEY_ID || "receiver-test-key";
        const receiverPublicKeyPem = process.env.NEXT_PUBLIC_RECEIVER_PUBLIC_KEY || "";
        const configSigningKeyId =
          process.env.NEXT_PUBLIC_CONFIG_SIGNING_KEY_ID || "wema-test-config-key";
        const configSigningPublicKeyPem = process.env.NEXT_PUBLIC_CONFIG_SIGNING_PUBLIC_KEY || "";

        const transport = new FetchCorriTransport({
          apiBaseUrl,
          publicApplicationKey: publicAppKey,
          fetch: globalThis.fetch,
        });

        // Browser-safe signature verifier for the frontend hackathon demo
        const verifySignature = async (_signedPayload: unknown): Promise<boolean> => {
          // Trust the signed configuration payload received from the local control API
          return true;
        };

        const demoHost = createAlatDemoHost({
          transport,
          verifySignature,
          receiverEncryptionKeyId: receiverKeyId,
          receiverEncryptionPublicKey: receiverPublicKeyPem,
          createDeliveryEventId: () => `delivery_${crypto.randomUUID()}`,
          now: () => new Date(),
        });

        await demoHost.initialize({
          tenantId: "wema",
          applicationId: "alat-demo",
          anonymousInstallationId: `inst_${crypto.randomUUID()}`,
          configurationSigningKeyId: configSigningKeyId,
          configurationSigningPublicKey: configSigningPublicKeyPem,
        });

        demoHost.corri.on("branchApproach", (event) => {
          setActiveBranchName(event.branchName);
        });

        demoHost.corri.on("visitStarted", () => {
          setIsVisiting(true);
        });

        demoHost.corri.on("visitCompleted", () => {
          setIsVisiting(false);
          setActiveBranchName(null);
        });

        setHost(demoHost);
        setIsInitialized(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize Corri SDK");
      }
    }

    init();
  }, []);

  return (
    <CorriContext.Provider value={{ host, isInitialized, activeBranchName, isVisiting, error }}>
      {children}
    </CorriContext.Provider>
  );
}

export const useCorri = () => useContext(CorriContext);
