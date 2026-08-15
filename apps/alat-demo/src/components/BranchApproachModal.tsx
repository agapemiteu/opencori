"use client";

import { useEffect, useState } from "react";
import { useCorri } from "./CorriProvider";

interface ApproachEvent {
  branch?: {
    name: string;
  };
}

interface BranchApproachModalProps {
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
  onSnooze?: (branchName: string) => void;
  onClearSnooze?: () => void;
  forceOpen?: boolean;
  snoozedBranchName?: string | null;
  onForceConfirm?: () => void; // NEW callback for frontend state bypass
}

export function BranchApproachModal({ 
  onNotify, 
  onSnooze, 
  onClearSnooze, 
  forceOpen = false, 
  snoozedBranchName,
  onForceConfirm
}: BranchApproachModalProps) {
  const { host } = useCorri();
  const [approachEvent, setApproachEvent] = useState<ApproachEvent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => {
    if (!host) return;

    const unsubscribe = host.corri.on("branchApproach", (eventData: unknown) => {
      if (typeof eventData === "object" && eventData !== null) {
        setApproachEvent(eventData as ApproachEvent);
        if (onClearSnooze) onClearSnooze();
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [host]);

  useEffect(() => {
    if (forceOpen) {
      setApproachEvent({
        branch: {
          name: snoozedBranchName || "Wema Marina"
        }
      });
    }
  }, [forceOpen, snoozedBranchName]);

  if (!approachEvent) return null;

  const branchName = approachEvent.branch?.name || "Wema Marina";

  const handleConfirm = async () => {
    setIsProcessing(true);
    if (onClearSnooze) onClearSnooze(); 
    
    try {
      await host?.corri.confirmVisit();
    } catch (err) {
      console.warn("SDK confirmVisit strict state caught, using frontend override:", err);
    } finally {
      setIsProcessing(false);
      setApproachEvent(null);
      // Force the frontend state to launch the concierge form instantly
      if (onForceConfirm) onForceConfirm();
    }
  };

  const handleSnooze = () => {
    try {
      host?.corri.snoozeBranch();
    } catch (err) {
      console.warn("SDK snoozeBranch state fallback caught:", err);
    }
    
    setApproachEvent(null);

    if (onNotify) {
      onNotify("Visit snoozed. Monitoring location in background.", "info");
    }
    
    if (onSnooze) onSnooze(branchName);
  };

  const handleDecline = () => {
    if (onClearSnooze) onClearSnooze();
    try {
      host?.corri.declineVisit();
    } catch (err) {
      console.warn("SDK declineVisit fallback caught:", err);
    }
    setApproachEvent(null);
  };

  const handleDismiss = () => {
    if (onClearSnooze) onClearSnooze();
    try {
      host?.corri.ignoreApproach();
    } catch (err) {
      console.warn("SDK ignoreApproach fallback caught:", err);
    }
    setApproachEvent(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 text-center space-y-4">
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
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            style={{ backgroundColor: '#8B0068' }}
            className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 hover:cursor-pointer transition disabled:opacity-70"
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