"use client";

import type { BranchApproachEvent } from "@corri/sdk";
import { useEffect, useState } from "react";
import { useCorri } from "./CorriProvider";

export interface SnoozedBranch {
  branchId: string;
  branchName: string;
  cooldownEndsAt: string;
}

interface BranchApproachModalProps {
  onNotify?: (message: string, type: "success" | "error" | "info") => void;
  onSnooze?: (snoozedBranch: SnoozedBranch) => void;
}

export function BranchApproachModal({ onNotify, onSnooze }: BranchApproachModalProps) {
  const { host } = useCorri();
  const [approachEvent, setApproachEvent] = useState<BranchApproachEvent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!host) return;

    return host.corri.on("branchApproach", (event) => {
      setApproachEvent(event);
    });
  }, [host]);

  if (!approachEvent) return null;

  const notifyError = (error: unknown, fallback: string) => {
    onNotify?.(error instanceof Error ? error.message : fallback, "error");
  };

  const handleConfirm = async () => {
    if (!host) return;

    setIsProcessing(true);
    try {
      await host.corri.confirmVisit();
      setApproachEvent(null);
      onNotify?.("Welcome! Your confirmed branch visit has started.", "success");
    } catch (error) {
      notifyError(error, "The visit could not be confirmed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSnooze = () => {
    if (!host) return;

    try {
      host.corri.snoozeBranch();
    } catch (error) {
      notifyError(error, "The visit prompt could not be snoozed.");
      return;
    }

    setApproachEvent(null);
    const { cooldownEndsAt } = host.corri.getDiagnostics();
    if (cooldownEndsAt === null) {
      onNotify?.("Visit prompt snoozed, but its cooldown deadline is unavailable.", "error");
      return;
    }

    onSnooze?.({
      branchId: approachEvent.branchId,
      branchName: approachEvent.branchName,
      cooldownEndsAt,
    });
    onNotify?.("Visit prompt snoozed according to the configured branch policy.", "info");
  };

  const handleDecline = () => {
    if (!host) return;

    try {
      host.corri.declineVisit();
      setApproachEvent(null);
      onNotify?.("This branch prompt will remain suppressed for the configured cooldown.", "info");
    } catch (error) {
      notifyError(error, "The visit response could not be recorded.");
    }
  };

  const handleDismiss = () => {
    if (!host) return;

    try {
      host.corri.ignoreApproach();
      setApproachEvent(null);
    } catch (error) {
      notifyError(error, "The branch prompt could not be dismissed.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-wema-purple/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg
              className="w-6 h-6 text-wema-purple"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>

          <h3 className="text-xl font-bold text-slate-900">
            Welcome to {approachEvent.branchName}
          </h3>
          <p className="text-slate-500 text-sm">
            We noticed you&apos;re near our branch. Would you like to check in and let us know what
            you need today?
          </p>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            style={{ backgroundColor: "#8B0068" }}
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
