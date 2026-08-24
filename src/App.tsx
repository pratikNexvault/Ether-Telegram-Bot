import React, { useState, useEffect } from "react";
import { 
  Bot, 
  MessageSquare, 
  Sparkles, 
  Settings, 
  Code2, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCw,
  Crown,
  Flame,
  Zap,
  Cpu,
  BookOpen
} from "lucide-react";
import { TelegramSimulator } from "./components/TelegramSimulator";
import { HelpReferenceView } from "./components/HelpReferenceView";
import { ConfigPanel } from "./components/ConfigPanel";
import { CodeExplorer } from "./components/CodeExplorer";
import { TwoByTwoCards } from "./components/TwoByTwoCards";
import { RaidManagerModal } from "./components/RaidManagerModal";
import { BotStatus } from "./types";
import { toMathBold } from "./utils/mathBold";

export default function App() {
  const [activeTab, setActiveTab] = useState<"cards" | "simulator" | "help" | "config" | "code">("cards");
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRaidModalOpen, setIsRaidModalOpen] = useState(false);
  const [raidMessages, setRaidMessages] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("ether_raid_messages");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [externalTrigger, setExternalTrigger] = useState<{ cmd: string; target?: string; timestamp: number } | null>(null);
  const [isRaidActive, setIsRaidActive] = useState(false);
  const [raidTargetUsername, setRaidTargetUsername] = useState<string | null>(null);
  const [raidCycleIndex, setRaidCycleIndex] = useState(0);

  const fetchStatus = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/bot/status");
      const data = await res.json();
      setBotStatus(data);
    } catch (e) {
      console.error("Status fetch failed:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchRaidMessages = async () => {
    try {
      const res = await fetch("/api/bot/raid-messages");
      const data = await res.json();
      if (data && data.messages && data.messages.length > 0) {
        setRaidMessages(data.messages);
        try {
          localStorage.setItem("ether_raid_messages", JSON.stringify(data.messages));
        } catch (e) {}
      }
    } catch (e) {
      console.error("Raid messages fetch failed:", e);
    }
  };

  const handleUpdateRaidMessages = async (newMsgs: string[]) => {
    setRaidMessages(newMsgs);
    try {
      localStorage.setItem("ether_raid_messages", JSON.stringify(newMsgs));
    } catch (e) {}

    try {
      await fetch("/api/bot/raid-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs }),
      });
    } catch (e) {
      console.error("Failed to sync raid messages:", e);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchRaidMessages();
  }, []);

  const handleExecuteCommand = (cmd: string, target?: string) => {
    setActiveTab("simulator");
    setExternalTrigger({ cmd, target, timestamp: Date.now() });
  };

  const handleStartRaidFromModal = (target: string) => {
    setIsRaidActive(true);
    setRaidTargetUsername(target);
    setActiveTab("simulator");
    setExternalTrigger({ cmd: `.raid @${target}`, target, timestamp: Date.now() });
  };

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100 font-sans flex flex-col antialiased selection:bg-cyan-400 selection:text-slate-950">
      {/* Top Application Header (White Background & Deep Black Typography) */}
      <header className="bg-[#0b1728]/95 backdrop-blur-xl border-b border-cyan-400/20 sticky top-0 z-40 shadow-[0_8px_30px_rgba(0,0,0,.22)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-300 to-violet-500 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-400/20 ring-1 ring-white/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-xl text-white tracking-wider">
                  {toMathBold("ETHER BOT")}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-400/10 text-cyan-300 border border-cyan-300/20 text-[10px] font-black tracking-wider">
                  {toMathBold("V2.0 PROD")}
                </span>
              </div>
               <p className="text-xs text-slate-400 font-bold">
                 {toMathBold("OFFICIAL TELEGRAM GROUP BOT • ETHER CONTROL PANEL")}
              </p>
            </div>
          </div>

          {/* Quick Status Bar */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Owner badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-950 text-xs font-black">
              <Crown className="w-3.5 h-3.5 text-amber-700" />
              <span>{toMathBold("ETHER CONTROL")}</span>
            </div>

            {/* Telegram Live Connection Indicator */}
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-emerald-400/30 text-xs font-bold shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-slate-100 font-black">
                {toMathBold("STATUS: ONLINE")}
              </span>
               <span className="text-[11px] text-slate-400 font-mono">
                (~18ms)
              </span>
            </div>

            <button
              onClick={fetchStatus}
              disabled={isRefreshing}
              title="Refresh status"
               className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-slate-900" : ""}`} />
            </button>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-white/5 pt-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab("cards")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === "cards"
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5 border-transparent"
            }`}
          >
            <Cpu className="w-4 h-4 text-amber-400" />
            <span>{toMathBold("2X2 MODULE DASHBOARD")}</span>
          </button>

          <button
            onClick={() => setActiveTab("simulator")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === "simulator"
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5 border-transparent"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <span>{toMathBold("TELEGRAM SIMULATOR")}</span>
          </button>

          <button
            onClick={() => setActiveTab("help")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === "help"
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5 border-transparent"
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>{toMathBold(".HELP COMMANDS")}</span>
          </button>

          <button
            onClick={() => setActiveTab("config")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === "config"
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5 border-transparent"
            }`}
          >
            <Settings className="w-4 h-4 text-purple-400" />
            <span>{toMathBold("CONFIG & POOL")}</span>
          </button>

          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === "code"
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5 border-transparent"
            }`}
          >
            <Code2 className="w-4 h-4 text-amber-400" />
            <span>{toMathBold("PYTHON CODEBASE & ZIP")}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* If Active Tab is Cards: Show the 2x2 Grid + Integrated Simulator */}
        {activeTab === "cards" && (
          <div className="space-y-6">
            {/* 2 X 2 CARDS (PRIMARY REQUIREMENT) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-black text-slate-900 tracking-wider flex items-center gap-2">
                   <span>{toMathBold("ETHER BOT MODULES")}</span>
                </h2>
                <span className="text-xs font-bold text-slate-600">
                  {toMathBold("TAP RAID REPLY TO INSERT & SAVE MESSAGES")}
                </span>
              </div>

              <TwoByTwoCards
                raidMessages={raidMessages}
                onOpenRaidModal={() => setIsRaidModalOpen(true)}
                onExecuteCommand={handleExecuteCommand}
                botStatus={botStatus}
                isRaidActive={isRaidActive}
                raidTargetUsername={raidTargetUsername}
                raidCycleIndex={raidCycleIndex}
                onUpdateRaidMessages={handleUpdateRaidMessages}
              />
            </div>

            {/* Live Simulator Preview */}
            <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 shadow-md">
              <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {toMathBold("LIVE CONSOLE & TARGET TESTING")}
                  </h3>
                  <p className="text-xs text-slate-600 font-bold">
                    Test how bot replies 1-by-1 sequentially to target messages (@RAGHU_7X).
                  </p>
                </div>
                <button
                  onClick={() => setIsRaidModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow transition-all"
                >
                  {toMathBold("+ INSERT & SAVE RAID MSGS")}
                </button>
              </div>

              <TelegramSimulator
                botStatus={botStatus}
                onRefreshStatus={fetchStatus}
                onOpenRaidModal={() => setIsRaidModalOpen(true)}
                raidMessages={raidMessages}
                externalTrigger={externalTrigger}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Dedicated Full Simulator */}
        {activeTab === "simulator" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white border-2 border-slate-900 p-4 rounded-2xl shadow-sm">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  {toMathBold("TELEGRAM SIMULATOR CONSOLE")}
                </h2>
                <p className="text-xs text-slate-600 font-bold">
                  Simulating active group events with 1:1 Sequential Raid Responses on @RAGHU_7X.
                </p>
              </div>
              <button
                onClick={() => setIsRaidModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow transition-all"
              >
                {toMathBold("+ EDIT RAID MSGS")}
              </button>
            </div>

            <TelegramSimulator
              botStatus={botStatus}
              onRefreshStatus={fetchStatus}
              onOpenRaidModal={() => setIsRaidModalOpen(true)}
              raidMessages={raidMessages}
              externalTrigger={externalTrigger}
            />
          </div>
        )}

        {/* Tab 3: Help Menu View */}
        {activeTab === "help" && (
          <HelpReferenceView modules={botStatus?.modules || []} />
        )}

        {/* Tab 4: Config Panel */}
        {activeTab === "config" && (
          <ConfigPanel
            onSaved={() => {
              fetchStatus();
              fetchRaidMessages();
            }}
          />
        )}

        {/* Tab 5: Python Code Explorer */}
        {activeTab === "code" && <CodeExplorer />}
      </main>

      {/* RAID MANAGER MODAL (Opened by tapping RAID REPLY) */}
      <RaidManagerModal
        isOpen={isRaidModalOpen}
        onClose={() => setIsRaidModalOpen(false)}
        currentMessages={raidMessages}
        onSaved={(newMsgs) => {
          setRaidMessages(newMsgs);
          fetchStatus();
        }}
        onStartRaid={handleStartRaidFromModal}
      />

      {/* Footer */}
      <footer className="bg-[#0b1728] border-t border-cyan-400/20 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs font-black text-slate-700 gap-2">
          <span>{toMathBold("ETHER BOT © 2026 • SECURE CONTROL PANEL")}</span>
          <span className="text-slate-400 font-mono text-[11px]">
            1:1 Round-Robin Recycled Raid Engine Active
          </span>
        </div>
      </footer>
    </div>
  );
}
