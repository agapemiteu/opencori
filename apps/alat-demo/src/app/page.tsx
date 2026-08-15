"use client";

import { useEffect, useState, useCallback } from "react";
import { useCorri } from "../components/CorriProvider";
import { BranchApproachModal } from "../components/BranchApproachModal";
import { CustomerConcierge } from "../components/CustomerConcierge";
import { VisitFeedback } from "../components/VisitFeedback";

export default function DashboardPage() {
  const { host, isInitialized, activeBranchName, isVisiting, error } = useCorri();
  
  const [demoInitialized, setDemoInitialized] = useState(false);
  const [timer, setTimer] = useState({ active: false, elapsedSeconds: 0 });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [hasCompletedVisit, setHasCompletedVisit] = useState(false);

  // Snooze & Override States
  const [snoozeTimeLeft, setSnoozeTimeLeft] = useState<number | null>(null);
  const [snoozedBranch, setSnoozedBranch] = useState<string | null>(null);
  const [forceModalOpen, setForceModalOpen] = useState(false);
  const [frontendForceVisiting, setFrontendForceVisiting] = useState(false); // NEW override flag

  useEffect(() => {
    if (isInitialized) {
      const delayTimer = setTimeout(() => {
        setDemoInitialized(true);
      }, 3000); 
      return () => clearTimeout(delayTimer);
    }
  }, [isInitialized]);

  // Visit Timer Effect (Respects frontend override and ticks locally if SDK state is mocked)
  const effectiveIsVisiting = isVisiting || frontendForceVisiting;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (effectiveIsVisiting && host && !showFeedback && !hasCompletedVisit) {
      interval = setInterval(() => {
        const sdkTimer = host.corri.getVisitTimer();
        // Fallback to manual increment if SDK returns 0 during forced state overrides
        setTimer((prev) => ({
          active: true,
          elapsedSeconds: sdkTimer.elapsedSeconds > 0 ? sdkTimer.elapsedSeconds : prev.elapsedSeconds + 1
        }));
      }, 1000);
    } else {
      setTimer({ active: false, elapsedSeconds: 0 });
    }
    return () => clearInterval(interval);
  }, [effectiveIsVisiting, host, showFeedback, hasCompletedVisit]);

  // Snooze Countdown Effect
  useEffect(() => {
    if (snoozeTimeLeft === null) return;

    if (snoozeTimeLeft <= 0) {
      if (!effectiveIsVisiting && !hasCompletedVisit && snoozedBranch) {
        showNotify("Proximity alert: Re-entering branch zone. Please confirm visit.", "info");
        setForceModalOpen(true);
      }
      setSnoozeTimeLeft(null);
      setSnoozedBranch(null);
      return;
    }

    const interval = setInterval(() => {
      setSnoozeTimeLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(interval);
  }, [snoozeTimeLeft, effectiveIsVisiting, hasCompletedVisit, snoozedBranch]);

  // Auto-clear notifications
  useEffect(() => {
    if (notification) {
      const timeout = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timeout); 
    }
  }, [notification]);

  const showNotify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
  }, []);

  const handleSnoozeTriggered = useCallback((branchName: string) => {
    setSnoozedBranch(branchName);
    setSnoozeTimeLeft(5); // 5 seconds for rapid testing. Change back to 180 later!
  }, []);

  const handleClearSnooze = useCallback(() => {
    setSnoozeTimeLeft(null);
    setSnoozedBranch(null);
    setForceModalOpen(false);
  }, []);

  const handleForceConfirm = useCallback(() => {
    setFrontendForceVisiting(true);
    handleClearSnooze();
    showNotify("Welcome! You are now checked into the branch.", "success");
  }, [handleClearSnooze, showNotify]);

  const handleStartMonitoring = async () => {
    if (!host) return;
    try {
      await host.corri.syncNearbyBranches({ latitude: 6.45, longitude: 3.395 });
      host.corri.setConsent({ branchAwareness: true, notifications: true });
      host.corri.startMonitoring();
      
      setIsMonitoring(true);
      showNotify("Monitoring started! We are now watching for nearby Wema branches.", "success");
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      showNotify(error.message || "Failed to start monitoring", "error");
    }
  };

  const handleTriggerApproach = () => {
    try {
      handleClearSnooze(); 
      setFrontendForceVisiting(false);
      host?.corri.triggerControlledApproach("wema_marina");
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      showNotify(error.message || "Failed to trigger approach. Did you start monitoring?", "error");
    }
  };

  const handleStableExit = async () => {
    if (!host) return;
    
    try {
      await Promise.resolve(host.corri.recordControlledExit());
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const completion = await host.corri.completeStableExit();
      showNotify(`Visit ended securely. Duration: ${completion.durationSeconds} seconds.`, "success");
      
      setTimer({ active: false, elapsedSeconds: 0 });
      setFrontendForceVisiting(false);
      setHasCompletedVisit(true);
      setShowFeedback(true);
    } catch (err) {
      console.warn("SDK State Machine fallback triggered:", err);
      showNotify(`Visit ended securely. Duration: ${timer.elapsedSeconds} seconds.`, "success");
      
      setTimer({ active: false, elapsedSeconds: 0 });
      setFrontendForceVisiting(false);
      setHasCompletedVisit(true);
      setShowFeedback(true);
    }
  };

  if (error) {
    return <div className="p-8 text-red-600 bg-red-50 min-h-screen">Error: {error}</div>;
  }

  if (!demoInitialized) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-screen text-slate-500 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#8B0068] rounded-full animate-spin"></div>
        <p className="font-medium animate-pulse">Initializing Corri SDK...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 relative">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {notification && (
          <div className={`fixed top-4 left-4 right-4 p-4 rounded-lg shadow-md border z-50 ${
            notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 
            notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 
            'bg-blue-50 border-blue-200 text-blue-800'
          } animate-in fade-in slide-in-from-top-4 transition-all duration-300`}>
            {notification.message}
          </div>
        )}

        <header className="flex justify-between items-center pb-6 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">Wema Hackaholics - ALAT Demo</h1>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-500"></span>
            </span>
            <span className="text-sm font-medium text-slate-600">SDK Active</span>
          </div>
        </header>

        {snoozeTimeLeft !== null && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex justify-between items-center animate-in fade-in slide-in-from-top-2 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></div>
              <div>
                <p className="font-semibold text-amber-900 text-sm">Visit Snoozed: Monitoring location in background</p>
                <p className="text-xs text-amber-700">Will re-prompt for check-in when timer expires</p>
              </div>
            </div>
            <div className="font-mono bg-amber-100 text-amber-900 px-3 py-1.5 rounded-lg font-bold text-sm">
              {Math.floor(snoozeTimeLeft / 60)}:{(snoozeTimeLeft % 60).toString().padStart(2, '0')}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 text-slate-800">Visit Status</h2>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-slate-500">Active Branch:</span>
                <span className="font-medium text-slate-900">{activeBranchName || snoozedBranch || "None"}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-slate-500">Visit State:</span>
                <span className={`font-medium ${effectiveIsVisiting && !showFeedback ? "text-green-600" : "text-slate-600"}`}>
                  {effectiveIsVisiting && !showFeedback ? "In Progress" : "Waiting"}
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
                disabled={!isMonitoring || effectiveIsVisiting || hasCompletedVisit}
                style={{ backgroundColor: (!isMonitoring || effectiveIsVisiting || hasCompletedVisit) ? '#cbd5e1' : '#8B0068' }}
                className="w-full text-white py-2.5 rounded-lg hover:opacity-90 hover:cursor-pointer transition shadow-sm font-medium disabled:cursor-not-allowed"
              >
                2. Trigger Approach (Marina)
              </button>

              <button
                onClick={handleStableExit}
                disabled={!effectiveIsVisiting || showFeedback || hasCompletedVisit}
                className="w-full border-2 border-slate-200 text-slate-700 py-2.5 rounded-lg hover:bg-slate-50 hover:cursor-pointer transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {hasCompletedVisit ? "Visit Completed" : showFeedback ? "Submitting Feedback..." : "3. Trigger Stable Exit"}
              </button>
            </div>
          </section>
        </div>

        {/* Updated check to respect effectiveIsVisiting */}
        {effectiveIsVisiting && !showFeedback && !hasCompletedVisit && <CustomerConcierge onNotify={showNotify} />}
        
        <VisitFeedback 
          show={showFeedback} 
          onClose={() => setShowFeedback(false)} 
        />

      </div>
      
      <BranchApproachModal 
        onNotify={showNotify} 
        onSnooze={handleSnoozeTriggered} 
        onClearSnooze={handleClearSnooze}
        forceOpen={forceModalOpen}
        snoozedBranchName={snoozedBranch}
        onForceConfirm={handleForceConfirm}
      />
    </main>
  );
}