"use client";

import { useEffect, useState } from "react";
import { useCorri } from "../components/CorriProvider";

export default function DashboardPage() {
  const { host, isInitialized, activeBranchName, isVisiting, error } = useCorri();
  const [timer, setTimer] = useState({ active: false, elapsedSeconds: 0 });

  // Poll the SDK timer when a visit is active
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isVisiting && host) {
      interval = setInterval(() => {
        setTimer(host.corri.getVisitTimer());
      }, 1000);
    } else {
      setTimer({ active: false, elapsedSeconds: 0 });
    }
    return () => clearInterval(interval);
  }, [isVisiting, host]);

  const handleStartMonitoring = async () => {
    if (!host) return;
    try {
      // 1. Sync nearby branches using the Marina demo coordinates
      await host.corri.syncNearbyBranches({ latitude: 6.45, longitude: 3.395 });
      // 2. Set user consent
      host.corri.setConsent({ branchAwareness: true, notifications: true });
      // 3. Start geofence monitoring
      host.corri.startMonitoring();
      alert("Monitoring started! Branches synced.");
    } catch (err) {
      console.error("Failed to start monitoring:", err);
    }
  };

  const handleTriggerApproach = () => {
    // Manually forces the branchApproach event for the Wema Marina branch
    host?.corri.triggerControlledApproach("wema_marina");
  };

  const handleStableExit = async () => {
    if (!host) return;
    // Simulates leaving the geofence to finalize the visit duration
    host.corri.recordControlledExit();
    const completion = await host.corri.completeStableExit();
    console.log("Visit completed:", completion);
    alert(`Visit ended. Duration: ${completion.durationSeconds} seconds.`);
  };

  // Temporarily handles visit confirmation until we build the visual Modal
  const handleConfirmVisit = async () => {
    if (!host) return;
    await host.corri.confirmVisit();
  };

  if (error) {
    return <div className="p-8 text-red-600 bg-red-50 min-h-screen">Error: {error}</div>;
  }

  if (!isInitialized) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen text-slate-500">
        Initializing Corri SDK...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header preserving Wema brand color identity */}
        <header className="flex justify-between items-center pb-6 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">Wema Hackaholics - ALAT Demo</h1>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-wema-purple opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-wema-purple"></span>
            </span>
            <span className="text-sm font-medium text-slate-600">SDK Active</span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status Panel */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 text-slate-800">Visit Status</h2>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-slate-500">Active Branch:</span>
                <span className="font-medium text-slate-900">{activeBranchName || "None"}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-slate-500">Visit State:</span>
                <span className={`font-medium ${isVisiting ? "text-green-600" : "text-slate-600"}`}>
                  {isVisiting ? "In Progress" : "Waiting"}
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

          {/* Demo Controls Panel */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 text-slate-800">Demo Controls</h2>
            <div className="space-y-3">
              <button
                onClick={handleStartMonitoring}
                className="w-full bg-slate-800 text-white py-2.5 rounded-lg hover:bg-slate-700 transition shadow-sm font-medium"
              >
                1. Sync & Start Monitoring
              </button>

              <button
                onClick={handleTriggerApproach}
                disabled={isVisiting || !!activeBranchName}
                className="w-full bg-wema-purple text-white py-2.5 rounded-lg hover:bg-opacity-90 transition shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                2. Trigger Approach (Marina)
              </button>

              {/* Temporary bypass button for the hackathon UI flow */}
              {activeBranchName && !isVisiting && (
                <button
                  onClick={handleConfirmVisit}
                  className="w-full bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 transition shadow-sm font-medium"
                >
                  Confirm Visit (Bypass Modal)
                </button>
              )}

              <button
                onClick={handleStableExit}
                disabled={!isVisiting}
                className="w-full border-2 border-slate-200 text-slate-700 py-2.5 rounded-lg hover:bg-slate-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                3. Trigger Stable Exit
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
