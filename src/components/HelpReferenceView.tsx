import React, { useState } from "react";
import { Copy, Check, Layers, PlusCircle, Trash2, Terminal, Shield, Zap, Sparkles, BookOpen } from "lucide-react";
import { ModuleDoc } from "../types";
import { toMathBold } from "../utils/mathBold";

interface Props {
  modules: ModuleDoc[];
}

export const HelpReferenceView: React.FC<Props> = () => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"help" | "ping" | "raid" | "draid" | "spam" | "stopspam">("help");

  const baseModules = [
    {
      name: "group",
      description: "Group chat moderation, pin/unpin, deep purge & lockall tools",
      icon: "🛡️",
      commands: [
        { name: "lockall", syntax: ".lockall", description: "Strict Lockdown: Instantly auto-deletes EVERY message (even admins)", permission: "owner" },
        { name: "unlockall", syntax: ".unlockall", description: "Disable lockdown & restore messaging", permission: "owner" },
        { name: "delall", syntax: ".delall [@user]", description: "Deep sweep 1,000-20,000+ past messages of user", permission: "owner" },
        { name: "purge", syntax: ".purge [count/all]", description: "Bulk wipe 1,000-20,000+ GC messages", permission: "owner" },
        { name: "del", syntax: ".del", description: "Delete replied message instantly", permission: "owner" },
        { name: "pin", syntax: ".pin [silent]", description: "Pin replied message in group chat", permission: "owner" },
        { name: "unpin", syntax: ".unpin [all]", description: "Unpin replied message or all pins in group", permission: "owner" }
      ]
    },
    {
      name: "raid",
      description: "Custom 1:1 recycled automatic reply system",
      icon: "⚡",
      commands: [
        { name: "raid", syntax: ".raid @username", description: "Enable custom reply mode on target user", permission: "owner" },
        { name: "draid", syntax: ".draid", description: "Disable active raid reply mode", permission: "owner" }
      ]
    },
    {
      name: "spam",
      description: "Controlled repeated messaging system",
      icon: "⚡",
      commands: [
        { name: "spam", syntax: ".spam <count> <text>", description: "Start controlled repeated messaging", permission: "owner" },
        { name: "stopspam", syntax: ".stopspam", description: "Stop active spam task immediately", permission: "owner" }
      ]
    },
    {
      name: "animation",
      description: "Live Telegram message edit animations & visual FX",
      icon: "🎭",
      commands: [
        { name: "love", syntax: ".love / .heart", description: "Romantic evolving glowing hearts & sparkles animation", permission: "everyone" },
        { name: "hack", syntax: ".hack [@user]", description: "Cinematic FBI/Matrix server breach terminal simulation", permission: "everyone" },
        { name: "magic", syntax: ".magic", description: "Mystical transforming crystal magic wand & spell effect", permission: "everyone" },
        { name: "destroy", syntax: ".destroy [@user]", description: "Dramatic nuclear reactor countdown & tactical detonation", permission: "everyone" },
        { name: "loading", syntax: ".loading [text]", description: "Smooth 0% to 100% animated cyber progress meter", permission: "everyone" },
        { name: "matrix", syntax: ".matrix", description: "Green digital cyber rain & terminal decryptor animation", permission: "everyone" },
        { name: "type", syntax: ".type <text>", description: "Live typewriter typing effect letter-by-letter", permission: "everyone" },
        { name: "rain", syntax: ".rain", description: "Dynamic weather storm to sunshine rainbow transformation", permission: "everyone" },
        { name: "bomb", syntax: ".bomb", description: "Ticking explosive dynamite fuse countdown with blast", permission: "everyone" },
        { name: "dance", syntax: ".dance", description: "Party DJ visual groove with neon dancing emojis", permission: "everyone" }
      ]
    },
    {
      name: "fun",
      description: "Interactive games, intelligence & entertainment",
      icon: "🎲",
      commands: [
        { name: "dice", syntax: ".dice / .roll", description: "Send official animated Telegram 3D roll dice", permission: "everyone" },
        { name: "dart", syntax: ".dart", description: "Send animated bullseye target dart board", permission: "everyone" },
        { name: "basket", syntax: ".basket / .bb", description: "Shoot animated basketball hoop with physics", permission: "everyone" },
        { name: "football", syntax: ".football / .goal", description: "Kick animated soccer football goal into net", permission: "everyone" },
        { name: "slot", syntax: ".slot / .casino", description: "Spin Vegas jackpot slot machine 777 roller", permission: "everyone" },
        { name: "shayari", syntax: ".shayari", description: "Get beautiful Urdu/Hindi attitude & poetic shayari", permission: "everyone" },
        { name: "roast", syntax: ".roast [@user]", description: "Funny witty savage roast on target member", permission: "everyone" },
        { name: "ship", syntax: ".ship [@u1] [@u2]", description: "Calculate love compatibility percentage & destiny", permission: "everyone" },
        { name: "truth", syntax: ".truth", description: "Get juicy provocative Truth questions for chat games", permission: "everyone" },
        { name: "dare", syntax: ".dare", description: "Get extreme funny Dares for group party games", permission: "everyone" },
        { name: "flip", syntax: ".flip / .coin", description: "Flip a metallic gold coin for Heads or Tails", permission: "everyone" },
        { name: "joke", syntax: ".joke", description: "Get funny Hindi/English jokes and punchlines", permission: "everyone" }
      ]
    },
    {
      name: "system",
      description: "Basic system status and latency commands",
      icon: "⚙",
      commands: [
        { name: "ping", syntax: ".ping", description: "Check bot response and server latency", permission: "everyone" },
        { name: "status", syntax: ".status", description: "View 24/7 uptime, RAM & bot statistics", permission: "everyone" },
        { name: "addsudo", syntax: ".addsudo [@user]", description: "Grant full sudo bot access (Primary Owner only)", permission: "owner" },
        { name: "delsudo", syntax: ".delsudo [@user/all]", description: "Revoke sudo bot access (Primary Owner only)", permission: "owner" },
        { name: "sudolist", syntax: ".sudolist", description: "View active authorized sudo admins", permission: "owner" }
      ]
    }
  ];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900 tracking-wide flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              {toMathBold("HELP COMMAND REGISTRY & PREVIEW")}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-xs font-black text-slate-800">
              {baseModules.length} {toMathBold("MODULES")} • {baseModules.reduce((acc, m) => acc + m.commands.length, 0)} {toMathBold("COMMANDS")}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            Complete visual representation of <code>.help</code> and sub-module documentation.
          </p>
        </div>
      </div>

      {/* Modules List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {baseModules.map((mod) => (
          <div
            key={mod.name}
            className="bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-slate-900 uppercase font-mono tracking-wider">
                  {toMathBold(`MODULE: ${mod.name}`)}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-900 font-bold border border-slate-300">
                  {mod.commands.length} {toMathBold("CMDS")}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mb-3">{mod.description}</p>

              <div className="space-y-2">
                {mod.commands.map((cmd) => (
                  <div
                    key={cmd.name}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-bold text-slate-900 font-mono">
                        {cmd.syntax}
                      </code>
                      <button
                        onClick={() => handleCopy(cmd.syntax, cmd.name)}
                        className="text-slate-400 hover:text-slate-900 p-1"
                      >
                        {copiedCmd === cmd.name ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-600">{cmd.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
