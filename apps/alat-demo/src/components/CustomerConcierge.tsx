"use client";

import { useState } from "react";
import { useCorri } from "./CorriProvider";

interface CustomerConciergeProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
  onSelectService?: (service: string) => void; // New optional callback
}

const SUGGESTED_SERVICES = [
  "Card Pickup / Replacement",
  "Account Opening & BVN Linking",
  "Cash Withdrawal / Deposit",
  "Loan Inquiry / Application",
  "Customer Support / Complaints"
];

export function CustomerConcierge({ onNotify, onSelectService }: CustomerConciergeProps) {
  const { host, activeBranchName } = useCorri();
  const [requestText, setRequestText] = useState("");
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  const handleSendRequest = async (textToSend?: string) => {
    const finalContent = textToSend || requestText;
    if (!host || !finalContent.trim()) return;
    
    setIsSendingRequest(true);
    try {
      if (process.env.NEXT_PUBLIC_RECEIVER_PUBLIC_KEY) {
         await host.sendCustomerRequest(finalContent);
      } else {
         console.log("Mocking secure request. Payload:", finalContent);
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

  const handleServiceClick = (service: string) => {
    setRequestText(service);
    if (onSelectService) {
      onSelectService(service);
    }
  };

  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <h2 className="text-lg font-semibold mb-2 text-slate-800">Branch Concierge</h2>
      <p className="text-sm text-slate-500 mb-4">
        You are currently checked into {activeBranchName || "Wema Marina"}. Let the tellers know what you need so they can prepare before you walk up to the counter.
      </p>

      {/* Suggested Quick-Select Services */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Suggested Services</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_SERVICES.map((service, index) => (
            <button
              key={index}
              onClick={() => handleServiceClick(service)}
              type="button"
              className="text-xs bg-slate-100 hover:bg-purple-50 hover:text-[#8B0068] hover:border-[#8B0068]/30 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-full transition font-medium hover:cursor-pointer"
            >
              {service}
            </button>
          ))}
        </div>
      </div>
      
      <div className="space-y-3">
        <textarea
          value={requestText}
          onChange={(e) => setRequestText(e.target.value)}
          placeholder="E.g., I need to request a new debit card..."
          className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#8B0068] focus:border-transparent outline-none resize-none text-slate-700 text-sm"
          rows={3}
        />
        <button
          onClick={() => handleSendRequest()}
          disabled={!requestText.trim() || isSendingRequest}
          style={{ backgroundColor: (!requestText.trim() || isSendingRequest) ? '#cbd5e1' : '#8B0068' }}
          className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:cursor-not-allowed text-sm hover:cursor-pointer"
        >
          {isSendingRequest ? "Encrypting & Sending..." : "Send Secure Request"}
        </button>
      </div>
    </section>
  );
}