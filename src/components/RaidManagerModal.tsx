import React, { useState, useEffect } from "react";
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  Check, 
  Flame, 
  ListPlus, 
  Info
} from "lucide-react";
import { toMathBold } from "../utils/mathBold";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (messages: string[]) => void;
  currentMessages: string[];
  onStartRaid?: (target: string) => void;
}

export const RaidManagerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSaved,
  currentMessages,
}) => {
  const [messagesList, setMessagesList] = useState<string[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [batchVal, setBatchVal] = useState("");
  const [showBatch, setShowBatch] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMessagesList([...currentMessages]);
    }
  }, [isOpen, currentMessages]);

  if (!isOpen) return null;

  const persistMessages = async (msgs: string[]) => {
    try {
      localStorage.setItem("ether_raid_messages", JSON.stringify(msgs));
    } catch (e) {}

    try {
      await fetch("/api/bot/raid-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });
    } catch (e) {
      console.error("Failed to sync raid messages with server:", e);
    }
  };

  const handleAddMessage = () => {
    if (!inputVal.trim()) return;
    const newMsg = inputVal.trim();
    const updated = [...messagesList, newMsg];
    setMessagesList(updated);
    setInputVal("");
    persistMessages(updated);
    onSaved(updated);
  };

  const handleRemoveMessage = (idx: number) => {
    const updated = messagesList.filter((_, i) => i !== idx);
    setMessagesList(updated);
    persistMessages(updated);
    onSaved(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await persistMessages(messagesList);
      setSavedSuccess(true);
      onSaved(messagesList);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) {
      console.error("Failed to save raid messages:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchInsert = () => {
    const lines = batchVal
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length > 0) {
      const updated = [...messagesList, ...lines];
      setMessagesList(updated);
      setBatchVal("");
      setShowBatch(false);
      persistMessages(updated);
      onSaved(updated);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white border-2 border-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow">
              <Flame className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide">
                {toMathBold("RAID REPLY MESSAGES")}
              </h2>
              <p className="text-xs text-slate-300">
                {toMathBold("ADD CUSTOM MESSAGES FOR 1:1 REPLIES")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50">
          {/* Quick Explanation Banner */}
          <div className="bg-white border-2 border-slate-200 rounded-xl p-3.5 shadow-sm space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{toMathBold("HOW IT WORKS:")}</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed pl-6">
              Aap yaha jo bhi messages add karenge, target ke har message par bot sequential order me unme se 1-by-1 reply dega. List khatam hone par wapas start se repeat hoga.
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowBatch(!showBatch)}
              className="px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 border border-blue-300 text-blue-950 text-xs font-black flex items-center gap-1 transition-all"
            >
              <ListPlus className="w-3.5 h-3.5 text-blue-700" />
              <span>{toMathBold("BATCH PASTE")}</span>
            </button>
            {messagesList.length > 0 && (
              <button
                onClick={() => {
                  setMessagesList([]);
                  persistMessages([]);
                  onSaved([]);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-950 text-xs font-black flex items-center gap-1 transition-all ml-auto"
              >
                <Trash2 className="w-3 h-3 text-rose-700" />
                <span>{toMathBold("CLEAR ALL")}</span>
              </button>
            )}
          </div>

          {/* Batch Textarea if opened */}
          {showBatch && (
            <div className="bg-white border-2 border-blue-400 rounded-xl p-3 space-y-2 shadow-sm">
              <label className="text-xs font-black text-slate-900 block">
                {toMathBold("PASTE MULTIPLE MESSAGES (1 PER LINE):")}
              </label>
              <textarea
                rows={4}
                value={batchVal}
                onChange={(e) => setBatchVal(e.target.value)}
                placeholder={"Enter messages (one per line)..."}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowBatch(false)}
                  className="px-3 py-1 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchInsert}
                  className="px-4 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-black"
                >
                  {toMathBold("INSERT LINES")}
                </button>
              </div>
            </div>
          )}

          {/* Single Message Input Bar */}
          <div className="bg-white border-2 border-slate-900 rounded-xl p-2.5 shadow-sm">
            <label className="block text-xs font-black text-slate-900 mb-1.5">
              {toMathBold("INSERT NEW RAID MESSAGE:")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Type your message here..."
                className="flex-1 bg-slate-50 border border-slate-300 focus:border-slate-900 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddMessage();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddMessage}
                disabled={!inputVal.trim()}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-black flex items-center gap-1.5 transition-all shrink-0 shadow"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>{toMathBold("INSERT")}</span>
              </button>
            </div>
          </div>

          {/* Messages List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-600" />
                {toMathBold(`SAVED MESSAGES POOL (${messagesList.length} MSGS)`)}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Sequential Loop
              </span>
            </div>

            <div className="bg-white border-2 border-slate-200 rounded-xl p-3 max-h-[220px] overflow-y-auto space-y-2 shadow-inner">
              {messagesList.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs font-medium">
                  Abhi koi message saved nahi hai. Upar text type karke <b>INSERT</b> kare!
                </div>
              ) : (
                messagesList.map((msg, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-50 border border-slate-200 hover:border-slate-900 rounded-lg p-2 text-xs text-slate-900 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden mr-2">
                      <span className="w-6 h-6 rounded bg-slate-900 text-amber-400 font-black text-[11px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold truncate select-all">{msg}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveMessage(idx)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                      title="Remove message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t-2 border-slate-200 px-5 py-3.5 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black transition-colors"
          >
            {toMathBold("CLOSE")}
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 shadow-lg transition-all"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">{toMathBold("SAVED SUCCESSFULLY!")}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-amber-400" />
                <span>{isSaving ? toMathBold("SAVING...") : toMathBold("SAVE MESSAGES")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
