import React, { useState, useEffect, useRef } from "react";
import { 
  Send, 
  RotateCcw, 
  Shield, 
  Crown, 
  User, 
  Bot, 
  Flame, 
  Zap, 
  CornerDownRight, 
  CheckCheck,
  AlertCircle,
  Sparkles,
  Target,
  Plus
} from "lucide-react";
import { ChatMessage, BotStatus } from "../types";
import { toMathBold } from "../utils/mathBold";

interface Props {
  botStatus: BotStatus | null;
  onRefreshStatus: () => void;
  onOpenRaidModal?: () => void;
  raidMessages: string[];
  externalTrigger?: { cmd: string; target?: string; timestamp: number } | null;
}

export const TelegramSimulator: React.FC<Props> = ({
  botStatus,
  onRefreshStatus,
  onOpenRaidModal,
  raidMessages,
  externalTrigger,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-1",
      sender: "XYRO_7X",
      senderRole: "owner",
      text: ".help",
      timestamp: "10:17 PM",
      isCommand: true,
    },
    {
      id: "msg-2",
       sender: "ETHER BOT",
      senderRole: "bot",
      text: `<code>❊═══〖 MODULES 〗═══❊</code>\n<code>◇➤ raid (2 commands)</code>\n<code>◇➤ spam (2 commands)</code>\n<code>◇➤ system (1 command)</code>\n\n<code>Type .help &lt;module&gt; for commands</code>\n<code>❊═════════════════════════════════❊</code>`,
      timestamp: "10:17 PM",
      type: "bot_response",
      parseMode: "HTML",
    }
  ]);

  const [inputVal, setInputVal] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<"owner" | "admin" | "member">("owner");
  const [customSenderName, setCustomSenderName] = useState("");
  const [targetUsernameInput, setTargetUsernameInput] = useState("RAGHU_7X");
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRaidActive, setIsRaidActive] = useState(false);
  const [raidTargetUsername, setRaidTargetUsername] = useState<string | null>(null);
  const [raidTargetId, setRaidTargetId] = useState<string | null>(null);
  const [raidReplyCycleCount, setRaidReplyCycleCount] = useState<number>(0);
  const [activeSpamInterval, setActiveSpamInterval] = useState<any>(null);
  const [spamCountRemaining, setSpamCountRemaining] = useState<number | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle external trigger (from 2x2 cards)
  useEffect(() => {
    if (externalTrigger && externalTrigger.cmd) {
      handleSendMessage(externalTrigger.cmd, null, "XYRO_7X", "owner");
    }
  }, [externalTrigger]);

  const getCurrentSenderName = () => {
    if (customSenderName.trim()) return customSenderName.trim().replace(/^@/, "");
    if (currentUserRole === "owner") return "XYRO_7X";
    if (currentUserRole === "admin") return "Group_Admin";
    return targetUsernameInput || raidTargetUsername || "RAGHU_7X";
  };

  const handleSendMessage = async (
    customText?: string,
    explicitReply?: ChatMessage | null,
    explicitSender?: string,
    explicitRole?: "owner" | "admin" | "member"
  ) => {
    const textToSend = (customText !== undefined ? customText : inputVal).trim();
    if (!textToSend && !customText) return;

    setInputVal("");
    const targetMsg = explicitReply !== undefined ? explicitReply : replyTarget;
    setReplyTarget(null);

    const senderName = explicitSender || getCurrentSenderName();
    const activeRole = explicitRole || currentUserRole;
    const newMsgId = `msg-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: newMsgId,
      sender: senderName,
      senderRole: activeRole,
      text: textToSend,
      timestamp,
      isCommand: textToSend.startsWith(".") || textToSend.startsWith("/"),
      replyToId: targetMsg ? targetMsg.id : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const res = await fetch("/api/bot/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commandText: textToSend,
          userRole: activeRole,
          senderUsername: senderName,
          replyToMessage: targetMsg ? { id: targetMsg.id, text: targetMsg.text, sender: targetMsg.sender } : null,
        }),
      });

      const data = await res.json();
      setIsProcessing(false);

      if (data.chatState) {
        setIsRaidActive(data.chatState.raidEnabled);
        setRaidTargetId(data.chatState.raidTargetId);
        setRaidTargetUsername(data.chatState.raidTargetUsername || null);
        if (data.chatState.raidReplyIndex !== undefined) {
          setRaidReplyCycleCount(data.chatState.raidReplyIndex);
        }
      }

      if (data.responses && data.responses.length > 0) {
        for (const resp of data.responses) {
          if (resp.type === "spam_sequence") {
            startSpamSimulation(resp.text, resp.count, resp.delay || 1.0);
          } else {
            const botMsg: ChatMessage = {
              id: `bot-${Date.now()}-${Math.random()}`,
       sender: "ETHER BOT",
              senderRole: "bot",
              text: resp.text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: resp.type || "bot_response",
              parseMode: resp.parse_mode,
              replyToId: newMsgId,
            };
            setMessages((prev) => [...prev, botMsg]);
          }
        }
      }
    } catch (err) {
      setIsProcessing(false);
      console.error("Simulation error:", err);
    }
  };

  const startSpamSimulation = (text: string, count: number, delaySec: number) => {
    if (activeSpamInterval) {
      clearInterval(activeSpamInterval);
    }

    let sent = 0;
    setSpamCountRemaining(count);

    const interval = setInterval(() => {
      sent += 1;
      setSpamCountRemaining(count - sent);

      const spamMsg: ChatMessage = {
        id: `spam-${Date.now()}-${sent}`,
               sender: "ETHER BOT",
        senderRole: "bot",
        text: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: "spam_msg",
      };

      setMessages((prev) => [...prev, spamMsg]);

      if (sent >= count) {
        clearInterval(interval);
        setActiveSpamInterval(null);
        setSpamCountRemaining(null);

        const compMsg: ChatMessage = {
          id: `comp-${Date.now()}`,
         sender: "ETHER BOT",
          senderRole: "bot",
          text: "✅ <b>Spam completed.</b>",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: "bot_response",
          parseMode: "HTML",
        };
        setMessages((prev) => [...prev, compMsg]);
      }
    }, Math.max(400, delaySec * 1000));

    setActiveSpamInterval(interval);
  };

  const handleStopSpamManual = async () => {
    if (activeSpamInterval) {
      clearInterval(activeSpamInterval);
      setActiveSpamInterval(null);
      setSpamCountRemaining(null);
    }
    handleSendMessage(".stopspam", null, "XYRO_7X", "owner");
  };

  const handleClearChat = () => {
    if (activeSpamInterval) {
      clearInterval(activeSpamInterval);
      setActiveSpamInterval(null);
      setSpamCountRemaining(null);
    }
    setMessages([
      {
        id: "msg-init",
        sender: "ETHER BOT",
        senderRole: "bot",
        text: `<code>❊═══〖 MODULES 〗═══❊</code>\n<code>◇➤ raid (2 commands)</code>\n<code>◇➤ spam (2 commands)</code>\n<code>◇➤ system (1 command)</code>\n\n<code>Type .help &lt;module&gt; for commands</code>\n<code>❊═════════════════════════════════❊</code>`,
        timestamp: "10:17 PM",
        type: "bot_response",
        parseMode: "HTML",
      }
    ]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN: Telegram Interactive Phone/Chat Screen (White Theme & Black Text) */}
      <div className="lg:col-span-8 bg-white border-2 border-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[740px]">
        {/* Telegram Chat Header */}
        <div className="bg-slate-900 border-b-2 border-slate-800 px-4 py-3 flex items-center justify-between text-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow ring-2 ring-white/20">
              <Bot className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-white text-base tracking-wide">
                   {toMathBold("ETHER BOT")}
                </span>
                {isRaidActive && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
                    <Flame className="w-3 h-3 text-slate-950" />
                    {toMathBold(`RAID ON @${raidTargetUsername || "TARGET"} (#${raidReplyCycleCount + 1})`)}
                  </span>
                )}
                {spamCountRemaining !== null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500 text-white">
                    <Zap className="w-3 h-3 animate-spin" /> SPAMMING ({spamCountRemaining})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                 {toMathBold("OFFICIAL TELEGRAM GROUP • ETHER CONTROL • 1:1 RECYCLED")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearChat}
              title="Reset Chat History"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Raid Status Banner */}
        {isRaidActive && (
          <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 flex items-center justify-between text-xs text-amber-950">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <b>{toMathBold("TARGET LOCKED:")}</b> @{raidTargetUsername || targetUsernameInput} — <b>{toMathBold("REPLY POOL:")}</b> {raidMessages.length} Messages ({toMathBold("1 MSG = 1 REPLIED")})
              </span>
            </div>
            <span className="text-[11px] font-black text-amber-900 bg-amber-200 px-2 py-0.5 rounded">
              Next Msg Index: #{((raidReplyCycleCount) % (raidMessages.length || 1)) + 1}
            </span>
          </div>
        )}

        {/* Telegram Chat Message History (Crisp White Canvas with Dark Text) */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f4f6f8] [background-size:16px_16px] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)]"
        >
          <div className="text-center my-2">
            <span className="px-3 py-1 rounded-full bg-white border border-slate-300 text-[11px] font-bold text-slate-700 shadow-sm">
               {toMathBold("TODAY • ETHER BOT LIVE TELEGRAM CONSOLE")}
            </span>
          </div>

          {messages.map((msg) => {
            const isMe = msg.senderRole !== "bot";
            const isReplyTarget = replyTarget?.id === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"} group relative`}
              >
                {/* Reply Indicator */}
                {msg.replyToId && (
                  <div className={`text-[10px] text-slate-500 font-bold flex items-center gap-1 mb-1 ${isMe ? "mr-2" : "ml-2"}`}>
                    <CornerDownRight className="w-3 h-3 text-blue-600" />
                    <span>In reply to message</span>
                  </div>
                )}

                <div className="flex items-end gap-2 max-w-[88%] md:max-w-[75%]">
                  {!isMe && (
                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center text-[10px] font-black shrink-0 mb-1 shadow border border-slate-700">
                      XR
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-2.5 shadow-sm relative ${
                      isMe
                        ? msg.senderRole === "owner"
                          ? "bg-slate-900 text-white rounded-br-none border border-slate-800"
                          : "bg-white border-2 border-slate-300 text-slate-900 rounded-br-none"
                        : "bg-white border-2 border-slate-900 text-slate-900 rounded-bl-none shadow-md"
                    } ${isReplyTarget ? "ring-2 ring-amber-500" : ""}`}
                  >
                    {/* Message Sender Header */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[11px] font-black ${
                        msg.senderRole === "owner" 
                          ? "text-amber-400 font-mono" 
                          : msg.senderRole === "admin" 
                          ? "text-emerald-600" 
                          : msg.senderRole === "bot" 
                          ? "text-blue-700 font-black font-mono" 
                          : "text-slate-700"
                      }`}>
                        {msg.sender}
                      </span>
                      {msg.senderRole === "owner" && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black">
                          {toMathBold("OWNER")}
                        </span>
                      )}
                      {msg.senderRole === "bot" && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 text-[9px] font-black border border-blue-300">
                          {toMathBold("ROBOT")}
                        </span>
                      )}
                    </div>

                    {/* Message Content */}
                    {msg.parseMode === "HTML" ? (
                      <div 
                        className={`text-xs font-mono leading-relaxed space-y-1 overflow-x-auto ${isMe && msg.senderRole === "owner" ? "text-slate-100" : "text-slate-900 font-bold"}`}
                        dangerouslySetInnerHTML={{ __html: msg.text }}
                      />
                    ) : (
                      <p className={`text-xs leading-relaxed break-words font-sans font-bold ${isMe && msg.senderRole === "owner" ? "text-slate-100" : "text-slate-900"}`}>
                        {msg.text}
                      </p>
                    )}

                    {/* Footer / Timestamp */}
                    <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe && msg.senderRole === "owner" ? "text-slate-400" : "text-slate-500 font-bold"}`}>
                      <span>{msg.timestamp}</span>
                      {isMe && <CheckCheck className="w-3 h-3 text-blue-400" />}
                    </div>

                    {/* Reply button on hover */}
                    {isMe && (
                      <button
                        onClick={() => setReplyTarget(msg)}
                        title="Set target for .raid"
                        className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 bg-white hover:bg-slate-100 text-amber-700 border-2 border-slate-900 rounded-full p-1 text-[10px] transition-all shadow"
                      >
                        <CornerDownRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isProcessing && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 animate-pulse bg-white p-2 rounded-xl border border-slate-200 w-fit">
              <Bot className="w-4 h-4 text-blue-600" />
               <span>{toMathBold("ETHER BOT IS PROCESSING...")}</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Reply To Banner */}
        {replyTarget && (
          <div className="bg-amber-50 border-t-2 border-amber-300 px-4 py-2 flex items-center justify-between text-xs text-slate-800">
            <div className="flex items-center gap-2 truncate">
              <CornerDownRight className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="text-amber-950 font-black">Replying to {replyTarget.sender}:</span>
              <span className="truncate text-slate-700 font-medium">"{replyTarget.text.slice(0, 40)}"</span>
            </div>
            <button
              onClick={() => setReplyTarget(null)}
              className="text-slate-800 hover:text-black font-bold px-2 py-0.5 rounded text-xs bg-amber-200"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Telegram Input Bar */}
        <div className="bg-white border-t-2 border-slate-900 p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={`Send message as @${getCurrentSenderName()}... (Type . or text)`}
              className="flex-1 bg-slate-50 border-2 border-slate-300 focus:border-slate-900 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputVal.trim() || isProcessing}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 flex items-center justify-center transition-all shadow-md shrink-0"
            >
              <Send className="w-4 h-4 text-amber-400" />
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Controls & @RAGHU_7X Testing Sandbox */}
      <div className="lg:col-span-4 space-y-4">
        {/* Role Switcher */}
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              {toMathBold("TEST SENDER ROLE")}
            </h3>
            <span className="text-[11px] font-black text-slate-500">{toMathBold("AUTHORITY")}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                setCurrentUserRole("owner");
                setCustomSenderName("");
              }}
              className={`p-2.5 rounded-xl border-2 flex flex-col items-center text-center transition-all ${
                currentUserRole === "owner"
                  ? "bg-slate-900 border-slate-900 text-white font-black shadow-md"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-400"
              }`}
            >
              <Crown className="w-4 h-4 mb-1 text-amber-400" />
              <span className="text-xs">{toMathBold("OWNER")}</span>
               <span className="text-[9px] opacity-80">Secure owner</span>
            </button>

            <button
              onClick={() => {
                setCurrentUserRole("admin");
                setCustomSenderName("");
              }}
              className={`p-2.5 rounded-xl border-2 flex flex-col items-center text-center transition-all ${
                currentUserRole === "admin"
                  ? "bg-emerald-700 border-emerald-900 text-white font-black shadow-md"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-400"
              }`}
            >
              <Shield className="w-4 h-4 mb-1 text-emerald-300" />
              <span className="text-xs">{toMathBold("ADMIN")}</span>
              <span className="text-[9px] opacity-80">Group Admin</span>
            </button>

            <button
              onClick={() => {
                setCurrentUserRole("member");
                setCustomSenderName(targetUsernameInput || "RAGHU_7X");
              }}
              className={`p-2.5 rounded-xl border-2 flex flex-col items-center text-center transition-all ${
                currentUserRole === "member"
                  ? "bg-amber-500 border-amber-700 text-slate-950 font-black shadow-md"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-400"
              }`}
            >
              <User className="w-4 h-4 mb-1 text-slate-950" />
              <span className="text-xs">{toMathBold("TARGET")}</span>
              <span className="text-[9px] opacity-90">@{targetUsernameInput || "RAGHU_7X"}</span>
            </button>
          </div>
        </div>

        {/* 1:1 Sequential Raid Reply Tester with @RAGHU_7X */}
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-600" />
              {toMathBold("1:1 RAID REPLY TESTING")}
            </h3>
            {onOpenRaidModal && (
              <button
                onClick={onOpenRaidModal}
                className="text-[11px] font-black text-amber-700 hover:text-amber-900 underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>{toMathBold("EDIT MSGS")}</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            {/* Target input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-2 text-xs font-black text-slate-500">@</span>
                <input
                  type="text"
                  value={targetUsernameInput}
                  onChange={(e) => setTargetUsernameInput(e.target.value.replace(/^@/, ""))}
                  placeholder="RAGHU_7X"
                  className="w-full bg-slate-50 border-2 border-slate-300 focus:border-slate-900 rounded-xl pl-6 pr-3 py-1.5 text-xs font-black text-slate-900 focus:outline-none"
                />
              </div>
              <button
                onClick={() => handleSendMessage(`.raid @${targetUsernameInput || "RAGHU_7X"}`, null, "XYRO_7X", "owner")}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shrink-0 transition-colors"
              >
                {toMathBold(`.RAID @${targetUsernameInput || "RAGHU_7X"}`)}
              </button>
            </div>

            {/* Dynamic Interactive Test Steps for all saved raid messages */}
            {raidMessages.slice(0, 5).map((msg, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(String(idx + 1), null, targetUsernameInput || "RAGHU_7X", "member")}
                className="w-full px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 border-2 border-amber-400 text-amber-950 text-xs font-black flex items-center justify-between transition-all shadow-sm group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="truncate">@{targetUsernameInput || "RAGHU_7X"} sends "{idx + 1}"</span>
                </div>
                <span className="text-[11px] bg-white px-2 py-0.5 rounded border border-amber-300 font-mono truncate max-w-[140px]">
                  ➔ "{msg}"
                </span>
              </button>
            ))}

            {raidMessages.length > 5 && (
              <button
                onClick={() => handleSendMessage(String(raidMessages.length), null, targetUsernameInput || "RAGHU_7X", "member")}
                className="w-full px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-[11px] font-black text-center"
              >
                + Test Remaining ({raidMessages.length - 5} More Messages)
              </button>
            )}

            {/* Stop Raid */}
            <button
              onClick={() => handleSendMessage(".draid", null, "XYRO_7X", "owner")}
              className="w-full px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 border-2 border-rose-300 text-rose-950 text-xs font-black text-center transition-all"
            >
              <span>{toMathBold(".DRAID (STOP RAID)")}</span>
            </button>
          </div>
        </div>

        {/* Quick Commands Launchpad */}
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              {toMathBold("QUICK COMMANDS")}
            </h3>
            <span className="text-[11px] font-black text-slate-500">{toMathBold("1-CLICK")}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSendMessage(".help", null, "XYRO_7X", "owner")}
              className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border-2 border-slate-300 text-slate-900 text-xs font-black flex items-center justify-between transition-all"
            >
              <span>.help</span>
              <span className="text-[10px] text-blue-600">Menu</span>
            </button>

            <button
              onClick={() => handleSendMessage(".ping", null, "XYRO_7X", "owner")}
              className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border-2 border-slate-300 text-slate-900 text-xs font-black flex items-center justify-between transition-all"
            >
              <span>.ping</span>
              <span className="text-[10px] text-emerald-600">Ping</span>
            </button>

            <button
              onClick={() => handleSendMessage(".spam 5 XYRO_POWER", null, "XYRO_7X", "owner")}
              className="px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 border-2 border-purple-300 text-purple-950 text-xs font-black flex items-center justify-between transition-all"
            >
              <span>.spam 5</span>
              <Zap className="w-3.5 h-3.5 text-purple-600" />
            </button>

            <button
              onClick={handleStopSpamManual}
              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border-2 border-rose-300 text-rose-950 text-xs font-black flex items-center justify-between transition-all"
            >
              <span>.stopspam</span>
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
