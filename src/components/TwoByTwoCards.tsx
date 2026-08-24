import React, { useState } from "react";
import { 
  Flame, 
  Cpu, 
  Zap, 
  MessageSquare, 
  Plus, 
  Target,
  Trash2,
  Terminal,
  Check
} from "lucide-react";
import { toMathBold } from "../utils/mathBold";
import { BotStatus } from "../types";

interface Props {
  raidMessages: string[];
  onOpenRaidModal: () => void;
  onExecuteCommand: (cmd: string, target?: string) => void;
  botStatus: BotStatus | null;
  isRaidActive: boolean;
  raidTargetUsername: string | null;
  raidCycleIndex: number;
  onUpdateRaidMessages?: (newMsgs: string[]) => void;
}

export const TwoByTwoCards: React.FC<Props> = ({
  raidMessages,
  onOpenRaidModal,
  onExecuteCommand,
  botStatus,
  isRaidActive,
  raidTargetUsername,
  raidCycleIndex,
  onUpdateRaidMessages,
}) => {
  const [quickInput, setQuickInput] = useState("");
  const [justSavedQuick, setJustSavedQuick] = useState(false);
  const [spamCount, setSpamCount] = useState(5);
  const [spamText, setSpamText] = useState("ETHER_POWER");
  const [targetName, setTargetName] = useState("username");

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!quickInput.trim()) return;
    const newMsg = quickInput.trim();
    const updated = [...raidMessages, newMsg];
    if (onUpdateRaidMessages) {
      onUpdateRaidMessages(updated);
    }
    setQuickInput("");
    setJustSavedQuick(true);
    setTimeout(() => setJustSavedQuick(false), 2000);
  };

  const handleQuickRemove = (indexToRemove: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = raidMessages.filter((_, idx) => idx !== indexToRemove);
    if (onUpdateRaidMessages) {
      onUpdateRaidMessages(updated);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
      {/* ========================================================= */}
      {/* 1. TOP-LEFT CARD: RAID REPLY */}
      {/* ========================================================= */}
      <div 
        className="bg-white border-2 border-slate-900 hover:border-amber-600 rounded-2xl p-5 shadow-md hover:shadow-xl transition-all flex flex-col justify-between relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-100/50 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />

        <div>
          {/* Card Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md">
                <Flame className="w-6 h-6 text-slate-950" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-wide">
                  {toMathBold("RAID REPLY")}
                </h3>
                <span className="text-xs text-slate-600 font-bold">
                  {toMathBold("SEQUENTIAL AUTO-REPLIES")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {isRaidActive ? (
                <span className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 text-[11px] font-black animate-pulse shadow-sm">
                  {toMathBold("ACTIVE: @") + (raidTargetUsername || "TARGET")}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-black border border-slate-300">
                  {toMathBold("READY")}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-700 font-medium mb-3">
            Target jab bhi group me msg bhejega, bot aapke saved messages me se 1-by-1 reply dega:
          </p>

          {/* Quick Insert Input right on the card */}
          <form onSubmit={handleQuickAdd} className="flex gap-1.5 mb-3">
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Insert custom message..."
              className="flex-1 bg-slate-50 border-2 border-slate-300 focus:border-slate-900 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!quickInput.trim()}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-black flex items-center gap-1 shrink-0 shadow-sm"
            >
              {justSavedQuick ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Plus className="w-3.5 h-3.5 text-amber-400" />}
              <span>{justSavedQuick ? toMathBold("SAVED!") : toMathBold("INSERT")}</span>
            </button>
          </form>

          {/* Saved Messages Pool Container */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-slate-900">
              <span className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                {toMathBold(`SAVED POOL: ${raidMessages.length} MESSAGES`)}
              </span>
              <span className="text-amber-800 text-[11px] font-bold">
                {isRaidActive ? `Next: #${(raidCycleIndex % (raidMessages.length || 1)) + 1}` : "Sequential Loop"}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto pr-1">
              {raidMessages.length === 0 ? (
                <div className="text-slate-500 text-xs py-1 italic">
                  Koi custom message nahi hai. Type karke INSERT kare!
                </div>
              ) : (
                raidMessages.map((msg, i) => (
                  <span 
                    key={i} 
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-bold shadow-sm group/pill"
                  >
                    <span className="w-4 h-4 rounded bg-slate-900 text-amber-400 text-[10px] font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="truncate max-w-[130px]">{msg}</span>
                    <button
                      type="button"
                      onClick={(e) => handleQuickRemove(i, e)}
                      title="Delete this message"
                      className="text-slate-400 hover:text-rose-600 transition-colors ml-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={onOpenRaidModal}
            className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md transition-all"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>{toMathBold("MANAGE MESSAGES")}</span>
          </button>

          <button
            onClick={() => onExecuteCommand(`.raid @${targetName || "target"}`)}
            className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-md transition-all"
          >
            <Target className="w-4 h-4 text-slate-950" />
            <span>{toMathBold(".RAID @TARGET")}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. TOP-RIGHT CARD: SPAM */}
      {/* ========================================================= */}
      <div 
        className="bg-white border-2 border-slate-900 rounded-2xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-100/50 rounded-bl-full pointer-events-none" />

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black shadow-md">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-wide">
                  {toMathBold("SPAM")}
                </h3>
                <span className="text-xs text-slate-600 font-bold">
                  {toMathBold("REPEATING MESSAGE SENDER")}
                </span>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-950 text-[11px] font-black border border-purple-300">
              {toMathBold("AUTOMATED")}
            </span>
          </div>

          <p className="text-xs text-slate-700 font-medium mb-3">
            Controlled repeating message sender with <code>.stopspam</code> halt trigger:
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block">{toMathBold("SPAM COUNT")}</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={spamCount}
                  onChange={(e) => setSpamCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-black text-slate-900 mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block">{toMathBold("SPAM TEXT")}</label>
                <input
                  type="text"
                  value={spamText}
                  onChange={(e) => setSpamText(e.target.value)}
                   placeholder="ETHER_POWER"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 mt-0.5"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200">
              <span><b>{toMathBold("LIMIT:")}</b> 20 Msgs</span>
              <span><b>{toMathBold("DELAY:")}</b> 1.0s Interval</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
             onClick={() => onExecuteCommand(`.spam ${spamCount} ${spamText || "ETHER_POWER"}`)}
            className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-purple-200" />
            <span>{toMathBold(`RUN .SPAM ${spamCount}`)}</span>
          </button>
          <button
            onClick={() => onExecuteCommand(".stopspam")}
            className="py-2.5 px-3 rounded-xl bg-rose-100 hover:bg-rose-200 border-2 border-rose-400 text-rose-950 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <span>{toMathBold(".STOPSPAM")}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. BOTTOM-LEFT CARD: SYSTEM */}
      {/* ========================================================= */}
      <div 
        className="bg-white border-2 border-slate-900 rounded-2xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/50 rounded-bl-full pointer-events-none" />

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-wide">
                  {toMathBold("SYSTEM")}
                </h3>
                <span className="text-xs text-slate-600 font-bold">
                  {toMathBold("CORE TELEGRAM ENGINE & STATUS")}
                </span>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-950 text-[11px] font-black border border-emerald-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              {toMathBold("ONLINE")}
            </span>
          </div>

          <p className="text-xs text-slate-700 font-medium mb-3">
            Bot authority strictly restricted to owner. Ultra-fast ping response & diagnostic handler:
          </p>

          <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-500 font-bold uppercase">{toMathBold("STRICT OWNER")}</div>
              <div className="font-black text-slate-900">Configured owner</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-500 font-bold uppercase">{toMathBold("LATENCY / UPTIME")}</div>
              <div className="font-black text-emerald-700">~18 ms (99.9% Up)</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={() => onExecuteCommand(".lockall")}
            className="py-2 px-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center justify-center gap-1 transition-all shadow-md"
          >
            <span>{toMathBold("🔴 .LOCKALL")}</span>
          </button>
          <button
            onClick={() => onExecuteCommand(".unlockall")}
            className="py-2 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1 transition-all shadow-md"
          >
            <span>{toMathBold("🟢 .UNLOCKALL")}</span>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2">
          <button
            onClick={() => onExecuteCommand(".ping")}
            className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-900 text-xs font-black flex items-center justify-center gap-1 transition-all shadow-sm"
          >
            <Terminal className="w-3.5 h-3.5 text-blue-600" />
            <span>{toMathBold(".PING")}</span>
          </button>
          <button
            onClick={() => onExecuteCommand(".status")}
            className="py-1.5 px-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 border-2 border-emerald-300 text-emerald-950 text-xs font-black flex items-center justify-center gap-1 transition-all shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-700" />
            <span>{toMathBold(".STATUS")}</span>
          </button>
          <button
            onClick={() => onExecuteCommand(".help group")}
            className="py-1.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center justify-center gap-1 transition-all shadow-sm"
          >
            <span>{toMathBold(".HELP GC")}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. BOTTOM-RIGHT CARD: SIMULATOR & TARGET TEST */}
      {/* ========================================================= */}
      <div 
        className="bg-white border-2 border-slate-900 rounded-2xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100/50 rounded-bl-full pointer-events-none" />

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-wide">
                  {toMathBold("SIMULATOR & TEST")}
                </h3>
                <span className="text-xs text-slate-600 font-bold">
                  {toMathBold("LIVE TELEGRAM TESTING")}
                </span>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-950 text-[11px] font-black border border-emerald-300">
              {toMathBold("INTERACTIVE")}
            </span>
          </div>

          <p className="text-xs text-slate-700 font-medium mb-3">
            Live chat simulator for testing commands and auto-reply sequences in real-time:
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between font-bold text-slate-900">
              <span className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-600" />
                {toMathBold("AUTO-REPLY PROTOCOL")}
              </span>
              <span className="text-emerald-700 font-black">1:1 Response</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Target jitni baar message karega, bot sequentially aapke saved list se ek-ek message send karega.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={() => onExecuteCommand(".help raid")}
            className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <Target className="w-3.5 h-3.5 text-slate-950" />
            <span>{toMathBold(".HELP RAID")}</span>
          </button>
          <button
            onClick={() => onExecuteCommand(".help")}
            className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <span>{toMathBold(".HELP MENU")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
