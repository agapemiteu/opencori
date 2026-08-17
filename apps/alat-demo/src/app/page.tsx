"use client";

import { useCallback, useEffect, useState } from "react";
import { BranchApproachModal } from "../components/BranchApproachModal";
import type { SnoozedBranch } from "../components/BranchApproachModal";
import { CustomerConcierge } from "../components/CustomerConcierge";
import { useCorri } from "../components/CorriProvider";
import { VisitFeedback } from "../components/VisitFeedback";
import type { FeedbackCategory } from "../components/service-options";

export default function DashboardPage() {
  const { host, isInitialized, activeBranchName, isVisiting, error } = useCorri();
  const [demoInitialized, setDemoInitialized] = useState(false);
  const [timer, setTimer] = useState({ active: false, elapsedSeconds: 0 });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [hasCompletedVisit, setHasCompletedVisit] = useState(false);
  const [snoozedBranch, setSnoozedBranch] = useState<SnoozedBranch | null>(null);
  const [snoozeTimeLeft, setSnoozeTimeLeft] = useState<number | null>(null);
  const [selectedService, setSelectedService] = useState<FeedbackCategory | undefined>();

  const showNotify = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setNotification({ message, type });
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const delayTimer = setTimeout(() => setDemoInitialized(true), 3000);
    return () => clearTimeout(delayTimer);
  }, [isInitialized]);

  useEffect(() => {
    if (!isVisiting || !host || showFeedback || hasCompletedVisit) {
      setTimer({ active: false, elapsedSeconds: 0 });
      return;
    }

    const interval = setInterval(() => {
      setTimer(host.corri.getVisitTimer());
    }, 1000);
    return () => clearInterval(interval);
  }, [hasCompletedVisit, host, isVisiting, showFeedback]);

  useEffect(() => {
    if (!notification) return;

    const timeout = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(timeout);
  }, [notification]);

  useEffect(() => {
    if (!snoozedBranch || !host) {
      setSnoozeTimeLeft(null);
      return;
    }

    const tick = () => {
      const remainingSeconds = Math.max(
        0,
        Math.ceil((Date.parse(snoozedBranch.cooldownEndsAt) - Date.now()) / 1000),
      );
      setSnoozeTimeLeft(remainingSeconds);

      if (remainingSeconds === 0) {
        setSnoozedBranch(null);
        try {
          host.corri.triggerControlledApproach(snoozedBranch.branchId);
          showNotify("The snooze period ended. Please confirm whether you are visiting.", "info");
        } catch (approachError) {
          showNotify(
            approachError instanceof Error
              ? approachError.message
              : "The branch prompt could not be restored.",
            "error",
          );
        }
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [host, showNotify, snoozedBranch]);

  const handleStartMonitoring = async () => {
    if (!host) return;

    try {
      await host.corri.syncNearbyBranches({ latitude: 6.45, longitude: 3.395 });
      host.corri.setConsent({ branchAwareness: true, notifications: true });
      host.corri.startMonitoring();
      setIsMonitoring(true);
      showNotify("Monitoring started! We are now watching for nearby Wema branches.", "success");
    } catch (monitoringError) {
      showNotify(
        monitoringError instanceof Error
          ? monitoringError.message
          : "Failed to start branch monitoring.",
        "error",
      );
    }
  };

  const handleTriggerApproach = () => {
    try {
      setSnoozedBranch(null);
      host?.corri.triggerControlledApproach("wema_marina");
    } catch (approachError) {
      showNotify(
        approachError instanceof Error
          ? approachError.message
          : "Failed to trigger approach. Did you start monitoring?",
        "error",
      );
    }
  };

  const handleStableExit = async () => {
    if (!host) return;

    try {
      const completion = await host.corri.completeVisitManually();
      showNotify(
        `Visit ended with the documented manual demo fallback. Duration: ${completion.durationSeconds} seconds.`,
        "success",
      );
      setTimer({ active: false, elapsedSeconds: 0 });
      setHasCompletedVisit(true);
      setShowFeedback(true);
    } catch (completionError) {
      showNotify(
        completionError instanceof Error
          ? completionError.message
          : "The visit could not be completed.",
        "error",
      );
    }
  };

  if (error) {
    return <div className="p-8 text-red-600 bg-red-50 min-h-screen">Error: {error}</div>;
  }

  if (!demoInitialized) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-screen text-slate-500 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#8B0068] rounded-full animate-spin" />
        <p className="font-medium animate-pulse">Initializing Corri SDK...</p>
      </div>
    );
  }

  const displayedBranchName = isVisiting ? activeBranchName : (snoozedBranch?.branchName ?? "None");

  return (
    <main className="min-h-screen bg-slate-50 p-8 relative">
      <div className="max-w-4xl mx-auto space-y-6">
        {notification && (
          <div
            className={`fixed top-4 left-4 right-4 p-4 rounded-lg shadow-md border z-50 ${
              notification.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : notification.type === "error"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
            } animate-in fade-in slide-in-from-top-4 transition-all duration-300`}
          >
            {notification.message}
          </div>
        )}

        <header className="flex justify-between items-center pb-6 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">Wema Hackaholics - ALAT Demo</h1>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-500" />
            </span>
            <span className="text-sm font-medium text-slate-600">SDK Active</span>
          </div>
        </header>

        {snoozedBranch && snoozeTimeLeft !== null && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex justify-between items-center animate-in fade-in slide-in-from-top-2 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">
                  {snoozedBranch.branchName} visit prompt snoozed
                </p>
                <p className="text-sm text-amber-700">
                  Monitoring continues. The SDK will allow another prompt when the policy cooldown
                  ends.
                </p>
              </div>
            </div>
            <div className="font-mono bg-amber-100 text-amber-900 px-3 py-1.5 rounded-lg font-bold text-sm">
              {Math.floor(snoozeTimeLeft / 60)}:{(snoozeTimeLeft % 60).toString().padStart(2, "0")}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 text-slate-800">Visit Status</h2>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-slate-500">Active Branch:</span>
                <span className="font-medium text-slate-900">{displayedBranchName}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-slate-500">Visit State:</span>
                <span
                  className={`font-medium ${isVisiting && !showFeedback ? "text-green-600" : "text-slate-600"}`}
                >
                  {isVisiting && !showFeedback ? "In Progress" : "Waiting"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Elapsed Time:</span>
                <span className="font-mono bg-slate-100 text-slate-800 px-2 py-1 rounded">
                  {timer.elapsedSeconds}s
                </span>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 text-slate-800">Demo Controls</h2>
            <div className="space-y-3">
              <button
                onClick={handleStartMonitoring}
                disabled={isMonitoring}
                className="w-full bg-slate-800 text-white py-2.5 rounded-lg hover:bg-slate-700 hover:cursor-pointer transition shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMonitoring ? "✓ Monitoring Active" : "1. Sync & Start Monitoring"}
              </button>

              <button
                onClick={handleTriggerApproach}
                disabled={
                  !isMonitoring || isVisiting || hasCompletedVisit || snoozedBranch !== null
                }
                style={{
                  backgroundColor:
                    !isMonitoring || isVisiting || hasCompletedVisit || snoozedBranch !== null
                      ? "#cbd5e1"
                      : "#8B0068",
                }}
                className="w-full text-white py-2.5 rounded-lg hover:opacity-90 hover:cursor-pointer transition shadow-sm font-medium disabled:cursor-not-allowed"
              >
                2. Trigger Approach (Marina)
              </button>

              <button
                onClick={handleStableExit}
                disabled={!isVisiting || showFeedback || hasCompletedVisit}
                className="w-full border-2 border-slate-200 text-slate-700 py-2.5 rounded-lg hover:bg-slate-50 hover:cursor-pointer transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {hasCompletedVisit
                  ? "Visit Completed"
                  : showFeedback
                    ? "Submitting Feedback..."
                    : "3. Complete Visit (Manual Demo Fallback)"}
              </button>
            </div>
          </section>
        </div>

        {isVisiting && !showFeedback && !hasCompletedVisit && (
          <CustomerConcierge onNotify={showNotify} onSelectService={setSelectedService} />
        )}

        <VisitFeedback
          show={showFeedback}
          onClose={() => setShowFeedback(false)}
          initialCategory={selectedService}
        />
      </div>

      <BranchApproachModal onNotify={showNotify} onSnooze={setSnoozedBranch} />
    </main>
  );
}
