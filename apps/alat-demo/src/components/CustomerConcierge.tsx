"use client";

import { useState } from "react";
import { useCorri } from "./CorriProvider";
import { SUGGESTED_SERVICES, type FeedbackCategory } from "./service-options";

interface CustomerConciergeProps {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
  onSelectService?: (category: FeedbackCategory) => void;
}

export function CustomerConcierge({ onNotify, onSelectService }: CustomerConciergeProps) {
  const { host, isVisiting, activeBranchName } = useCorri();
  const [requestText, setRequestText] = useState("");
  const [selectedServices, setSelectedServices] = useState<typeof SUGGESTED_SERVICES>([]);
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  if (!isVisiting) return null;

  const handleSendRequest = async () => {
    // Combine selected pills and the text area input into a single payload
    const finalRequestText = [
      selectedServices.length > 0
        ? `Selected Services: ${selectedServices.map((s) => s.label).join(", ")}`
        : "",
      requestText.trim(),
    ]
      .filter(Boolean)
      .join(" | ");

    if (!host || !finalRequestText) return;

    setIsSendingRequest(true);
    try {
      if (!process.env.NEXT_PUBLIC_RECEIVER_PUBLIC_KEY) {
        throw new Error("The demo receiver encryption key is not configured. Request not sent.");
      }
      const receipt = await host.sendCustomerRequest(finalRequestText);
      if (["FAILED", "EXPIRED", "DEAD_LETTERED"].includes(receipt.state)) {
        throw new Error(`Encrypted request delivery ended in ${receipt.state}.`);
      }
      if (receipt.state === "DELIVERED") {
        onNotify(
          "Your encrypted request was delivered to the configured Wema receiver.",
          "success",
        );
      } else {
        onNotify(
          `Your encrypted request was accepted with state ${receipt.state}. Delivery is not yet confirmed.`,
          "info",
        );
      }

      // Auto-select the first selected service category for the feedback form
      const firstSelectedService = selectedServices[0];
      if (firstSelectedService && onSelectService) {
        onSelectService(firstSelectedService.feedbackCategory);
      }

      // Reset form
      setRequestText("");
      setSelectedServices([]);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "Failed to send secure request.", "error");
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleServiceClick = (service: (typeof SUGGESTED_SERVICES)[number]) => {
    setSelectedServices((prev) => {
      const isSelected = prev.some((s) => s.id === service.id);
      if (isSelected) {
        // Remove it if it's already selected
        return prev.filter((s) => s.id !== service.id);
      } else {
        // Add it if it's not selected
        return [...prev, service];
      }
    });
  };

  const isButtonDisabled =
    (selectedServices.length === 0 && !requestText.trim()) || isSendingRequest;

  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <h2 className="text-lg font-semibold mb-2 text-slate-800">Branch Concierge</h2>
      <p className="text-sm text-slate-500 mb-4">
        You are currently checked into {activeBranchName}. Let the tellers know what you need so
        they can prepare before you walk up to the counter.
      </p>

      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Suggested Services
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_SERVICES.map((service) => {
            const isSelected = selectedServices.some((s) => s.id === service.id);

            return (
              <button
                key={service.id}
                onClick={() => handleServiceClick(service)}
                type="button"
                className={`min-h-11 text-xs px-3 py-1.5 rounded-full transition font-medium hover:cursor-pointer border ${
                  isSelected
                    ? "bg-[#8B0068] text-white border-[#8B0068]"
                    : "bg-slate-100 hover:bg-purple-50 hover:text-[#8B0068] hover:border-[#8B0068]/30 text-slate-700 border-slate-200"
                }`}
              >
                {service.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <textarea
          value={requestText}
          onChange={(event) => setRequestText(event.target.value)}
          placeholder="Any additional details or custom requests? (optional)"
          className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#8B0068] focus:border-transparent outline-none resize-none text-slate-700 text-sm"
          rows={3}
        />
        <button
          onClick={handleSendRequest}
          disabled={isButtonDisabled}
          style={{
            backgroundColor: isButtonDisabled ? "#cbd5e1" : "#8B0068",
          }}
          className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:cursor-not-allowed text-sm hover:cursor-pointer"
        >
          {isSendingRequest ? "Encrypting & Sending..." : "Send Secure Request"}
        </button>
      </div>
    </section>
  );
}
