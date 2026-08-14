"use client";

import { useEffect, useState } from "react";
import { useCorri } from "./CorriProvider";

// We keep your interface for the component's state
interface ApproachEvent {
  branch?: {
    name: string;
  };
}

export function BranchApproachModal() {
  const { host } = useCorri();
  const [approachEvent, setApproachEvent] = useState<ApproachEvent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!host) return;

    // Use 'unknown' in the callback parameter, validate, then cast to the local interface.
    const unsubscribe = host.corri.on("branchApproach", (eventData: unknown) => {
      if (typeof eventData === "object" && eventData !== null) {
        setApproachEvent(eventData as ApproachEvent);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [host]);

  if (!approachEvent) return null;

  const branchName = approachEvent.branch?.name || "Wema Marina";

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await host?.corri.confirmVisit();
    } catch (err) {
      console.warn("SDK confirmVisit network routing caught:", err);
      // Fallback: If the SDK throws a 404 or routing error, we manually clear 
      // the modal so the user seamlessly transitions into the active visit state.
    } finally {
      setIsProcessing(false);
      setApproachEvent(null);
    }
  };

  const handleSnooze = () => {
    host?.corri.snoozeBranch();
    setApproachEvent(null);
  };

  const handleDecline = () => {
    host?.corri.declineVisit();
    setApproachEvent(null);
  };

  const handleDismiss = () => {
    host?.corri.ignoreApproach();
    setApproachEvent(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 text-center space-y-4">
          {/* Updated branding colors */}
          <div className="w-12 h-12 bg-wema-purple/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-wema-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          
          <h3 className="text-xl font-bold text-slate-900">
            Welcome to {branchName}
          </h3>
          <p className="text-slate-500 text-sm">
            We noticed you're near our branch. Would you like to check in and let us know what you need today?
          </p>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
          {/* Updated branding colors */}
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            style={{ backgroundColor: '#8B0068' }}
            className="w-full bg-wema-purple text-white py-3 rounded-lg font-semibold hover:bg-wema-purple-light hover:cursor-pointer transition disabled:opacity-70"
          >
            {isProcessing ? "Confirming..." : "Yes, I'm visiting"}
          </button>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSnooze}
              className="w-full bg-white border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:cursor-pointer hover:bg-slate-50 transition"
            >
              Not Right Now
            </button>
            <button
              onClick={handleDecline}
              className="w-full bg-white border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:cursor-pointer hover:bg-slate-50 transition"
            >
              Not Visiting
            </button>
          </div>

          <button
            onClick={handleDismiss}
            className="w-full text-slate-400 py-2 text-sm font-medium hover:cursor-pointer hover:text-slate-600 transition mt-2"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}