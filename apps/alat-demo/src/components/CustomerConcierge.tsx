"use client";

import { useState } from "react";
import { useCorri } from "./CorriProvider";

interface CustomerConciergeProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function CustomerConcierge({ onNotify }: CustomerConciergeProps) {
  const { host, activeBranchName } = useCorri();
  const [requestText, setRequestText] = useState("");
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  const handleSendRequest = async () => {
    if (!host || !requestText.trim()) return;
    
    setIsSendingRequest(true);
    try {
      if (process.env.NEXT_PUBLIC_RECEIVER_PUBLIC_KEY) {
         await host.sendCustomerRequest(requestText);
      } else {
         console.log("Mocking secure request. Payload:", requestText);
         await new Promise(resolve => setTimeout(resolve, 1500)); 
      }
      onNotify("Your request was encrypted and sent to the branch staff!", "success");
      setRequestText(""); 
    } catch (err: Error | unknown) {
      console.error("SEND ERROR:", err);
      onNotify(err instanceof Error ? err.message : "Failed to send secure request.", "error");
    } finally {
      setIsSendingRequest(false);
    }
  };

  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <h2 className="text-lg font-semibold mb-2 text-slate-800">Branch Concierge</h2>
      <p className="text-sm text-slate-500 mb-4">
        You are currently checked into {activeBranchName || "Wema Marina"}. Let the tellers know what you need so they can prepare before you walk up to the counter.
      </p>
      
      <div className="space-y-3">
        <textarea
          value={requestText}
          onChange={(e) => setRequestText(e.target.value)}
          placeholder="E.g., I need to request a new debit card..."
          className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#8B0068] focus:border-transparent outline-none resize-none text-slate-700"
          rows={3}
        />
        <button
          onClick={handleSendRequest}
          disabled={!requestText.trim() || isSendingRequest}
          style={{ backgroundColor: (!requestText.trim() || isSendingRequest) ? '#cbd5e1' : '#8B0068' }}
          className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:cursor-not-allowed"
        >
          {isSendingRequest ? "Encrypting & Sending..." : "Send Secure Request"}
        </button>
      </div>
    </section>
  );
}