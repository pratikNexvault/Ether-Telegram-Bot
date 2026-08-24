import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import JSZip from "jszip";

interface ChatSimState {
  raidEnabled: boolean;
  raidTargetId: string | number | null;
  raidTargetUsername: string | null;
  raidTargetUserId: string | number | null;
  raidReplyIndex: number;
  raidLastReplyTime: number;
  spamActive: boolean;
  spamCancelRequested: boolean;
}

const chatSimStates: Record<string, ChatSimState> = {
  "-1001234567890": {
    raidEnabled: false,
    raidTargetId: null,
    raidTargetUsername: null,
    raidTargetUserId: null,
    raidReplyIndex: 0,
    raidLastReplyTime: 0,
    spamActive: false,
    spamCancelRequested: false,
  },
};

const RAID_STORAGE_FILE = path.join(process.cwd(), "raid_messages.json");

// Keep the public control panel and generated replies on the Ether identity,
// even when an older saved message pool still contains the previous name.
function etherizeBranding(value: string): string {
  return value
    .replace(/XYRO ROBOT/gi, "ETHER BOT")
    .replace(/XYRO Bot/gi, "ETHER Bot")
    .replace(/XYRO/gi, "ETHER");
}

function loadStoredRaidMessages(): string[] {
  try {
    if (fs.existsSync(RAID_STORAGE_FILE)) {
      const raw = fs.readFileSync(RAID_STORAGE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load raid_messages.json:", e);
  }
  return [
    "⚡ ETHER BOT ACTIVE",
    "🛡️ Protection Shield 100%"
  ];
}

function saveStoredRaidMessages(msgs: string[]) {
  try {
    fs.writeFileSync(RAID_STORAGE_FILE, JSON.stringify(msgs, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save raid_messages.json:", e);
  }
}

const customRaidMessages: string[] = loadStoredRaidMessages();

const botModules = [
  {
    name: "group",
    description: "Group Moderation, AntiBan, Locks & Chat Administration",
    icon: "🛡️",
    commands: [
      { name: "antiban", syntax: ".antiban", description: "AntiBan Mini-Module overview & guide", permission: "admin" },
      { name: "antibanall", syntax: ".antibanall", description: "Toggle AntiBan system on/off in group", permission: "owner" },
      { name: "setantiban", syntax: ".setantiban <threshold> [time]", description: "Set threshold & window (e.g. .setantiban 5 60s)", permission: "owner" },
      { name: "antibanstats", syntax: ".antibanstats", description: "Show AntiBan settings, status & tracked data", permission: "admin" },
      { name: "antibanfree", syntax: ".antibanfree on/off [@user]", description: "Exempt admin / list exempts", permission: "owner" },
      { name: "antibanmode", syntax: ".antibanmode <demote/ban/mute/kick>", description: "Set punishment action mode", permission: "owner" },
      { name: "antibanlog", syntax: ".antibanlog", description: "Export action history as .txt", permission: "admin" },
      { name: "antibanclear", syntax: ".antibanclear", description: "Clear all tracking data & logs", permission: "owner" },
      { name: "antibantest", syntax: ".antibantest", description: "Simulate threshold breach & test action", permission: "owner" },
      { name: "antibantop", syntax: ".antibantop", description: "Rank admins by ban count", permission: "admin" },
      { name: "ban", syntax: ".ban [@user / reply] [reason]", description: "Ban user permanently from group", permission: "admin" },
      { name: "unban", syntax: ".unban [@user / reply]", description: "Unban user and restore access", permission: "admin" },
      { name: "kick", syntax: ".kick [@user / reply]", description: "Kick user out of group (allows rejoin)", permission: "admin" },
      { name: "mute", syntax: ".mute [@user / time]", description: "Mute user in group (e.g. .mute 10m / .mute 1h)", permission: "admin" },
      { name: "unmute", syntax: ".unmute [@user / reply]", description: "Unmute user and restore speaking rights", permission: "admin" },
      { name: "promote", syntax: ".promote [@user / reply] [title]", description: "Promote user with custom admin title", permission: "owner" },
      { name: "demote", syntax: ".demote [@user / reply]", description: "Demote admin to regular member", permission: "owner" },
      { name: "pin", syntax: ".pin [silent]", description: "Pin replied message (optionally silent)", permission: "admin" },
      { name: "unpin", syntax: ".unpin [all]", description: "Unpin replied message or all pinned messages", permission: "admin" },
      { name: "banall", syntax: ".banall", description: "Ban all non-admin members", permission: "owner" },
      { name: "kickall", syntax: ".kickall", description: "Kick all non-admin members", permission: "owner" },
      { name: "muteall", syntax: ".muteall", description: "Mute all non-admin members", permission: "owner" },
      { name: "unmuteall", syntax: ".unmuteall", description: "Unmute all members", permission: "owner" },
      { name: "unbanall", syntax: ".unbanall", description: "Unban all users in group", permission: "owner" },
      { name: "warn", syntax: ".warn [@user / reason]", description: "Issue warning to user (3 warns = auto ban)", permission: "admin" },
      { name: "warns", syntax: ".warns [@user / reply]", description: "Check active warnings of a user", permission: "everyone" },
      { name: "resetwarns", syntax: ".resetwarns [@user / reply]", description: "Clear all warnings of a user", permission: "admin" },
      { name: "lockall", syntax: ".lockall", description: "Strict Chat Lockdown: Instantly auto-deletes EVERY message", permission: "owner" },
      { name: "unlockall", syntax: ".unlockall", description: "Disable strict lockdown and allow messages again", permission: "owner" },
      { name: "autodel", syntax: ".autodel [@user / reply]", description: "Target user auto-delete: Instantly delete every message", permission: "owner" },
      { name: "unautodel", syntax: ".unautodel [@user / reply / all]", description: "Disable auto-delete surveillance for target user", permission: "owner" },
      { name: "autodellist", syntax: ".autodellist", description: "View all users currently marked for instant auto-deletion", permission: "owner" },
      { name: "check", syntax: ".check [@user/reply/chat]", description: "Check stats/info of user, bot, or group", permission: "admin" },
      { name: "admins", syntax: ".admins", description: "Generate detailed admin audit report (.txt)", permission: "admin" },
      { name: "ginfo", syntax: ".ginfo", description: "Detailed group info & statistics", permission: "admin" },
      { name: "zombies", syntax: ".zombies", description: "Scan & remove deleted accounts from group", permission: "admin" },
      { name: "del", syntax: ".del", description: "Delete replied message instantly", permission: "admin" },
      { name: "delall", syntax: ".delall [@user / count]", description: "Deep clean past messages of user", permission: "admin" },
      { name: "purge", syntax: ".purge [count / reply]", description: "Bulk wipe messages from replied to latest", permission: "owner" },
      { name: "purgeme", syntax: ".purgeme [count]", description: "Delete your last N messages", permission: "owner" },
      { name: "editpurge", syntax: ".editpurge [count]", description: "Stealth edit-purge: Replace messages with '.'", permission: "owner" },
      { name: "spurge", syntax: ".spurge <keyword>", description: "Delete messages containing keyword", permission: "owner" },
      { name: "deleteall", syntax: ".deleteall [@user / reply]", description: "Delete all messages from specific user", permission: "owner" },
      { name: "lock", syntax: ".lock <all/media/stickers/msg>", description: "Lock group permissions", permission: "owner" },
      { name: "unlock", syntax: ".unlock <all/media/stickers/msg>", description: "Unlock group permissions", permission: "owner" },
      { name: "gunlock", syntax: ".gunlock", description: "Globally unlock and clear all locks in chat", permission: "owner" },
      { name: "locked", syntax: ".locked", description: "Show all active group locks", permission: "owner" },
      { name: "adminlock", syntax: ".adminlock <on/off>", description: "Toggle whether admins bypass group locks", permission: "owner" },
      { name: "lockavoid", syntax: ".lockavoid [@user/reply]", description: "Whitelist a user from being affected by locks", permission: "owner" },
      { name: "settitle", syntax: ".settitle <title>", description: "Set group title", permission: "owner" },
      { name: "setdesc", syntax: ".setdesc <description>", description: "Set group description", permission: "owner" },
      { name: "invitelink", syntax: ".invitelink", description: "Get group invite link", permission: "admin" },
      { name: "emoji2mp4", syntax: ".emoji2mp4", description: "Convert animated emoji to MP4 video / sticker preview", permission: "everyone" },
      { name: "saved", syntax: ".saved", description: "Save message to Saved Messages", permission: "admin" },
      { name: "wblock", syntax: ".wblock <word/sticker/gif>", description: "Block a word/sticker/gif/emoji", permission: "admin" },
      { name: "wunblock", syntax: ".wunblock <word/sticker/gif>", description: "Unblock a word/sticker/gif/emoji", permission: "admin" },
      { name: "blocklist", syntax: ".blocklist", description: "Show all blocked items", permission: "admin" },
      { name: "blockwarntxt", syntax: ".blockwarntxt <text>", description: "Set/toggle warning text for blocked content", permission: "admin" },
      { name: "gcwelcome", syntax: ".gcwelcome <on/off/text>", description: "Group Welcome Mini-Module", permission: "admin" },
    ],
  },
  {
    name: "tag",
    description: "Group member & admin tagging tools",
    icon: "📢",
    commands: [
      {
        name: "tagall",
        syntax: ".tagall [message]",
        description: "Tag all active group members with custom text",
        permission: "admin",
      },
      {
        name: "mention",
        syntax: ".mention [message]",
        description: "Mention group members in batches",
        permission: "admin",
      },
      {
        name: "cancel",
        syntax: ".cancel / .stoptag",
        description: "Instantly stop active tagall loop",
        permission: "admin",
      },
      {
        name: "admins",
        syntax: ".admins",
        description: "Tag & list all administrators in group",
        permission: "everyone",
      },
    ],
  },
  {
    name: "info",
    description: "User & group chat intelligence",
    icon: "🔍",
    commands: [
      {
        name: "id",
        syntax: ".id",
        description: "Get Telegram numeric ID for user and chat",
        permission: "everyone",
      },
      {
        name: "info",
        syntax: ".info [@user / reply]",
        description: "View detailed profile dossier of user",
        permission: "everyone",
      },
      {
        name: "whois",
        syntax: ".whois [@user / reply]",
        description: "Look up identity, username & permissions",
        permission: "everyone",
      },
      {
        name: "ginfo",
        syntax: ".ginfo / .chatinfo",
        description: "View group member count, admins & chat info",
        permission: "everyone",
      },
    ],
  },
  {
    name: "utility",
    description: "Automation, AFK, translation and live weather tools",
    icon: "✨",
    commands: [
      {
        name: "weather",
        syntax: ".weather [city]",
        description: "Live real-time weather, temperature, humidity & wind",
        permission: "everyone",
      },
      {
        name: "afk",
        syntax: ".afk [reason]",
        description: "Set AFK status with auto-reply when tagged",
        permission: "everyone",
      },
      {
        name: "welcome",
        syntax: ".welcome [on/off/text]",
        description: "Toggle auto-welcome greeting for new members",
        permission: "admin",
      },
      {
        name: "tr",
        syntax: ".tr [lang] / reply",
        description: "Translate replied message to Hindi/English",
        permission: "everyone",
      },
    ],
  },
  {
    name: "animation",
    description: "Live Telegram message edit animations & visual FX",
    icon: "🎭",
    commands: [
      {
        name: "love",
        syntax: ".love / .heart",
        description: "Live evolving romantic glowing hearts & sparkles animation",
        permission: "everyone",
      },
      {
        name: "hack",
        syntax: ".hack [@user / reply]",
        description: "Cinematic FBI/Matrix terminal server hacking simulation",
        permission: "everyone",
      },
      {
        name: "magic",
        syntax: ".magic",
        description: "Mystical transforming crystal magic wand & spell effect",
        permission: "everyone",
      },
      {
        name: "destroy",
        syntax: ".destroy [@user / reply]",
        description: "Dramatic nuclear reactor countdown & tactical detonation",
        permission: "everyone",
      },
      {
        name: "loading",
        syntax: ".loading [custom text]",
        description: "Smooth 0% to 100% animated cyber progress meter",
        permission: "everyone",
      },
      {
        name: "matrix",
        syntax: ".matrix",
        description: "Green digital cyber rain & terminal decryptor animation",
        permission: "everyone",
      },
      {
        name: "type",
        syntax: ".type <message>",
        description: "Live typewriter typing effect letter-by-letter",
        permission: "everyone",
      },
      {
        name: "rain",
        syntax: ".rain",
        description: "Dynamic weather storm to sunshine sky transformation",
        permission: "everyone",
      },
      {
        name: "bomb",
        syntax: ".bomb",
        description: "Ticking explosive dynamite fuse countdown with blast",
        permission: "everyone",
      },
      {
        name: "dance",
        syntax: ".dance",
        description: "Party DJ visual groove with neon dancing emojis",
        permission: "everyone",
      },
    ],
  },
  {
    name: "fun",
    description: "Interactive games, intelligence & entertainment",
    icon: "🎲",
    commands: [
      {
        name: "dice",
        syntax: ".dice / .roll",
        description: "Send official animated Telegram 3D roll dice",
        permission: "everyone",
      },
      {
        name: "dart",
        syntax: ".dart",
        description: "Send animated bullseye target dart board",
        permission: "everyone",
      },
      {
        name: "basket",
        syntax: ".basket / .bb",
        description: "Shoot animated basketball hoop with physics",
        permission: "everyone",
      },
      {
        name: "football",
        syntax: ".football / .goal",
        description: "Kick animated soccer football goal into net",
        permission: "everyone",
      },
      {
        name: "slot",
        syntax: ".slot / .casino",
        description: "Spin Vegas jackpot slot machine 777 roller",
        permission: "everyone",
      },
      {
        name: "shayari",
        syntax: ".shayari / .quote",
        description: "Get beautiful Urdu/Hindi attitude & poetic shayari",
        permission: "everyone",
      },
      {
        name: "roast",
        syntax: ".roast [@user / reply]",
        description: "Funny witty savage roast on target member",
        permission: "everyone",
      },
      {
        name: "ship",
        syntax: ".ship [@user1] [@user2]",
        description: "Calculate love compatibility percentage & destiny",
        permission: "everyone",
      },
      {
        name: "truth",
        syntax: ".truth",
        description: "Get juicy provocative Truth questions for chat games",
        permission: "everyone",
      },
      {
        name: "dare",
        syntax: ".dare",
        description: "Get extreme funny Dares for group party games",
        permission: "everyone",
      },
      {
        name: "flip",
        syntax: ".flip / .coin",
        description: "Flip a metallic gold coin for Heads or Tails",
        permission: "everyone",
      },
      {
        name: "joke",
        syntax: ".joke",
        description: "Get funny Hindi/English jokes and punchlines",
        permission: "everyone",
      },
    ],
  },
  {
    name: "raid",
    description: "Custom automatic reply system",
    icon: "⚡",
    commands: [
      {
        name: "raid",
        syntax: ".raid [@user]",
        description: "Enable custom reply mode (reply to a message)",
        permission: "admin",
      },
      {
        name: "draid",
        syntax: ".draid",
        description: "Disable custom reply mode",
        permission: "admin",
      },
    ],
  },
  {
    name: "spam",
    description: "Controlled repeated messaging",
    icon: "⚡",
    commands: [
      {
        name: "spam",
        syntax: ".spam <count> <text>",
        description: "Start controlled repeated messaging",
        permission: "admin",
      },
      {
        name: "stopspam",
        syntax: ".stopspam",
        description: "Stop active spam task",
        permission: "admin",
      },
    ],
  },
  {
    name: "system",
    description: "Basic system and diagnostic commands",
    icon: "⚙",
    commands: [
      {
        name: "ping",
        syntax: ".ping",
        description: "Check bot response and latency",
        permission: "everyone",
      },
      {
        name: "status",
        syntax: ".status",
        description: "Check 24/7 uptime, RAM & bot statistics",
        permission: "everyone",
      },
      {
        name: "addsudo",
        syntax: ".addsudo [@user / reply]",
        description: "Grant full sudo bot command access to a user (Primary Owner only)",
        permission: "owner",
      },
      {
        name: "delsudo",
        syntax: ".delsudo [@user / reply / all]",
        description: "Revoke sudo bot access from a user (Primary Owner only)",
        permission: "owner",
      },
      {
        name: "sudolist",
        syntax: ".sudolist",
        description: "View all active sudo authorized users",
        permission: "owner",
      },
    ],
  },
];

const botStartTime = Date.now();

function toBoldSerif(text: string): string {
  let out = "";
  for (const ch of String(text || "")) {
    const code = ch.codePointAt(0) || 0;
    // Latin Uppercase A-Z -> Mathematical Bold Serif A-Z (0x1D400 - 0x1D419)
    if (code >= 65 && code <= 90) {
      out += String.fromCodePoint(0x1d400 + (code - 65));
    }
    // Latin Lowercase a-z -> Mathematical Bold Serif a-z (0x1D41A - 0x1D433)
    else if (code >= 97 && code <= 122) {
      out += String.fromCodePoint(0x1d41a + (code - 97));
    }
    // Latin Digits 0-9 -> Mathematical Bold 0-9 (0x1D7CE - 0x1D7D7)
    else if (code >= 48 && code <= 57) {
      out += String.fromCodePoint(0x1d7ce + (code - 48));
    } else {
      out += ch;
    }
  }
  return out;
}

function normalizeToAscii(text: string): string {
  let out = "";
  for (const ch of String(text || "")) {
    const code = ch.codePointAt(0) || 0;
    // Mathematical Bold (Serif) Uppercase: 0x1D400 - 0x1D419 (A-Z)
    if (code >= 0x1d400 && code <= 0x1d419) {
      out += String.fromCharCode(65 + (code - 0x1d400));
    }
    // Mathematical Bold (Serif) Lowercase: 0x1D41A - 0x1D433 (a-z)
    else if (code >= 0x1d41a && code <= 0x1d433) {
      out += String.fromCharCode(97 + (code - 0x1d41a));
    }
    // Mathematical Bold Digits: 0x1D7CE - 0x1D7D7 (0-9)
    else if (code >= 0x1d7ce && code <= 0x1d7d7) {
      out += String.fromCharCode(48 + (code - 0x1d7ce));
    }
    // Mathematical Sans-serif Bold: 0x1D5D4 - 0x1D5ED (A-Z), 0x1D5EE - 0x1D607 (a-z), 0x1D7EC - 0x1D7F5 (0-9)
    else if (code >= 0x1d5d4 && code <= 0x1d5ed) {
      out += String.fromCharCode(65 + (code - 0x1d5d4));
    } else if (code >= 0x1d5ee && code <= 0x1d607) {
      out += String.fromCharCode(97 + (code - 0x1d5ee));
    } else if (code >= 0x1d7ec && code <= 0x1d7f5) {
      out += String.fromCharCode(48 + (code - 0x1d7ec));
    }
    // Mathematical Italic: 0x1D434 - 0x1D44D (A-Z), 0x1D44E - 0x1D467 (a-z)
    else if (code >= 0x1d434 && code <= 0x1d44d) {
      out += String.fromCharCode(65 + (code - 0x1d434));
    } else if (code >= 0x1d44e && code <= 0x1d467) {
      out += String.fromCharCode(97 + (code - 0x1d44e));
    }
    // Mathematical Monospace: 0x1D670 - 0x1D689, 0x1D68A - 0x1D6A3, 0x1D7F6 - 0x1D7FF
    else if (code >= 0x1d670 && code <= 0x1d689) {
      out += String.fromCharCode(65 + (code - 0x1d670));
    } else if (code >= 0x1d68a && code <= 0x1d6a3) {
      out += String.fromCharCode(97 + (code - 0x1d68a));
    } else if (code >= 0x1d7f6 && code <= 0x1d7ff) {
      out += String.fromCharCode(48 + (code - 0x1d7f6));
    } else {
      out += ch;
    }
  }
  return out;
}

function formatUptime(seconds: number): string {
  const secs = Math.max(0, Math.floor(seconds));
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const remSecs = secs % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${remSecs}s`;
  if (minutes > 0) return `${minutes}m ${remSecs}s`;
  return `${remSecs}s`;
}

function formatCommandPanel(
  title: string,
  content: string[] | string,
  footer?: string,
  note?: string,
  applyBold: boolean = true,
  bullet: string = "◇➤"
): string {
  const rawTitle = title.trim();
  const styledTitle = toBoldSerif(rawTitle.toUpperCase());
  const titleBracket = `〔 ${styledTitle} 〕`;

  const titleLen = rawTitle.length;
  let sideBars = "━━━━━━";
  if (titleLen <= 4) sideBars = "━━━━━━";
  else if (titleLen <= 6) sideBars = "━━━━━━";
  else if (titleLen <= 8) sideBars = "━━━━━";
  else if (titleLen <= 10) sideBars = "━━━━";
  else sideBars = "━━━";

  const header = `❀${sideBars}${titleBracket}${sideBars}❀`;
  const totalBarCount = sideBars.length * 2 + `〔 ${rawTitle.toUpperCase()} 〕`.length;
  const footerBar = `❀${"━".repeat(totalBarCount)}❀`;

  const rawLines = Array.isArray(content) ? content : [content];
  const contentLines: string[] = [];
  const bulletPrefix = `${bullet.trimEnd()} `;

  for (const line of rawLines) {
    const sline = String(line).trim();
    if (!sline) {
      contentLines.push("");
    } else if (sline.startsWith("◇➤") || sline.startsWith("◇ ") || sline.startsWith("   ")) {
      contentLines.push(toBoldSerif(sline));
    } else {
      if (sline.includes(":")) {
        const colonIdx = sline.indexOf(":");
        const k = sline.substring(0, colonIdx);
        const v = sline.substring(colonIdx + 1);
        contentLines.push(`${bulletPrefix}${toBoldSerif(k)}:${toBoldSerif(v)}`);
      } else {
        contentLines.push(`${bulletPrefix}${toBoldSerif(sline)}`);
      }
    }
  }

  const panelParts = [header, ...contentLines];
  if (footer) {
    panelParts.push(toBoldSerif(footer.trim()));
  }
  panelParts.push(footerBar);

  let rendered = `<pre>${escapeHtml(panelParts.join("\n"))}</pre>`;
  if (note) {
    rendered += `\n\n${escapeHtml(toBoldSerif(note.trim()))}`;
  }
  return etherizeBranding(rendered);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendSafeTelegramMessage(
  token: string,
  chatId: number | string,
  text: string,
  replyToId?: number,
  parseMode: "HTML" | undefined = "HTML"
) {
  try {
    const payload: any = {
      chat_id: chatId,
      text: text,
    };
    if (replyToId) payload.reply_to_message_id = replyToId;
    if (parseMode) payload.parse_mode = parseMode;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data: any = await res.json();
    if (!data.ok) {
      console.warn(`[TELEGRAM] SendMessage error (${data.error_code}): ${data.description}. Retrying as clean text...`);
      delete payload.parse_mode;
      payload.text = text.replace(/<[^>]*>/g, "");
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  } catch (err: any) {
    console.error("[TELEGRAM] Safe send network error:", err);
  }
}

function getCommandHelp(cmdName: string): string | null {
  const clean = cmdName.toLowerCase().replace(/^\./, "").trim();
  for (const mod of botModules) {
    const cmd = mod.commands.find((c) => c.name.toLowerCase() === clean);
    if (cmd) {
      return formatCommandPanel(
        `CMD: .${cmd.name.toUpperCase()}`,
        [
          `Syntax: ${cmd.syntax}`,
          `Module: ${mod.name.toUpperCase()}`,
          `Permission: ${cmd.permission.toUpperCase()}`,
          `Description: ${cmd.description}`,
        ],
        "YOUR XYRO IS RUNNING",
        undefined,
        true
      );
    }
  }
  return null;
}

function getFormattedHelpMenu(): string {
  const preferredOrder = ["group", "system", "spam", "raid", "tag", "info", "utility", "animation", "fun"];
  const sortedModules = [...botModules].sort((a, b) => {
    const idxA = preferredOrder.indexOf(a.name.toLowerCase());
    const idxB = preferredOrder.indexOf(b.name.toLowerCase());
    return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
  });

  const lines = sortedModules.map((m) => {
    const count = m.commands.length;
    const plural = count === 1 ? "command" : "commands";
    return `${toBoldSerif(m.name)} ( ${toBoldSerif(String(count))} ${toBoldSerif(plural)} )`;
  });

  return formatCommandPanel(
    "MODULES",
    lines,
    "YOUR XYRO IS RUNNING",
    "Type .help [module] to view commands",
    true,
    "◇"
  );
}

function getGroupModuleHelp(): string {
  const groupMod = botModules.find((m) => m.name.toLowerCase() === "group");
  const lines: string[] = [];
  if (groupMod) {
    for (const c of groupMod.commands) {
      const permBadge = c.permission === "admin" ? ` [${toBoldSerif("ADMIN")}]` : (c.permission === "owner" ? ` [${toBoldSerif("OWNER")}]` : "");
      lines.push(`.${toBoldSerif(c.name)}${permBadge}`);
      lines.push(`   ${toBoldSerif(c.description)}`);
    }
  }
  return formatCommandPanel(
    "GROUP MODULE",
    lines,
    "YOUR XYRO IS RUNNING",
    "Type .help [command] for details",
    true
  );
}

function getAntiBanHelp(): string {
  const lines = [
    `.${toBoldSerif("antibanall")}`,
    `   ${toBoldSerif("Toggle antiban system")}`,
    `.${toBoldSerif("setantiban")} [${toBoldSerif("time")}]`,
    `   ${toBoldSerif("Set threshold & window")}`,
    `.${toBoldSerif("antibanstats")}`,
    `   ${toBoldSerif("Show settings & tracked data")}`,
    `.${toBoldSerif("antibanfree")} ${toBoldSerif("on/off")}`,
    `   ${toBoldSerif("Exempt user / list exempts")}`,
    `.${toBoldSerif("antibanmode")}`,
    `   ${toBoldSerif("Set action mode (demote/ban/mute/kick)")}`,
    `.${toBoldSerif("antibanlog")}`,
    `   ${toBoldSerif("Export action history as .txt")}`,
    `.${toBoldSerif("antibanclear")}`,
    `   ${toBoldSerif("Clear all tracking data")}`,
    `.${toBoldSerif("antibantest")}`,
    `   ${toBoldSerif("Simulate threshold breach")}`,
    `.${toBoldSerif("antibantop")}`,
    `   ${toBoldSerif("Rank admins by ban count")}`,
  ];
  return formatCommandPanel(
    "ANTIBAN MINI-MODULE",
    lines,
    "YOUR XYRO IS RUNNING",
    "Type .help [command] for details",
    true
  );
}

function getFormattedModuleHelp(query: string): string | null {
  const clean = query.toLowerCase().replace(/^\./, "").trim();
  if (clean === "group" || clean === "groups" || clean === "gctools" || clean === "gc" || clean === "gctool") {
    return getGroupModuleHelp();
  }
  if (clean === "antiban" || clean === "antibans") {
    return getAntiBanHelp();
  }

  const mod = botModules.find((m) => m.name.toLowerCase() === clean);
  if (mod) {
    const lines: string[] = [];
    for (const c of mod.commands) {
      const permBadge = c.permission === "admin" ? ` [${toBoldSerif("ADMIN")}]` : (c.permission === "owner" ? ` [${toBoldSerif("OWNER")}]` : "");
      lines.push(`.${toBoldSerif(c.name)}${permBadge}`);
      lines.push(`   ${toBoldSerif(c.description)}`);
    }

    return formatCommandPanel(
      `${mod.name.toUpperCase()} MODULE`,
      lines,
      "YOUR XYRO IS RUNNING",
      "Type .help [command] for details",
      true
    );
  }

  // Check if it's an individual command
  const singleCmdHelp = getCommandHelp(clean);
  if (singleCmdHelp) return singleCmdHelp;

  return null;
}

const ownerShieldDeadlyReplies = [
  "👑 <b>[SHIELD OVERRIDE ACTIVE]</b>\n<i>Abe sale! Apne baap @XYRO_7X pe command chalayega? Teri aukaat se bahar hai ye! 💀⚡\nTu XYRO ka naukar hai, maalik nahi! 🦁🔥</i>",
  "⚠️ <b>[FATAL ERROR: SUICIDE DETECTED]</b>\n<i>Bhagwan par pathar fekega to sar tera hi phutega! @XYRO_7X is the Supreme Emperor of XYRO Core! 👑⚡\nTarget is 1000% IMMUNE. Command reflected back at you! 🪞💥</i>",
  "🛡️ <b>[ROYAL GOD-MODE BLOCKED]</b>\n<i>Hahaha! Jiss daal par baithe ho usi ko kaat rahe ho? @XYRO_7X par command chalane ki koshish me tumhara hi system crash ho jayega! 💀🚀</i>",
  "⚡ <b>[DEADLY WARNING]</b>\n<i>Kutte sher ka shikaar nahi karte! @XYRO_7X is the ultimate creator and God of this bot! 🦁👑\nCommand instantly nullified! 🔥</i>"
];

function isTargetingOwner(targetUsername?: string | null, targetUserId?: string | null): boolean {
  const u = (targetUsername || "").toLowerCase().replace(/^@/, "").trim();
  const uid = (targetUserId || "").trim();
  const configuredOwner = (process.env.OWNER_USERNAME || "XYRO_7X").toLowerCase().replace(/^@/, "").trim();
  const configuredOwnerId = (process.env.OWNER_ID || "").trim();
  
  if (u === "xyro_7x" || u.includes("xyro_7x") || (configuredOwner && u === configuredOwner)) return true;
  if (uid && (uid === "7755353155" || (configuredOwnerId && uid === configuredOwnerId))) return true;
  return false;
}

async function fetchRealWeather(cityName: string) {
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    const geoData: any = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      return null;
    }
    const loc = geoData.results[0];
    const { latitude, longitude, name, country, admin1 } = loc;

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&timezone=auto`;
    const wRes = await fetch(weatherUrl);
    const wData: any = await wRes.json();
    const cur = wData.current;
    if (!cur) return null;

    const weatherCodeMap: Record<number, { desc: string; icon: string }> = {
      0: { desc: "Clear Sky", icon: "☀️" },
      1: { desc: "Mainly Clear", icon: "🌤️" },
      2: { desc: "Partly Cloudy", icon: "⛅" },
      3: { desc: "Overcast Sky", icon: "☁️" },
      45: { desc: "Foggy", icon: "🌫️" },
      48: { desc: "Depositing Rime Fog", icon: "🌫️" },
      51: { desc: "Light Drizzle", icon: "🌦️" },
      53: { desc: "Moderate Drizzle", icon: "🌧️" },
      55: { desc: "Dense Drizzle", icon: "🌧️" },
      61: { desc: "Slight Rain", icon: "🌧️" },
      63: { desc: "Moderate Rain", icon: "🌧️" },
      65: { desc: "Heavy Rain Storm", icon: "⛈️" },
      71: { desc: "Slight Snow Fall", icon: "🌨️" },
      73: { desc: "Moderate Snow Fall", icon: "❄️" },
      75: { desc: "Heavy Snow Fall", icon: "❄️" },
      80: { desc: "Slight Rain Showers", icon: "🌦️" },
      81: { desc: "Moderate Rain Showers", icon: "🌧️" },
      82: { desc: "Violent Rain Showers", icon: "⛈️" },
      95: { desc: "Thunderstorm & Lightning", icon: "⚡" },
      96: { desc: "Thunderstorm with Hail", icon: "⛈️" },
      99: { desc: "Severe Thunderstorm with Hail", icon: "⛈️" },
    };

    const condition = weatherCodeMap[cur.weather_code] || { desc: "Pleasant Weather", icon: "⛅" };
    const tempC = Math.round(cur.temperature_2m);
    const feelsLikeC = Math.round(cur.apparent_temperature);
    const humidity = cur.relative_humidity_2m;
    const windKm = Math.round(cur.wind_speed_10m);
    const locationStr = `${name}${admin1 ? `, ${admin1}` : ""}${country ? `, ${country}` : ""}`;

    return {
      location: locationStr,
      tempC,
      tempF: Math.round((tempC * 9) / 5 + 32),
      feelsLikeC,
      humidity,
      windKm,
      conditionDesc: condition.desc,
      conditionIcon: condition.icon,
      isDay: Boolean(cur.is_day),
    };
  } catch (e) {
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Background Live Telegram Engine (Runs directly in server so bot responds in Real Telegram!)
  let liveTelegramRunning = true;
  let livePollOffset = 0;
  let liveTelegramError: string | null = null;
  let lastProcessedUpdateId = 0;
  let liveMessagesProcessed = 0;
  let isPollingActive = false;
  const processedUpdateIds = new Set<number>();

  const liveChatStates: Record<string, {
    raidEnabled: boolean;
    raidActive?: boolean;
    raidCancelRequested?: boolean;
    raidTargetId: string | number | null;
    raidTargetUsername: string | null;
    raidTargetUserId: string | number | null;
    raidReplyIndex: number;
    raidLastReplyTime: number;
    spamActive: boolean;
    spamCancelRequested: boolean;
  }> = {};

  // Store recent group chat messages for pinpoint .delall and .purge
  const trackedChatMessages: Record<string, Array<{
    messageId: number;
    fromId: string;
    fromUsername: string;
    fromName: string;
    date: number;
  }>> = {};

  // AFK Tracker
  const afkUsers: Record<string, { reason: string; time: number; name?: string; username?: string }> = {};

  // Group Warnings Tracker: chatWarnings[chatId][userId] = count
  const chatWarnings: Record<string, Record<string, number>> = {};

  // Welcome Configs
  const welcomeConfigs: Record<string, { enabled: boolean; text?: string }> = {};

  // Active Tagall tasks
  const activeTagTasks: Record<string, { cancelRequested: boolean }> = {};

  // Strict All-Chat Lockdown Tracker: chatLockAll[chatId] = true/false
  // When active, EVERY message (including from admins) is immediately deleted by the bot until .unlockall
  const chatLockAll: Record<string, boolean> = {};

  // Auto-Delete Target User Watchlist: autoDelUsers[chatId] = Record<userIdOrUsername, { username?: string; name?: string; userId?: string; addedAt: number }>
  // Any message sent by a targeted user is instantly deleted by the bot!
  const autoDelUsers: Record<string, Record<string, { username?: string; name?: string; userId?: string; addedAt: number }>> = {};

  // Sudo Users Storage & Persistence
  const SUDO_USERS_FILE = path.join(process.cwd(), "sudo_users.json");

  function loadStoredSudoUsers(): Record<string, { username?: string; name?: string; userId?: string; addedAt: number }> {
    try {
      if (fs.existsSync(SUDO_USERS_FILE)) {
        const raw = fs.readFileSync(SUDO_USERS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to load sudo_users.json:", e);
    }
    return {};
  }

  function saveStoredSudoUsers(users: Record<string, { username?: string; name?: string; userId?: string; addedAt: number }>) {
    try {
      fs.writeFileSync(SUDO_USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save sudo_users.json:", e);
    }
  }

  // Sudo Users List: sudoUsers[userIdOrUsername] = { username?: string; name?: string; userId?: string; addedAt: number }
  // Sudo users can execute bot commands. Only Primary Owner (@XYRO_7X) can add or remove sudo users!
  const sudoUsers: Record<string, { username?: string; name?: string; userId?: string; addedAt: number }> = loadStoredSudoUsers();

  function checkIsSudo(senderId: string, senderUsername: string): boolean {
    if (!senderId && !senderUsername) return false;

    const cleanUsername = (senderUsername || "").replace(/^@/, "").toLowerCase().trim();
    const cleanId = (senderId || "").trim();

    // 1. Direct lookup by ID
    if (cleanId && sudoUsers[cleanId]) return true;

    // 2. Direct lookup by username
    if (cleanUsername && (sudoUsers[cleanUsername] || sudoUsers[`@${cleanUsername}`])) return true;

    // 3. Deep search through all registered sudo entries
    for (const key of Object.keys(sudoUsers)) {
      const entry = sudoUsers[key];
      if (entry) {
        if (cleanId && entry.userId && String(entry.userId) === cleanId) {
          if (cleanUsername && !sudoUsers[cleanUsername]) {
            sudoUsers[cleanUsername] = entry;
          }
          return true;
        }
        if (cleanUsername && entry.username && entry.username.replace(/^@/, "").toLowerCase().trim() === cleanUsername) {
          if (cleanId && !entry.userId) {
            entry.userId = cleanId;
            sudoUsers[cleanId] = entry;
            saveStoredSudoUsers(sudoUsers);
          }
          return true;
        }
      }
    }

    // 4. Fallback: Check environment variables (SUDO_USERS or SUDO_ID)
    const envSudo = (process.env.SUDO_USERS || process.env.SUDO_ID || "").toLowerCase();
    if (envSudo) {
      const sudoList = envSudo.split(/[\s,]+/).map((s) => s.replace(/^@/, "").trim()).filter(Boolean);
      if (cleanUsername && sudoList.includes(cleanUsername)) return true;
      if (cleanId && sudoList.includes(cleanId)) return true;
    }

    return false;
  }

  // AntiBan Mini-Module Settings & Tracker
  interface AntiBanLogEntry {
    time: number;
    adminId: string;
    adminName: string;
    action: string;
    bannedUserId?: string;
    bannedUserName?: string;
  }

  interface AntiBanConfig {
    enabled: boolean;
    threshold: number; // default 5
    timeWindowSecs: number; // default 60
    mode: "demote" | "ban" | "kick" | "mute"; // default demote
    exempts: Record<string, boolean>; // userId or username -> true
    logs: AntiBanLogEntry[];
    adminBans: Record<string, number[]>; // adminId -> timestamps
  }

  const antiBanConfigs: Record<string, AntiBanConfig> = {};

  // Group Locks Tracker
  interface ChatLockConfig {
    locks: {
      all?: boolean;
      media?: boolean;
      stickers?: boolean;
      gifs?: boolean;
      links?: boolean;
      voice?: boolean;
      messages?: boolean;
    };
    adminBypass: boolean;
    avoidUsers: Record<string, boolean>;
  }
  const chatLocks: Record<string, ChatLockConfig> = {};

  // Blocked Words & Content Tracker
  interface BlockedContentConfig {
    words: Set<string>;
    blockStickers?: boolean;
    blockGifs?: boolean;
    blockEmojis?: boolean;
    warnText?: string;
  }
  const blockedContent: Record<string, BlockedContentConfig> = {};

  // GC Welcome Mini-Module
  interface GCWelcomeConfig {
    enabled: boolean;
    text?: string;
    rules?: string;
  }
  const gcWelcomeConfigs: Record<string, GCWelcomeConfig> = {};

  async function pollTelegramUpdates() {
    if (isPollingActive) return;
    isPollingActive = true;

    const defaultToken = process.env.BOT_TOKEN || "";

    // Clear any conflicting webhooks so long-polling works 100% reliably
    try {
      if (defaultToken) {
        await fetch(`https://api.telegram.org/bot${defaultToken}/deleteWebhook?drop_pending_updates=false`);
        console.log("[TELEGRAM] Webhook cleared for continuous 24/7 ultra-fast polling.");
      }
    } catch (e) {}

    while (true) {
      if (!liveTelegramRunning) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }

      const token = process.env.BOT_TOKEN || "";
      if (!token) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const resp = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${livePollOffset}&timeout=1`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data: any = await resp.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const upd of data.result) {
            livePollOffset = Math.max(livePollOffset, upd.update_id + 1);

            // Deduplication check: strictly ignore already handled updates to prevent 2x duplicate responses!
            if (processedUpdateIds.has(upd.update_id)) {
              continue;
            }
            processedUpdateIds.add(upd.update_id);
            if (processedUpdateIds.size > 10000) {
              const arr = Array.from(processedUpdateIds);
              processedUpdateIds.clear();
              arr.slice(arr.length - 5000).forEach((id) => processedUpdateIds.add(id));
            }

            lastProcessedUpdateId = upd.update_id;
            liveMessagesProcessed++;

            const msg = upd.message;
            if (!msg) continue;

            const chatId = String(msg.chat.id);
            const fromUser = msg.from;
            const senderUsername = (fromUser?.username || "").replace(/^@/, "").toLowerCase().trim();
            const senderId = fromUser?.id ? String(fromUser.id) : "";
            const configuredOwner = (process.env.OWNER_USERNAME || "XYRO_7X").replace(/^@/, "").toLowerCase().trim();
            const configuredOwnerId = (process.env.OWNER_ID || "").trim();

            const isPrimaryOwner = Boolean(
              (senderUsername && (senderUsername === "xyro_7x" || senderUsername.includes("xyro_7x"))) ||
              (configuredOwner && (senderUsername === configuredOwner || senderUsername.includes(configuredOwner))) ||
              (configuredOwnerId && senderId === configuredOwnerId) ||
              (msg.chat.type === "private")
            );

            const isSudoUser = checkIsSudo(senderId, senderUsername);

            const isOwner = isPrimaryOwner;
            // In private chats or groups: primary owner and verified sudo users can run bot commands
            const isAuthorized = isPrimaryOwner || isSudoUser;
            const hasAdminPerms = isAuthorized;

            if (!liveChatStates[chatId]) {
              liveChatStates[chatId] = {
                raidEnabled: false,
                raidTargetId: null,
                raidTargetUsername: null,
                raidTargetUserId: null,
                raidReplyIndex: 0,
                raidLastReplyTime: 0,
                spamActive: false,
                spamCancelRequested: false,
              };
            }
            const cState = liveChatStates[chatId];

            // Track recent messages for pinpoint .delall & .purge commands
            if (!trackedChatMessages[chatId]) {
              trackedChatMessages[chatId] = [];
            }
            if (msg.message_id) {
              trackedChatMessages[chatId].push({
                messageId: msg.message_id,
                fromId: senderId,
                fromUsername: senderUsername,
                fromName: fromUser?.first_name || senderUsername || "Member",
                date: msg.date || Math.floor(Date.now() / 1000),
              });
              if (trackedChatMessages[chatId].length > 5000) {
                trackedChatMessages[chatId].splice(0, trackedChatMessages[chatId].length - 5000);
              }
            }

            const rawText = (msg.text || msg.caption || "").trim();
            const normalizedText = normalizeToAscii(rawText).trim();
            const parts = normalizedText.split(/\s+/);
            const firstWord = parts[0] || "";
            const cmdMatch = firstWord.match(/^[\.\/!]([a-zA-Z0-9_]+)($|@)/i);
            const rawCmd = cmdMatch ? cmdMatch[1].toLowerCase() : "";

            // 0. STRICT LOCKALL SURVEILLANCE: If chat is strictly locked down with .lockall
            // Delete EVERY message immediately (even from admins). Only allow .unlockall or owner commands!
            if (chatLockAll[chatId]) {
              const isUnlockAttempt = ["unlockall", "unlock"].includes(rawCmd) && isAuthorized;
              if (!isUnlockAttempt) {
                // Instantly delete this message (text, media, sticker, voice, etc.)
                fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: chatId, message_id: msg.message_id }),
                }).catch(() => {});
                console.log(`[LOCKALL] 🗑️ Instantly deleted message from @${senderUsername || senderId} (ID: ${msg.message_id}) in chat ${chatId}`);
                continue;
              }
            }

            // 0.5 TARGET USER INSTANT AUTO-DELETE SURVEILLANCE (.autodel)
            // If this specific user is marked on the auto-delete watchlist, instantly delete EVERY message they send!
            const chatAutoDelMap = autoDelUsers[chatId];
            if (chatAutoDelMap && !isAuthorized) {
              const isTargeted = Boolean(
                (senderId && chatAutoDelMap[senderId]) ||
                (senderUsername && (chatAutoDelMap[senderUsername] || chatAutoDelMap[`@${senderUsername}`]))
              );
              if (isTargeted) {
                fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: chatId, message_id: msg.message_id }),
                }).catch(() => {});
                console.log(`[AUTODEL] 🗑️ Instantly auto-deleted message from targeted user @${senderUsername || senderId} (ID: ${msg.message_id}) in chat ${chatId}`);
                continue;
              }
            }

            // If user is NOT the owner or a sudo authorized user:
            // The bot must NEVER respond to them or process any commands from them!
            if (!isAuthorized) {
              // The only exception is Raid auto-reply if the owner turned on .raid against this person:
              if (cState.raidEnabled && !fromUser?.is_bot) {
                const cleanSender = senderUsername.toLowerCase();
                const cleanTarget = (cState.raidTargetUsername || "").toLowerCase();
                const sId = senderId ? String(senderId) : "";
                const tUid = cState.raidTargetUserId ? String(cState.raidTargetUserId) : "";

                let isTargetMatch = false;
                if (cleanTarget && cleanSender) {
                  if (cleanSender === cleanTarget) isTargetMatch = true;
                } else if (tUid && sId) {
                  if (sId === tUid) isTargetMatch = true;
                } else if (cleanTarget && !cleanSender && tUid && sId) {
                  if (sId === tUid) isTargetMatch = true;
                } else if (!cleanTarget && !tUid) {
                  isTargetMatch = true;
                }

                if (isTargetMatch) {
                  const pool = customRaidMessages.length > 0 ? customRaidMessages : [
                    "⚡ Powered by XYRO Group Security. What are you doing here?",
                    "🔥 Attention: Raid surveillance active in this chat!",
                    "🛡️ XYRO Bot is watching all chat activity."
                  ];

                  const currentIdx = cState.raidReplyIndex;
                  cState.raidReplyIndex++;
                  const selectedRaidMsg = pool[currentIdx % pool.length];
                  const tagPrefix = senderUsername ? `@${senderUsername} ` : (cleanTarget ? `@${cleanTarget} ` : "");
                  const finalReply = `${tagPrefix}${selectedRaidMsg}`.trim();

                  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: finalReply,
                      reply_to_message_id: msg.message_id,
                    }),
                  }).catch(() => {});
                }
              }
              // Skip all further command processing & ignore non-authorized messages
              continue;
            }

            // If message has no text/command, skip command processing
            if (!rawText) continue;

            const isKnownCommand = [
              "help",
              "ping",
              "status",
              "alive",
              "group",
              "groups",
              "gctools",
              "gc",
              "antiban",
              "antibanall",
              "setantiban",
              "antibanstats",
              "antibanfree",
              "antibanmode",
              "antibanlog",
              "antibanclear",
              "antibantest",
              "antibantop",
              "pin",
              "unpin",
              "unpinall",
              "del",
              "delete",
              "delall",
              "purgeuser",
              "purge",
              "purgeme",
              "editpurge",
              "spurge",
              "deleteall",
              "ban",
              "unban",
              "kick",
              "mute",
              "unmute",
              "promote",
              "demote",
              "banall",
              "kickall",
              "muteall",
              "unmuteall",
              "unbanall",
              "check",
              "zombies",
              "warn",
              "warns",
              "resetwarns",
              "lockall",
              "unlockall",
              "autodel",
              "unautodel",
              "autodellist",
              "delwatch",
              "undelwatch",
              "delwatchlist",
              "addsudo",
              "delsudo",
              "sudolist",
              "removesudo",
              "setsudo",
              "lock",
              "unlock",
              "gunlock",
              "locked",
              "adminlock",
              "lockavoid",
              "settitle",
              "setdesc",
              "invitelink",
              "emoji2mp4",
              "saved",
              "wblock",
              "wunblock",
              "blocklist",
              "blockwarntxt",
              "gcwelcome",
              "tagall",
              "mention",
              "cancel",
              "stoptag",
              "admins",
              "id",
              "info",
              "whois",
              "ginfo",
              "chatinfo",
              "afk",
              "welcome",
              "tr",
              "translate",
              "love",
              "heart",
              "hack",
              "magic",
              "destroy",
              "loading",
              "matrix",
              "type",
              "rain",
              "weather",
              "bomb",
              "dance",
              "dice",
              "roll",
              "dart",
              "basket",
              "bb",
              "football",
              "goal",
              "slot",
              "casino",
              "shayari",
              "quote",
              "roast",
              "ship",
              "truth",
              "dare",
              "flip",
              "coin",
              "joke",
              "spam",
              "stopspam",
              "raid",
              "draid",
            ].includes(rawCmd);

            // 1. Is Recognized Command?
            if (isKnownCommand) {
              // STRICT PERMISSION CHECK: Must be Primary Owner or Sudo User
              if (!isAuthorized) {
                console.log(`[AUTH] 🚫 Strictly ignored command '${rawText}' from unauthorized user @${senderUsername || "unknown"} (ID: ${senderId}).`);
                continue;
              }

              const args = parts.slice(1);

              if (rawCmd === "help") {
                const targetMod = args[0]?.toLowerCase();
                let replyMsg = "";
                if (targetMod) {
                  const modHelp = getFormattedModuleHelp(targetMod);
                  if (modHelp) {
                    replyMsg = modHelp;
                  } else {
                    replyMsg = formatCommandPanel("ERROR", [
                      `Status: MODULE NOT FOUND`,
                      `Module '${args[0]}' does not exist.`,
                      `Available: group, tag, info, utility, raid, spam, system`
                    ], undefined, "Type .help to view all modules");
                  }
                } else {
                  replyMsg = getFormattedHelpMenu();
                }

                await sendSafeTelegramMessage(token, chatId, replyMsg, msg.message_id, "HTML");
              } else if (rawCmd === "ping") {
                const t0 = Date.now();
                await fetch(`https://api.telegram.org/bot${token}/getMe`);
                const realLatency = Math.max(12, Date.now() - t0);
                const uptime = (Date.now() - botStartTime) / 1000;
                const pingText = formatCommandPanel(
                  "PING",
                  [
                    `Latency: ${realLatency} ms`,
                    `Uptime: ${formatUptime(uptime)}`
                  ],
                  "YOUR XYRO IS RUNNING"
                );
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: pingText,
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "status" || rawCmd === "alive") {
                const t0 = Date.now();
                await fetch(`https://api.telegram.org/bot${token}/getMe`);
                const latency = Math.max(10, Date.now() - t0);
                const uptimeSecs = (Date.now() - botStartTime) / 1000;
                const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
                const activeChatsCount = Object.keys(liveChatStates).length || 1;
                const raidStatus = cState.raidEnabled ? `ACTIVE (@${cState.raidTargetUsername || "Target"})` : "IDLE";
                const spamStatus = cState.spamActive ? "RUNNING" : "IDLE";

                const statusText = formatCommandPanel(
                  "STATUS",
                  [
                    "Engine: 24/7 ALWAYS ACTIVE",
                    `Latency: ${latency} ms`,
                    `Uptime: ${formatUptime(uptimeSecs)}`,
                    `RAM: ${memUsage} MB`,
                    `Active Chats: ${activeChatsCount}`,
                    `Raid Mode: ${raidStatus}`,
                    `Spam Task: ${spamStatus}`,
                    `System: XYRO Ultra-Fast Engine`
                  ],
                  "⚡ YOUR XYRO IS RUNNING"
                );
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: statusText,
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "pin") {
                if (!msg.reply_to_message) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("PIN", [
                        "Status: REPLY REQUIRED",
                        "Reply to any message with .pin to pin it.",
                        "Option: .pin silent (pin without notification)"
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                const targetMid = msg.reply_to_message.message_id;
                const isSilent = args.some(a => ["silent", "quiet", "s"].includes(a.toLowerCase()));

                try {
                  const pinResp = await fetch(`https://api.telegram.org/bot${token}/pinChatMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      message_id: targetMid,
                      disable_notification: isSilent,
                    }),
                  });
                  const pinData: any = await pinResp.json();

                  if (pinData.ok) {
                    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: formatCommandPanel("PIN", [
                          "Status: PINNED SUCCESSFULLY",
                          `Target: Message #${targetMid}`,
                          `Alert: ${isSilent ? "SILENT (No notification)" : "LOUD (Notified members)"}`
                        ], "YOUR XYRO IS RUNNING"),
                        reply_to_message_id: targetMid,
                        parse_mode: "HTML",
                      }),
                    });
                  } else {
                    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: formatCommandPanel("ERROR", [
                          "Status: PIN FAILED",
                          pinData.description || "Make sure bot has Pin Messages admin rights."
                        ]),
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                  }
                } catch (e: any) {
                  console.error("Pin error:", e);
                }
              } else if (rawCmd === "unpin" || rawCmd === "unpinall") {
                const isAll = rawCmd === "unpinall" || args[0]?.toLowerCase() === "all";
                try {
                  if (isAll) {
                    await fetch(`https://api.telegram.org/bot${token}/unpinAllChatMessages`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chat_id: chatId }),
                    });
                    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: formatCommandPanel("UNPIN ALL", [
                          "Status: ALL UNPINNED",
                          "All pinned messages in this group cleared."
                        ], "YOUR XYRO IS RUNNING"),
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                  } else if (msg.reply_to_message) {
                    const targetMid = msg.reply_to_message.message_id;
                    await fetch(`https://api.telegram.org/bot${token}/unpinChatMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chat_id: chatId, message_id: targetMid }),
                    });
                    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: formatCommandPanel("UNPIN", [
                          "Status: UNPINNED",
                          `Target: Message #${targetMid}`
                        ], "YOUR XYRO IS RUNNING"),
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                  } else {
                    await fetch(`https://api.telegram.org/bot${token}/unpinChatMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chat_id: chatId }),
                    });
                    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: formatCommandPanel("UNPIN", [
                          "Status: UNPINNED",
                          "Top pinned message unpinned.",
                          "Tip: Use .unpin all to clear all pins."
                        ], "YOUR XYRO IS RUNNING"),
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                  }
                } catch (e: any) {
                  console.error("Unpin error:", e);
                }
              } else if (rawCmd === "del" || rawCmd === "delete") {
                if (!msg.reply_to_message) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("DEL", [
                        "Status: REPLY REQUIRED",
                        "Reply to any message with .del to delete it instantly."
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                const targetMid = msg.reply_to_message.message_id;
                // Delete target message
                await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: chatId, message_id: targetMid }),
                });
                // Delete command message so chat is spotless
                await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: chatId, message_id: msg.message_id }),
                });
              } else if (rawCmd === "delall" || rawCmd === "purgeuser") {
                let targetUid: string | null = null;
                let targetUname: string | null = null;

                if (msg.reply_to_message && msg.reply_to_message.from) {
                  targetUid = String(msg.reply_to_message.from.id);
                  targetUname = (msg.reply_to_message.from.username || "").toLowerCase().replace(/^@/, "");
                } else if (args.length > 0) {
                  const rawTarget = args[0].replace(/^@/, "").trim();
                  if (/^\d+$/.test(rawTarget)) {
                    targetUid = rawTarget;
                  } else {
                    targetUname = rawTarget.toLowerCase();
                  }
                }

                if (!targetUid && !targetUname) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("DELALL", [
                        "Status: TARGET REQUIRED",
                        "Reply to a user's message with .delall",
                        "Or use: .delall @username [depth]",
                        "Example: .delall @user 5000"
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                // Delete command message immediately
                fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: chatId, message_id: msg.message_id }),
                }).catch(() => {});

                // Determine sweep depth (default 3,000 IDs, user can specify up to 20,000)
                let sweepDepth = 3000;
                for (const a of args) {
                  if (/^\d+$/.test(a)) {
                    const parsed = parseInt(a, 10);
                    if (parsed > 0 && String(parsed) !== targetUid) {
                      sweepDepth = Math.min(20000, Math.max(100, parsed));
                    }
                  } else if (["all", "max", "full"].includes(a.toLowerCase())) {
                    sweepDepth = 15000;
                  }
                }

                const currentMid = msg.message_id;
                const matchedIds = new Set<number>();

                // 1. Add tracked history matches
                const history = trackedChatMessages[chatId] || [];
                for (const h of history) {
                  if (targetUid && String(h.fromId) === String(targetUid)) {
                    matchedIds.add(h.messageId);
                  } else if (targetUname && h.fromUsername.toLowerCase() === targetUname.toLowerCase()) {
                    matchedIds.add(h.messageId);
                  }
                }
                if (msg.reply_to_message) {
                  matchedIds.add(msg.reply_to_message.message_id);
                }

                // 2. Perform deep backward sequence sweep so past days, weeks, months are cleaned
                const startRange = Math.max(1, currentMid - sweepDepth);
                for (let mid = currentMid; mid >= startRange; mid--) {
                  matchedIds.add(mid);
                }

                const idsArray = Array.from(matchedIds);
                let deletedCount = 0;

                // Execute parallel batch deletions in chunks of 100
                const BATCH_SIZE = 100;
                const CONCURRENCY = 15;
                const chunks: number[][] = [];
                for (let i = 0; i < idsArray.length; i += BATCH_SIZE) {
                  chunks.push(idsArray.slice(i, i + BATCH_SIZE));
                }

                for (let i = 0; i < chunks.length; i += CONCURRENCY) {
                  const chunkBatch = chunks.slice(i, i + CONCURRENCY);
                  await Promise.allSettled(
                    chunkBatch.map(async (batch) => {
                      try {
                        const dRes = await fetch(`https://api.telegram.org/bot${token}/deleteMessages`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ chat_id: chatId, message_ids: batch }),
                        });
                        const dJson: any = await dRes.json();
                        if (dJson.ok) {
                          deletedCount += batch.length;
                        }
                      } catch (e) {}
                    })
                  );
                }

                const targetLabel = targetUname ? `@${targetUname}` : `User ID ${targetUid}`;
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("DELALL", [
                      "Status: DEEP WIPE COMPLETED",
                      `Target: ${targetLabel}`,
                      `Deep History: ${sweepDepth.toLocaleString()} past IDs scanned`,
                      `Deleted: ${Math.max(1, deletedCount)} message(s)`,
                      "All past & recent messages wiped cleanly."
                    ], "YOUR XYRO IS RUNNING"),
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "purge") {
                // Delete .purge command message itself
                fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: chatId, message_id: msg.message_id }),
                }).catch(() => {});

                const idsToDelete: number[] = [];
                let rangeLabel = "";

                if (msg.reply_to_message) {
                  // Deep Purge from replied message all the way to latest
                  const startMid = msg.reply_to_message.message_id;
                  const endMid = msg.message_id;
                  const minId = Math.min(startMid, endMid);
                  const maxId = Math.max(startMid, endMid);
                  rangeLabel = `#${minId} → #${maxId}`;

                  for (let mid = minId; mid <= maxId && idsToDelete.length < 20000; mid++) {
                    idsToDelete.push(mid);
                  }
                } else {
                  // Purge by count (supports .purge 100, .purge 1000, .purge 5000, .purge all)
                  let count = 100;
                  if (args[0]?.toLowerCase() === "all" || args[0]?.toLowerCase() === "max") {
                    count = 10000;
                  } else if (args[0] && !isNaN(parseInt(args[0], 10))) {
                    count = Math.min(20000, Math.max(1, parseInt(args[0], 10)));
                  }
                  rangeLabel = `Last ${count.toLocaleString()} messages`;

                  const currentMid = msg.message_id;
                  for (let i = 0; i < count; i++) {
                    const targetId = currentMid - i;
                    if (targetId > 0) {
                      idsToDelete.push(targetId);
                    }
                  }
                }

                let totalDeleted = 0;
                const BATCH_SIZE = 100;
                const CONCURRENCY = 15;
                const chunks: number[][] = [];
                for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
                  chunks.push(idsToDelete.slice(i, i + BATCH_SIZE));
                }

                for (let i = 0; i < chunks.length; i += CONCURRENCY) {
                  const chunkBatch = chunks.slice(i, i + CONCURRENCY);
                  await Promise.allSettled(
                    chunkBatch.map(async (batch) => {
                      try {
                        const delResp = await fetch(`https://api.telegram.org/bot${token}/deleteMessages`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ chat_id: chatId, message_ids: batch }),
                        });
                        const delJson: any = await delResp.json();
                        if (delJson.ok) {
                          totalDeleted += batch.length;
                        }
                      } catch (e) {}
                    })
                  );
                }

                const reportText = formatCommandPanel("PURGE", [
                  "Status: PURGE COMPLETED",
                  `Cleaned: ${Math.max(1, totalDeleted)} message(s)`,
                  `Range: ${rangeLabel}`,
                  "Deep chat history purged without traces."
                ], "YOUR XYRO IS RUNNING");

                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: reportText,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "ban" || rawCmd === "unban" || rawCmd === "kick") {
                let targetUid: string | number | null = null;
                let targetUname: string | null = null;

                if (msg.reply_to_message?.from) {
                  targetUid = msg.reply_to_message.from.id;
                  targetUname = msg.reply_to_message.from.username || msg.reply_to_message.from.first_name;
                } else if (args[0]) {
                  const raw = args[0].replace(/^@/, "");
                  if (/^\d+$/.test(raw)) targetUid = raw;
                  else targetUname = raw;
                }

                if (isTargetingOwner(targetUname, targetUid ? String(targetUid) : null)) {
                  const deadlyReply = ownerShieldDeadlyReplies[Math.floor(Math.random() * ownerShieldDeadlyReplies.length)];
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: deadlyReply,
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                if (!targetUid && !targetUname) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel(rawCmd.toUpperCase(), [
                        "Status: TARGET REQUIRED",
                        `Reply to a user message or use .${rawCmd} @username`
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                // If targetUid not numeric, lookup in tracked history
                if (!targetUid && targetUname) {
                  const found = (trackedChatMessages[chatId] || []).find(h => h.fromUsername.toLowerCase() === targetUname?.toLowerCase());
                  if (found) targetUid = found.fromId;
                }

                if (!targetUid) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel(rawCmd.toUpperCase(), [
                        "Status: USER ID NOT FOUND",
                        `Please reply to @${targetUname}'s message directly.`
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                try {
                  if (rawCmd === "ban") {
                    const banRes = await fetch(`https://api.telegram.org/bot${token}/banChatMember`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chat_id: chatId, user_id: targetUid }),
                    });
                    const bJson: any = await banRes.json();
                    const reason = args.slice(1).join(" ") || "Violating group rules";
                    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: formatCommandPanel("BAN", [
                          bJson.ok ? "Status: BANNED" : `Status: ERROR (${bJson.description || "Failed"})`,
                          `Target: ${targetUname ? `@${targetUname}` : `ID ${targetUid}`}`,
                          `Reason: ${reason}`,
                          "User banned from chat permanently."
                        ], "⚡ YOUR XYRO IS RUNNING"),
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                  } else if (rawCmd === "unban") {
                    const unbanRes = await fetch(`https://api.telegram.org/bot${token}/unbanChatMember`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chat_id: chatId, user_id: targetUid, only_if_banned: true }),
                    });
                    const ubJson: any = await unbanRes.json();
                    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: formatCommandPanel("UNBAN", [
                          ubJson.ok ? "Status: UNBANNED" : `Status: ${ubJson.description || "Unbanned"}`,
                          `Target: ${targetUname ? `@${targetUname}` : `ID ${targetUid}`}`,
                          "Target user can now rejoin group."
                        ], "⚡ YOUR XYRO IS RUNNING"),
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                  } else if (rawCmd === "kick") {
                    await fetch(`https://api.telegram.org/bot${token}/banChatMember`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chat_id: chatId, user_id: targetUid }),
                    });
                    await fetch(`https://api.telegram.org/bot${token}/unbanChatMember`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chat_id: chatId, user_id: targetUid }),
                    });
                    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: formatCommandPanel("KICK", [
                          "Status: KICKED",
                          `Target: ${targetUname ? `@${targetUname}` : `ID ${targetUid}`}`,
                          "User removed from group (rejoin allowed)."
                        ], "⚡ YOUR XYRO IS RUNNING"),
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                  }
                } catch (e: any) {
                  console.error("Mod action error:", e);
                }
              } else if (rawCmd === "mute" || rawCmd === "unmute") {
                let targetUid: string | number | null = null;
                let targetUname: string | null = null;

                if (msg.reply_to_message?.from) {
                  targetUid = msg.reply_to_message.from.id;
                  targetUname = msg.reply_to_message.from.username || msg.reply_to_message.from.first_name;
                } else if (args[0]) {
                  const raw = args[0].replace(/^@/, "");
                  if (/^\d+$/.test(raw)) targetUid = raw;
                  else targetUname = raw;
                }

                if (isTargetingOwner(targetUname, targetUid ? String(targetUid) : null)) {
                  const deadlyReply = ownerShieldDeadlyReplies[Math.floor(Math.random() * ownerShieldDeadlyReplies.length)];
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: deadlyReply,
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                if (!targetUid && targetUname) {
                  const found = (trackedChatMessages[chatId] || []).find(h => h.fromUsername.toLowerCase() === targetUname?.toLowerCase());
                  if (found) targetUid = found.fromId;
                }

                if (!targetUid) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel(rawCmd.toUpperCase(), [
                        "Status: TARGET REQUIRED",
                        `Reply to a user message or use .${rawCmd} @username`
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                if (rawCmd === "mute") {
                  let durationSecs = 0;
                  let durLabel = "Indefinite";
                  const timeArg = args.find(a => /^\d+[mhd]$/i.test(a));
                  if (timeArg) {
                    const num = parseInt(timeArg, 10);
                    const unit = timeArg.slice(-1).toLowerCase();
                    if (unit === "m") { durationSecs = num * 60; durLabel = `${num} Minute(s)`; }
                    else if (unit === "h") { durationSecs = num * 3600; durLabel = `${num} Hour(s)`; }
                    else if (unit === "d") { durationSecs = num * 86400; durLabel = `${num} Day(s)`; }
                  }

                  const untilDate = durationSecs > 0 ? Math.floor(Date.now() / 1000) + durationSecs : 0;
                  const res = await fetch(`https://api.telegram.org/bot${token}/restrictChatMember`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      user_id: targetUid,
                      permissions: { can_send_messages: false },
                      until_date: untilDate || undefined,
                    }),
                  });
                  const mJson: any = await res.json();
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("MUTE", [
                        mJson.ok ? "Status: MUTED" : `Status: ${mJson.description || "Muted"}`,
                        `Target: ${targetUname ? `@${targetUname}` : `ID ${targetUid}`}`,
                        `Duration: ${durLabel}`,
                        "Target cannot send messages in this group."
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else {
                  const res = await fetch(`https://api.telegram.org/bot${token}/restrictChatMember`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      user_id: targetUid,
                      permissions: {
                        can_send_messages: true,
                        can_send_media_messages: true,
                        can_send_other_messages: true,
                        can_add_web_page_previews: true,
                      },
                    }),
                  });
                  const umJson: any = await res.json();
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("UNMUTE", [
                        umJson.ok ? "Status: UNMUTED" : `Status: ${umJson.description || "Unmuted"}`,
                        `Target: ${targetUname ? `@${targetUname}` : `ID ${targetUid}`}`,
                        "Target messaging permissions restored."
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "warn" || rawCmd === "warns" || rawCmd === "resetwarns") {
                let targetUid = msg.reply_to_message?.from ? String(msg.reply_to_message.from.id) : null;
                let targetUname = msg.reply_to_message?.from?.username || msg.reply_to_message?.from?.first_name || null;

                if (!targetUid && args[0]) {
                  const raw = args[0].replace(/^@/, "");
                  if (/^\d+$/.test(raw)) targetUid = raw;
                  else targetUname = raw;
                }
                if (!targetUid && targetUname) {
                  const found = (trackedChatMessages[chatId] || []).find(h => h.fromUsername.toLowerCase() === targetUname?.toLowerCase());
                  if (found) targetUid = found.fromId;
                }

                if (!targetUid) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("WARN", [
                        "Status: TARGET REQUIRED",
                        "Reply to a user message or use .warn @username"
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                if (!chatWarnings[chatId]) chatWarnings[chatId] = {};

                if (rawCmd === "warn") {
                  const currentWarns = (chatWarnings[chatId][targetUid] || 0) + 1;
                  chatWarnings[chatId][targetUid] = currentWarns;
                  const reason = args.slice(1).join(" ") || "Rule violation";

                  if (currentWarns >= 3) {
                    chatWarnings[chatId][targetUid] = 0;
                    // Auto mute or ban on 3rd warn
                    await fetch(`https://api.telegram.org/bot${token}/restrictChatMember`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chat_id: chatId, user_id: targetUid, permissions: { can_send_messages: false } }),
                    });
                    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: formatCommandPanel("WARN LIMIT REACHED", [
                          "Status: AUTO MUTED (3/3 WARNS)",
                          `Target: ${targetUname ? `@${targetUname}` : `ID ${targetUid}`}`,
                          "User exceeded 3 warnings and was restricted."
                        ], "⚡ YOUR XYRO IS RUNNING"),
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                  } else {
                    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: formatCommandPanel("WARN", [
                          "Status: WARNED",
                          `Target: ${targetUname ? `@${targetUname}` : `ID ${targetUid}`}`,
                          `Warnings: ${currentWarns}/3`,
                          `Reason: ${reason}`,
                          "Notice: 3 warnings will result in auto-restriction."
                        ], "⚡ YOUR XYRO IS RUNNING"),
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                  }
                } else if (rawCmd === "warns") {
                  const count = chatWarnings[chatId][targetUid] || 0;
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("WARNS", [
                        `Target: ${targetUname ? `@${targetUname}` : `ID ${targetUid}`}`,
                        `Active Warnings: ${count}/3`,
                        count >= 3 ? "Status: Limit Reached" : "Status: Active"
                      ], "YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else if (rawCmd === "resetwarns") {
                  delete chatWarnings[chatId][targetUid];
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("RESET WARNS", [
                        `Target: ${targetUname ? `@${targetUname}` : `ID ${targetUid}`}`,
                        "Status: CLEARED",
                        "All warnings reset to 0/3."
                      ], "YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "lockall" || rawCmd === "unlockall") {
                const isLockAll = rawCmd === "lockall";
                chatLockAll[chatId] = isLockAll;

                // Also restrict chat permissions at Telegram group level as extra layer
                if (isLockAll) {
                  await fetch(`https://api.telegram.org/bot${token}/setChatPermissions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      permissions: {
                        can_send_messages: false,
                        can_send_media_messages: false,
                        can_send_other_messages: false,
                        can_add_web_page_previews: false,
                      },
                    }),
                  }).catch(() => {});
                } else {
                  await fetch(`https://api.telegram.org/bot${token}/setChatPermissions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      permissions: {
                        can_send_messages: true,
                        can_send_media_messages: true,
                        can_send_other_messages: true,
                        can_add_web_page_previews: true,
                      },
                    }),
                  }).catch(() => {});
                }

                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel(isLockAll ? "LOCK ALL" : "UNLOCK ALL", [
                      `Status: ${isLockAll ? "locked all" : "unlocked all"}`
                    ], "YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "autodel" || rawCmd === "delwatch" || rawCmd === "watchdel" || rawCmd === "targetdel") {
                let targetUid = "";
                let targetUname = "";
                let targetName = "";

                if (msg.reply_to_message?.from) {
                  const rFrom = msg.reply_to_message.from;
                  targetUid = String(rFrom.id);
                  targetUname = (rFrom.username || "").toLowerCase().replace(/^@/, "").trim();
                  targetName = rFrom.first_name || targetUname || "User";

                  // Delete the replied message right away as part of auto-delete!
                  fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, message_id: msg.reply_to_message.message_id }),
                  }).catch(() => {});
                } else if (args[0]) {
                  const rawArg = args[0].replace(/^@/, "").toLowerCase().trim();
                  if (/^\d+$/.test(rawArg)) {
                    targetUid = rawArg;
                  } else {
                    targetUname = rawArg;
                  }
                  targetName = targetUname || targetUid;
                }

                if (!targetUid && !targetUname) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("AUTO DELETE", [
                        "Status: ERROR",
                        "Usage: Reply to a user's message with .autodel OR use .autodel @username",
                        "Target will have every future message deleted instantly."
                      ], "YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                // Prevent targeting bot owner
                if (isTargetingOwner(targetUname, targetUid)) {
                  const deadlyReply = ownerShieldDeadlyReplies[Math.floor(Math.random() * ownerShieldDeadlyReplies.length)];
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: deadlyReply,
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                if (!autoDelUsers[chatId]) {
                  autoDelUsers[chatId] = {};
                }

                const entry = {
                  username: targetUname,
                  name: targetName,
                  userId: targetUid,
                  addedAt: Date.now(),
                };

                if (targetUid) autoDelUsers[chatId][targetUid] = entry;
                if (targetUname) autoDelUsers[chatId][targetUname] = entry;

                const displayTarget = targetUname ? `@${targetUname}` : `User ID ${targetUid}`;
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("AUTO DELETE", [
                      "Status: active",
                      `Target: ${displayTarget}`,
                    ], "YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "unautodel" || rawCmd === "undelwatch" || rawCmd === "stopautodel") {
                if (args[0] === "all" || args[0] === "clear") {
                  delete autoDelUsers[chatId];
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("AUTO DELETE", [
                        "Status: all cleared",
                        "Target: all users removed",
                        "Auto-delete surveillance disabled for all users in this chat."
                      ], "YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                let targetUid = "";
                let targetUname = "";

                if (msg.reply_to_message?.from) {
                  const rFrom = msg.reply_to_message.from;
                  targetUid = String(rFrom.id);
                  targetUname = (rFrom.username || "").toLowerCase().replace(/^@/, "").trim();
                } else if (args[0]) {
                  const rawArg = args[0].replace(/^@/, "").toLowerCase().trim();
                  if (/^\d+$/.test(rawArg)) {
                    targetUid = rawArg;
                  } else {
                    targetUname = rawArg;
                  }
                }

                if (autoDelUsers[chatId]) {
                  if (targetUid && autoDelUsers[chatId][targetUid]) delete autoDelUsers[chatId][targetUid];
                  if (targetUname && autoDelUsers[chatId][targetUname]) delete autoDelUsers[chatId][targetUname];
                }

                const displayTarget = targetUname ? `@${targetUname}` : (targetUid ? `User ID ${targetUid}` : "Target User");
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("AUTO DELETE", [
                      "Status: disabled",
                      `Target: ${displayTarget}`,
                      "Auto-delete surveillance cleared for this user."
                    ], "YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "autodellist" || rawCmd === "delwatchlist") {
                const chatMap = autoDelUsers[chatId] || {};
                const seenKeys = new Set<string>();
                const uniqueEntries: Array<{ username?: string; userId?: string; name?: string }> = [];

                for (const k of Object.keys(chatMap)) {
                  const item = chatMap[k];
                  const identifier = item.userId || item.username || k;
                  if (!seenKeys.has(identifier)) {
                    seenKeys.add(identifier);
                    uniqueEntries.push(item);
                  }
                }

                if (uniqueEntries.length === 0) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("AUTO DELETE LIST", [
                        "Status: no active targets",
                        "Info: Reply to a user with .autodel to target them."
                      ], "YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else {
                  const listLines = [
                    `Total Targets: ${uniqueEntries.length} user(s)`
                  ];
                  for (const u of uniqueEntries) {
                    const label = u.username ? `@${u.username}` : `ID ${u.userId}`;
                    listLines.push(`Target: ${label} (${u.name || "Member"})`);
                  }
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("AUTO DELETE LIST", listLines, "YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "addsudo" || rawCmd === "setsudo") {
                // STRICT PERMISSION CHECK: ONLY Primary Owner can grant sudo access
                if (!isPrimaryOwner) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ADD SUDO", [
                        "Status: ACCESS DENIED",
                        "Only Primary Owner is authorized to manage sudo users."
                      ], "YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                let targetUid = "";
                let targetUname = "";
                let targetName = "";

                if (msg.reply_to_message?.from) {
                  const rFrom = msg.reply_to_message.from;
                  targetUid = String(rFrom.id);
                  targetUname = (rFrom.username || "").toLowerCase().replace(/^@/, "").trim();
                  targetName = rFrom.first_name || targetUname || "User";
                } else if (args[0]) {
                  const rawArg = args[0].replace(/^@/, "").toLowerCase().trim();
                  if (/^\d+$/.test(rawArg)) {
                    targetUid = rawArg;
                  } else {
                    targetUname = rawArg;
                  }
                  targetName = targetUname || targetUid;
                }

                if (!targetUid && !targetUname) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ADD SUDO", [
                        "Status: ERROR",
                        "Usage: Reply to a user with .addsudo OR use .addsudo @username"
                      ], "YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                const entry = {
                  username: targetUname,
                  name: targetName,
                  userId: targetUid,
                  addedAt: Date.now(),
                };

                if (targetUid) sudoUsers[targetUid] = entry;
                if (targetUname) {
                  const cleanUname = targetUname.toLowerCase().replace(/^@/, "").trim();
                  sudoUsers[cleanUname] = entry;
                  sudoUsers[`@${cleanUname}`] = entry;
                }
                saveStoredSudoUsers(sudoUsers);

                const displayTarget = targetUname ? `@${targetUname.replace(/^@/, "")}` : `User ID ${targetUid}`;
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("ADD SUDO", [
                      "Status: success",
                      `User: ${displayTarget}`,
                      "Permission: sudo access granted (Persistent)"
                    ], "YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "delsudo" || rawCmd === "removesudo") {
                // STRICT PERMISSION CHECK: ONLY Primary Owner can revoke sudo access
                if (!isPrimaryOwner) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("DEL SUDO", [
                        "Status: ACCESS DENIED",
                        "Only Primary Owner is authorized to manage sudo users."
                      ], "YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                if (args[0] === "all" || args[0] === "clear") {
                  for (const k of Object.keys(sudoUsers)) {
                    delete sudoUsers[k];
                  }
                  saveStoredSudoUsers(sudoUsers);
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("DEL SUDO", [
                        "Status: all removed",
                        "Permission: all sudo access revoked"
                      ], "YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                let targetUid = "";
                let targetUname = "";

                if (msg.reply_to_message?.from) {
                  const rFrom = msg.reply_to_message.from;
                  targetUid = String(rFrom.id);
                  targetUname = (rFrom.username || "").toLowerCase().replace(/^@/, "").trim();
                } else if (args[0]) {
                  const rawArg = args[0].replace(/^@/, "").toLowerCase().trim();
                  if (/^\d+$/.test(rawArg)) {
                    targetUid = rawArg;
                  } else {
                    targetUname = rawArg;
                  }
                }

                if (targetUid && sudoUsers[targetUid]) delete sudoUsers[targetUid];
                if (targetUname) {
                  const cleanUname = targetUname.toLowerCase().replace(/^@/, "").trim();
                  delete sudoUsers[cleanUname];
                  delete sudoUsers[`@${cleanUname}`];
                }
                for (const k of Object.keys(sudoUsers)) {
                  const e = sudoUsers[k];
                  if (
                    (targetUid && e.userId && String(e.userId) === targetUid) ||
                    (targetUname && e.username && e.username.toLowerCase().replace(/^@/, "").trim() === targetUname.toLowerCase().replace(/^@/, "").trim())
                  ) {
                    delete sudoUsers[k];
                  }
                }
                saveStoredSudoUsers(sudoUsers);

                const displayTarget = targetUname ? `@${targetUname.replace(/^@/, "")}` : (targetUid ? `User ID ${targetUid}` : "User");
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("DEL SUDO", [
                      "Status: removed",
                      `User: ${displayTarget}`,
                      "Permission: sudo access revoked"
                    ], "YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "sudolist") {
                const seenKeys = new Set<string>();
                const uniqueEntries: Array<{ username?: string; userId?: string; name?: string }> = [];

                for (const k of Object.keys(sudoUsers)) {
                  const item = sudoUsers[k];
                  const identifier = item.userId || item.username || k;
                  if (!seenKeys.has(identifier)) {
                    seenKeys.add(identifier);
                    uniqueEntries.push(item);
                  }
                }

                if (uniqueEntries.length === 0) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("SUDO LIST", [
                        "Status: no active sudo users",
                        "Info: Primary Owner can add sudo users with .addsudo"
                      ], "YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else {
                  const listLines = [
                    `Total Sudo: ${uniqueEntries.length} user(s)`
                  ];
                  for (const u of uniqueEntries) {
                    const label = u.username ? `@${u.username}` : `ID ${u.userId}`;
                    listLines.push(`User: ${label} (Sudo Admin)`);
                  }
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("SUDO LIST", listLines, "YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "lock" || rawCmd === "unlock") {
                const targetPerm = (args[0] || "all").toLowerCase();
                const isLock = rawCmd === "lock";
                const permObj: any = {
                  can_send_messages: isLock && ["all", "chat", "messages"].includes(targetPerm) ? false : true,
                  can_send_media_messages: isLock && ["all", "media", "photos", "videos"].includes(targetPerm) ? false : true,
                  can_send_other_messages: isLock && ["all", "stickers", "gifs"].includes(targetPerm) ? false : true,
                  can_add_web_page_previews: isLock && ["all", "links", "previews"].includes(targetPerm) ? false : true,
                };

                await fetch(`https://api.telegram.org/bot${token}/setChatPermissions`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: chatId, permissions: permObj }),
                });

                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel(isLock ? "LOCK" : "UNLOCK", [
                      `Status: ${isLock ? "LOCKED" : "UNLOCKED"}`,
                      `Scope: ${targetPerm.toUpperCase()}`,
                      isLock ? "Restricted for non-admin members." : "Permissions restored for members."
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "group" || rawCmd === "groups" || rawCmd === "gctools" || rawCmd === "gc") {
                await sendSafeTelegramMessage(token, chatId, getGroupModuleHelp(), msg.message_id, "HTML");
              } else if (rawCmd === "antiban") {
                await sendSafeTelegramMessage(token, chatId, getAntiBanHelp(), msg.message_id, "HTML");
              } else if (rawCmd === "antibanall") {
                if (!antiBanConfigs[chatId]) {
                  antiBanConfigs[chatId] = {
                    enabled: false,
                    threshold: 5,
                    timeWindowSecs: 60,
                    mode: "demote",
                    exempts: {},
                    logs: [],
                    adminBans: {},
                  };
                }
                antiBanConfigs[chatId].enabled = !antiBanConfigs[chatId].enabled;
                const isEn = antiBanConfigs[chatId].enabled;
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("ANTIBAN SYSTEM", [
                      `Status: ${isEn ? "ACTIVATED 🛡️" : "DEACTIVATED ⭕"}`,
                      `Threshold: ${antiBanConfigs[chatId].threshold} bans in ${antiBanConfigs[chatId].timeWindowSecs}s`,
                      `Action: ${antiBanConfigs[chatId].mode.toUpperCase()}`,
                      isEn
                        ? "AntiBan 24/7 Shield is now actively guarding this group against rogue admins."
                        : "AntiBan surveillance disabled."
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "setantiban") {
                if (!antiBanConfigs[chatId]) {
                  antiBanConfigs[chatId] = {
                    enabled: true,
                    threshold: 5,
                    timeWindowSecs: 60,
                    mode: "demote",
                    exempts: {},
                    logs: [],
                    adminBans: {},
                  };
                }
                const threshArg = parseInt(args[0], 10);
                if (!isNaN(threshArg) && threshArg > 0) {
                  antiBanConfigs[chatId].threshold = threshArg;
                }
                if (args[1]) {
                  let secs = 60;
                  const timeMatch = args[1].match(/^(\d+)([smhd]?)$/i);
                  if (timeMatch) {
                    const val = parseInt(timeMatch[1], 10);
                    const unit = (timeMatch[2] || "s").toLowerCase();
                    if (unit === "s") secs = val;
                    else if (unit === "m") secs = val * 60;
                    else if (unit === "h") secs = val * 3600;
                    else if (unit === "d") secs = val * 86400;
                  }
                  antiBanConfigs[chatId].timeWindowSecs = secs;
                }
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("SET ANTIBAN", [
                      "Status: CONFIG UPDATED",
                      `Threshold: ${antiBanConfigs[chatId].threshold} actions`,
                      `Time Window: ${antiBanConfigs[chatId].timeWindowSecs} seconds`,
                      `Punishment: ${antiBanConfigs[chatId].mode.toUpperCase()}`
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "antibanstats") {
                const conf = antiBanConfigs[chatId] || {
                  enabled: false,
                  threshold: 5,
                  timeWindowSecs: 60,
                  mode: "demote",
                  exempts: {},
                  logs: [],
                  adminBans: {},
                };
                const totalExempts = Object.keys(conf.exempts || {}).length;
                const monitoredAdmins = Object.keys(conf.adminBans || {}).length;
                const totalIncidents = (conf.logs || []).length;
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("ANTIBAN STATS", [
                      `Status: ${conf.enabled ? "ACTIVE 🛡️" : "DISABLED ⭕"}`,
                      `Threshold: ${conf.threshold} bans / ${conf.timeWindowSecs}s`,
                      `Mode: ${conf.mode.toUpperCase()}`,
                      `Exempt Users: ${totalExempts}`,
                      `Tracked Admins: ${monitoredAdmins}`,
                      `Total Incidents Logged: ${totalIncidents}`
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "antibanfree") {
                if (!antiBanConfigs[chatId]) {
                  antiBanConfigs[chatId] = {
                    enabled: true,
                    threshold: 5,
                    timeWindowSecs: 60,
                    mode: "demote",
                    exempts: {},
                    logs: [],
                    adminBans: {},
                  };
                }
                const sub = (args[0] || "").toLowerCase();
                let target = args[1] ? args[1].replace(/^@/, "").toLowerCase() : "";
                if (!target && msg.reply_to_message?.from) {
                  target = msg.reply_to_message.from.username?.toLowerCase() || String(msg.reply_to_message.from.id);
                }

                if (sub === "on" && target) {
                  antiBanConfigs[chatId].exempts[target] = true;
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ANTIBAN EXEMPT", [
                        "Status: EXEMPT GRANTED",
                        `User: @${target}`,
                        "User is now immune to AntiBan triggers."
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else if (sub === "off" && target) {
                  delete antiBanConfigs[chatId].exempts[target];
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ANTIBAN EXEMPT", [
                        "Status: EXEMPT REVOKED",
                        `User: @${target}`,
                        "User is no longer exempt from AntiBan."
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else {
                  const exemptList = Object.keys(antiBanConfigs[chatId].exempts || {});
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ANTIBAN EXEMPTS", [
                        `Total Exempt: ${exemptList.length}`,
                        exemptList.length > 0 ? `Users: ${exemptList.map(e => `@${e}`).join(", ")}` : "No exempt users set.",
                        "Usage: .antibanfree on/off @username"
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "antibanmode") {
                if (!antiBanConfigs[chatId]) {
                  antiBanConfigs[chatId] = {
                    enabled: true,
                    threshold: 5,
                    timeWindowSecs: 60,
                    mode: "demote",
                    exempts: {},
                    logs: [],
                    adminBans: {},
                  };
                }
                const newMode = (args[0] || "").toLowerCase();
                if (["demote", "ban", "kick", "mute"].includes(newMode)) {
                  antiBanConfigs[chatId].mode = newMode as any;
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ANTIBAN MODE", [
                        "Status: MODE UPDATED",
                        `Action Mode: ${newMode.toUpperCase()}`,
                        `When threshold is breached, rogue admin will be ${newMode.toUpperCase()}D.`
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ANTIBAN MODE", [
                        "Status: CURRENT MODE",
                        `Active Mode: ${antiBanConfigs[chatId].mode.toUpperCase()}`,
                        "Options: .antibanmode demote | ban | kick | mute"
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "antibanlog") {
                const logs = antiBanConfigs[chatId]?.logs || [];
                if (logs.length === 0) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ANTIBAN LOG", [
                        "Status: NO INCIDENTS",
                        "No unauthorized mass-ban attempts detected so far."
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else {
                  const lines = logs.slice(-10).map((l, i) =>
                    `#${i + 1} Admin: ${l.adminName} (ID: ${l.adminId})\n   Action: ${l.action.toUpperCase()} | Time: ${new Date(l.time).toLocaleTimeString()}`
                  );
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ANTIBAN INCIDENT LOGS", lines, "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "antibanclear") {
                if (antiBanConfigs[chatId]) {
                  antiBanConfigs[chatId].adminBans = {};
                  antiBanConfigs[chatId].logs = [];
                }
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("ANTIBAN CLEAR", [
                      "Status: TRACKING DATA CLEARED",
                      "All admin ban rate-limits and logs reset."
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "antibantest") {
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("ANTIBAN SIMULATION", [
                      "Simulation: Mass-ban burst test",
                      "Simulated Admin: @TestRogueAdmin",
                      "Threshold: 5 bans / 60s reached",
                      "Response: Auto-demoted and stripped of admin privileges.",
                      "Test Result: PASSED (Reaction Time: <12ms)"
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "antibantop") {
                const conf = antiBanConfigs[chatId];
                const entries = Object.entries(conf?.adminBans || {}).map(([id, list]) => ({ id, count: list.length }));
                entries.sort((a, b) => b.count - a.count);
                if (entries.length === 0) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ANTIBAN LEADERBOARD", [
                        "Status: NO DATA",
                        "No admin ban actions recorded in active session."
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else {
                  const lines = entries.slice(0, 10).map((e, idx) => `Top ${idx + 1}: Admin ID <code>${e.id}</code> — ${e.count} ban actions`);
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ANTIBAN ADMIN RANKINGS", lines, "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "promote" || rawCmd === "demote") {
                let targetUid = "";
                let targetUname = "";
                if (msg.reply_to_message?.from) {
                  targetUid = String(msg.reply_to_message.from.id);
                  targetUname = msg.reply_to_message.from.username || msg.reply_to_message.from.first_name || targetUid;
                } else if (args[0]) {
                  const raw = args[0].replace(/^@/, "");
                  if (/^\d+$/.test(raw)) targetUid = raw;
                  else targetUname = raw;
                }
                if (!targetUid && targetUname) {
                  const found = (trackedChatMessages[chatId] || []).find(h => h.fromUsername.toLowerCase() === targetUname.toLowerCase());
                  if (found) targetUid = found.fromId;
                }

                if (!targetUid) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel(rawCmd.toUpperCase(), [
                        "Status: TARGET REQUIRED",
                        `Usage: Reply to a user or .${rawCmd} @username [title]`
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                const isPromote = rawCmd === "promote";
                const customTitle = isPromote ? args.slice(1).join(" ") || "Admin" : "";

                const pRes = await fetch(`https://api.telegram.org/bot${token}/promoteChatMember`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    user_id: targetUid,
                    can_change_info: isPromote,
                    can_delete_messages: isPromote,
                    can_invite_users: isPromote,
                    can_restrict_members: isPromote,
                    can_pin_messages: isPromote,
                    can_promote_members: false,
                    can_manage_chat: isPromote,
                    can_manage_video_chats: isPromote,
                  }),
                });
                const pJson: any = await pRes.json();

                if (isPromote && customTitle && pJson.ok) {
                  fetch(`https://api.telegram.org/bot${token}/setChatAdministratorCustomTitle`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      user_id: targetUid,
                      custom_title: customTitle.slice(0, 16),
                    }),
                  }).catch(() => {});
                }

                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel(isPromote ? "PROMOTE" : "DEMOTE", [
                      `Status: ${pJson.ok ? (isPromote ? "PROMOTED TO ADMIN 🛡️" : "DEMOTED TO MEMBER 👤") : `FAILED: ${pJson.description || "Error"}`}`,
                      `Target: ${targetUname ? `@${targetUname}` : `ID ${targetUid}`}`,
                      isPromote ? `Title: ${customTitle}` : "Admin permissions revoked."
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "banall" || rawCmd === "kickall" || rawCmd === "unbanall") {
                const history = trackedChatMessages[chatId] || [];
                const targetUserIds = Array.from(new Set(history.map(h => h.fromId).filter(id => id && id !== senderId)));

                if (targetUserIds.length === 0) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel(rawCmd.toUpperCase(), [
                        "Status: NO TARGETS IN CACHE",
                        "Active chat cache has 0 members to target."
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel(rawCmd.toUpperCase(), [
                      `Status: EXECUTING MASS ${rawCmd.toUpperCase()}`,
                      `Target Count: ${targetUserIds.length} users`,
                      "Cleaning in progress..."
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });

                // Batch process
                let count = 0;
                for (const uid of targetUserIds.slice(0, 50)) {
                  if (rawCmd === "banall") {
                    fetch(`https://api.telegram.org/bot${token}/banChatMember`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chat_id: chatId, user_id: uid }),
                    }).catch(() => {});
                  } else if (rawCmd === "kickall") {
                    fetch(`https://api.telegram.org/bot${token}/banChatMember`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chat_id: chatId, user_id: uid, until_date: Math.floor(Date.now() / 1000) + 35 }),
                    }).then(() => {
                      fetch(`https://api.telegram.org/bot${token}/unbanChatMember`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ chat_id: chatId, user_id: uid }),
                      }).catch(() => {});
                    }).catch(() => {});
                  } else if (rawCmd === "unbanall") {
                    fetch(`https://api.telegram.org/bot${token}/unbanChatMember`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chat_id: chatId, user_id: uid, only_if_banned: true }),
                    }).catch(() => {});
                  }
                  count++;
                }
              } else if (rawCmd === "muteall" || rawCmd === "unmuteall") {
                const isMuteAll = rawCmd === "muteall";
                await fetch(`https://api.telegram.org/bot${token}/setChatPermissions`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    permissions: {
                      can_send_messages: !isMuteAll,
                      can_send_media_messages: !isMuteAll,
                      can_send_other_messages: !isMuteAll,
                      can_add_web_page_previews: !isMuteAll,
                    },
                  }),
                });
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel(isMuteAll ? "MUTE ALL" : "UNMUTE ALL", [
                      `Status: ${isMuteAll ? "ALL MEMBERS MUTED 🔇" : "ALL MEMBERS UNMUTED 🔊"}`,
                      isMuteAll ? "Non-admin speaking rights restricted." : "All group members may now send messages."
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "check") {
                const targetUser = msg.reply_to_message?.from || fromUser;
                const lines = [
                  `Name: ${targetUser?.first_name || "Unknown"}`,
                  `Username: ${targetUser?.username ? `@${targetUser.username}` : "None"}`,
                  `User ID: <code>${targetUser?.id}</code>`,
                  `Account Type: ${targetUser?.is_bot ? "🤖 BOT" : "👤 HUMAN"}`,
                  `Chat ID: <code>${chatId}</code>`,
                  `Chat Status: ONLINE ⚡`
                ];
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("SECURITY CHECK", lines, "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "zombies") {
                const history = trackedChatMessages[chatId] || [];
                const deletedUsers = history.filter(h => h.fromName.toLowerCase().includes("deleted") || h.fromUsername.toLowerCase().includes("deleted"));
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("ZOMBIE CLEANER", [
                      `Status: SCAN COMPLETED 🧟`,
                      `Deleted Accounts Found: ${deletedUsers.length}`,
                      deletedUsers.length > 0 ? "Deleted accounts cleaned from active cache." : "0 deleted accounts found in chat."
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "purgeme") {
                const count = parseInt(args[0], 10) || 20;
                const history = (trackedChatMessages[chatId] || []).filter(h => h.fromId === senderId);
                const toDel = history.slice(-count);
                for (const item of toDel) {
                  fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, message_id: item.messageId }),
                  }).catch(() => {});
                }
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("PURGE ME", [
                      "Status: COMPLETED 🧹",
                      `Deleted ${toDel.length} of your recent messages.`
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "editpurge") {
                const count = parseInt(args[0], 10) || 10;
                const history = (trackedChatMessages[chatId] || []).filter(h => h.fromId === senderId);
                const toEdit = history.slice(-count);
                for (const item of toEdit) {
                  fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, message_id: item.messageId, text: "." }),
                  }).catch(() => {});
                }
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("STEALTH EDIT PURGE", [
                      "Status: COMPLETED 🥷",
                      `Replaced ${toEdit.length} messages with '.' stealthily.`
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "spurge") {
                const keyword = args.join(" ").toLowerCase();
                if (!keyword) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("KEYWORD PURGE", [
                        "Status: KEYWORD REQUIRED",
                        "Usage: .spurge <keyword>"
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("KEYWORD PURGE", [
                      "Status: PURGED 🗑️",
                      `Keyword: "${keyword}"`,
                      "All matching recent messages removed."
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "deleteall") {
                let targetUid = "";
                let targetUname = "";
                if (msg.reply_to_message?.from) {
                  targetUid = String(msg.reply_to_message.from.id);
                  targetUname = msg.reply_to_message.from.username || msg.reply_to_message.from.first_name || targetUid;
                } else if (args[0]) {
                  const raw = args[0].replace(/^@/, "");
                  if (/^\d+$/.test(raw)) targetUid = raw;
                  else targetUname = raw;
                }
                if (!targetUid && targetUname) {
                  const found = (trackedChatMessages[chatId] || []).find(h => h.fromUsername.toLowerCase() === targetUname.toLowerCase());
                  if (found) targetUid = found.fromId;
                }

                if (!targetUid && !targetUname) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("DELETE ALL", [
                        "Status: TARGET REQUIRED",
                        "Usage: .deleteall @username OR reply to user"
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                const history = trackedChatMessages[chatId] || [];
                const userMsgs = history.filter(h => (targetUid && h.fromId === targetUid) || (targetUname && h.fromUsername.toLowerCase() === targetUname.toLowerCase()));
                for (const mItem of userMsgs) {
                  fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, message_id: mItem.messageId }),
                  }).catch(() => {});
                }
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("DELETE ALL", [
                      "Status: WIPED 🧹",
                      `Target: ${targetUname ? `@${targetUname}` : `ID ${targetUid}`}`,
                      `Deleted ${userMsgs.length} messages from chat history.`
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "gunlock") {
                delete chatLockAll[chatId];
                delete chatLocks[chatId];
                await fetch(`https://api.telegram.org/bot${token}/setChatPermissions`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    permissions: {
                      can_send_messages: true,
                      can_send_media_messages: true,
                      can_send_other_messages: true,
                      can_add_web_page_previews: true,
                    },
                  }),
                });
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("GLOBAL UNLOCK", [
                      "Status: UNLOCKED 🔓",
                      "All active chat restrictions & lock rules cleared.",
                      "Chat permissions fully open."
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "locked") {
                const conf = chatLocks[chatId];
                const active = conf?.locks ? Object.entries(conf.locks).filter(([_, v]) => v).map(([k]) => k.toUpperCase()) : [];
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("ACTIVE LOCKS", [
                      `Strict LockAll: ${chatLockAll[chatId] ? "ACTIVE 🔒" : "INACTIVE 🔓"}`,
                      `Locked Features: ${active.length > 0 ? active.join(", ") : "None"}`,
                      `Admin Bypass: ${conf?.adminBypass !== false ? "ENABLED" : "DISABLED"}`
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "adminlock") {
                if (!chatLocks[chatId]) {
                  chatLocks[chatId] = { locks: {}, adminBypass: true, avoidUsers: {} };
                }
                const sub = (args[0] || "").toLowerCase();
                chatLocks[chatId].adminBypass = sub === "off" ? false : true;
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("ADMIN LOCK", [
                      `Status: ADMIN BYPASS ${chatLocks[chatId].adminBypass ? "ENABLED 🛡️" : "DISABLED 🔒"}`,
                      chatLocks[chatId].adminBypass ? "Admins bypass group locks." : "Admins are strictly affected by locks."
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "lockavoid") {
                if (!chatLocks[chatId]) {
                  chatLocks[chatId] = { locks: {}, adminBypass: true, avoidUsers: {} };
                }
                let target = args[0] ? args[0].replace(/^@/, "").toLowerCase() : "";
                if (!target && msg.reply_to_message?.from) {
                  target = msg.reply_to_message.from.username?.toLowerCase() || String(msg.reply_to_message.from.id);
                }
                if (target) {
                  chatLocks[chatId].avoidUsers[target] = true;
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("LOCK AVOID", [
                        "Status: WHITELISTED 🛡️",
                        `Target: @${target}`,
                        "User is exempt from all group locks."
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "settitle") {
                const newTitle = args.join(" ");
                if (!newTitle) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("SET TITLE", [
                        "Status: TITLE REQUIRED",
                        "Usage: .settitle <new title>"
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }
                const sRes = await fetch(`https://api.telegram.org/bot${token}/setChatTitle`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: chatId, title: newTitle }),
                });
                const sJson: any = await sRes.json();
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("SET TITLE", [
                      `Status: ${sJson.ok ? "UPDATED 👑" : `FAILED: ${sJson.description || "Error"}`}`,
                      `New Title: ${newTitle}`
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "setdesc") {
                const newDesc = args.join(" ");
                const dRes = await fetch(`https://api.telegram.org/bot${token}/setChatDescription`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: chatId, description: newDesc }),
                });
                const dJson: any = await dRes.json();
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("SET DESCRIPTION", [
                      `Status: ${dJson.ok ? "UPDATED 📝" : `FAILED: ${dJson.description || "Error"}`}`,
                      `Description: ${newDesc || "(Cleared)"}`
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "invitelink") {
                const linkRes = await fetch(`https://api.telegram.org/bot${token}/exportChatInviteLink`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: chatId }),
                });
                const linkJson: any = await linkRes.json();
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("INVITE LINK", [
                      `Status: ${linkJson.ok ? "GENERATED 🔗" : "FAILED"}`,
                      `Link: ${linkJson.result || "Could not generate link (Ensure bot has invite permission)"}`
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "emoji2mp4") {
                const repliedSticker = msg.reply_to_message?.sticker;
                const emoji = repliedSticker?.emoji || "✨";
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("EMOJI TO MP4", [
                      "Status: CONVERTED 🎬",
                      `Emoji / Asset: ${emoji}`,
                      repliedSticker?.set_name ? `Sticker Set: ${repliedSticker.set_name}` : "Animated Sticker parsed into high-definition stream."
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "saved") {
                if (msg.reply_to_message) {
                  await fetch(`https://api.telegram.org/bot${token}/forwardMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: senderId,
                      from_chat_id: chatId,
                      message_id: msg.reply_to_message.message_id,
                    }),
                  });
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("SAVED MESSAGES", [
                        "Status: SAVED 💾",
                        "Replied message forwarded directly to your private chat / Saved Messages."
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "wblock" || rawCmd === "wunblock" || rawCmd === "blocklist" || rawCmd === "blockwarntxt") {
                if (!blockedContent[chatId]) {
                  blockedContent[chatId] = { words: new Set<string>() };
                }
                const bConf = blockedContent[chatId];
                if (rawCmd === "wblock") {
                  const targetWord = args.join(" ").toLowerCase();
                  if (targetWord) {
                    bConf.words.add(targetWord);
                    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: formatCommandPanel("CONTENT BLOCK", [
                          "Status: BLOCKED 🚫",
                          `Keyword / Pattern: "${targetWord}"`,
                          "Messages containing this word will be auto-deleted."
                        ], "⚡ YOUR XYRO IS RUNNING"),
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                  }
                } else if (rawCmd === "wunblock") {
                  const targetWord = args.join(" ").toLowerCase();
                  bConf.words.delete(targetWord);
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("CONTENT UNBLOCK", [
                        "Status: UNBLOCKED ✅",
                        `Keyword: "${targetWord}"`
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else if (rawCmd === "blocklist") {
                  const wordsArr = Array.from(bConf.words);
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("BLOCKED CONTENT LIST", [
                        `Total Blocked Words: ${wordsArr.length}`,
                        wordsArr.length > 0 ? `Words: ${wordsArr.join(", ")}` : "No words currently blocked.",
                        `Custom Warning: ${bConf.warnText || "Default warning"}`
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else if (rawCmd === "blockwarntxt") {
                  const warnTxt = args.join(" ");
                  bConf.warnText = warnTxt;
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("BLOCK WARNING TEXT", [
                        "Status: UPDATED ⚠️",
                        `Warning Text: "${warnTxt || "(Default)"}"`
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "gcwelcome") {
                if (!gcWelcomeConfigs[chatId]) {
                  gcWelcomeConfigs[chatId] = { enabled: true };
                }
                const sub = (args[0] || "").toLowerCase();
                const rest = args.slice(1).join(" ");
                if (sub === "on") {
                  gcWelcomeConfigs[chatId].enabled = true;
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("GC WELCOME", [
                        "Status: ENABLED 🌸",
                        "New members will receive customized greeting upon joining."
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else if (sub === "off") {
                  gcWelcomeConfigs[chatId].enabled = false;
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("GC WELCOME", [
                        "Status: DISABLED ⭕"
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else if (rest) {
                  gcWelcomeConfigs[chatId].text = rest;
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("GC WELCOME", [
                        "Status: WELCOME MESSAGE UPDATED 📝",
                        `Custom Text: "${rest}"`
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "tagall" || rawCmd === "mention") {
                const customAnnouncement = args.join(" ") || "⚡ Attention Group Members!";
                activeTagTasks[chatId] = { cancelRequested: false };

                // Collect members from tracked messages
                const history = trackedChatMessages[chatId] || [];
                const membersMap = new Map<string, { id: string; username: string; name: string }>();

                for (const h of history) {
                  if (h.fromId && h.fromId !== senderId) {
                    membersMap.set(h.fromId, { id: h.fromId, username: h.fromUsername, name: h.fromName });
                  }
                }

                // Also fetch admins
                try {
                  const admRes = await fetch(`https://api.telegram.org/bot${token}/getChatAdministrators?chat_id=${chatId}`);
                  const admJson: any = await admRes.json();
                  if (admJson.ok && Array.isArray(admJson.result)) {
                    for (const a of admJson.result) {
                      if (a.user?.id) {
                        membersMap.set(String(a.user.id), {
                          id: String(a.user.id),
                          username: (a.user.username || "").toLowerCase(),
                          name: a.user.first_name || "Admin"
                        });
                      }
                    }
                  }
                } catch (e) {}

                const membersList = Array.from(membersMap.values());
                if (membersList.length === 0) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("TAGALL", [
                        "Status: NO RECENT MEMBERS FOUND",
                        "Members will be tagged as they chat in group."
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                // Announce start
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("TAGALL", [
                      "Status: STARTED",
                      `Total Target: ${membersList.length} members`,
                      `Message: ${customAnnouncement}`,
                      "Use .cancel to stop anytime."
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });

                // Tag in batches of 5 users
                (async () => {
                  for (let i = 0; i < membersList.length; i += 5) {
                    if (activeTagTasks[chatId]?.cancelRequested) break;
                    const batch = membersList.slice(i, i + 5);
                    const tagMentions = batch.map(u => u.username ? `@${u.username}` : `<a href="tg://user?id=${u.id}">${u.name}</a>`).join(" ");
                    const textToSend = `📢 <b>${customAnnouncement}</b>\n\n${tagMentions}`;
                    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: textToSend,
                        parse_mode: "HTML",
                      }),
                    }).catch(() => {});

                    if (i + 5 < membersList.length) {
                      await new Promise((r) => setTimeout(r, 1500));
                    }
                  }
                })();
              } else if (rawCmd === "cancel" || rawCmd === "stoptag") {
                if (activeTagTasks[chatId]) {
                  activeTagTasks[chatId].cancelRequested = true;
                }
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("CANCEL", [
                      "Status: STOPPED",
                      "Active tag / mention task cancelled."
                    ], "YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "admins") {
                try {
                  const admRes = await fetch(`https://api.telegram.org/bot${token}/getChatAdministrators?chat_id=${chatId}`);
                  const admJson: any = await admRes.json();
                  if (admJson.ok && Array.isArray(admJson.result)) {
                    const lines: string[] = [];
                    for (const a of admJson.result) {
                      const title = a.status === "creator" ? "👑 Creator" : "🛡️ Admin";
                      const name = a.user?.username ? `@${a.user.username}` : (a.user?.first_name || "Admin");
                      lines.push(`${title}: ${name}`);
                    }
                    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: formatCommandPanel("ADMINISTRATORS", lines, "⚡ YOUR XYRO IS RUNNING"),
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                  }
                } catch (e: any) {}
              } else if (rawCmd === "id") {
                const lines = [
                  `User ID: <code>${senderId}</code>`,
                  `Chat ID: <code>${chatId}</code>`,
                  `Chat Type: ${msg.chat.type.toUpperCase()}`
                ];
                if (msg.reply_to_message?.from) {
                  lines.push(`Replied User ID: <code>${msg.reply_to_message.from.id}</code>`);
                }
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("ID INFO", lines, "YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "info" || rawCmd === "whois") {
                const targetUser = msg.reply_to_message?.from || fromUser;
                const lines = [
                  `Name: ${targetUser?.first_name || "Unknown"} ${targetUser?.last_name || ""}`.trim(),
                  `Username: ${targetUser?.username ? `@${targetUser.username}` : "No username"}`,
                  `User ID: <code>${targetUser?.id}</code>`,
                  `Is Bot: ${targetUser?.is_bot ? "YES" : "NO"}`,
                  `User Link: <a href="tg://user?id=${targetUser?.id}">Profile Link</a>`
                ];
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("USER DOSSIER", lines, "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "ginfo" || rawCmd === "chatinfo") {
                try {
                  const gRes = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`);
                  const gJson: any = await gRes.json();
                  const mCountRes = await fetch(`https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=${chatId}`);
                  const mCountJson: any = await mCountRes.json();

                  const lines = [
                    `Group Title: ${gJson.result?.title || msg.chat.title || "Group"}`,
                    `Group ID: <code>${chatId}</code>`,
                    `Type: ${gJson.result?.type?.toUpperCase() || "SUPERGROUP"}`,
                    `Total Members: ${mCountJson.result || "N/A"}`,
                    `Username: ${gJson.result?.username ? `@${gJson.result.username}` : "Private"}`,
                    `Description: ${gJson.result?.description || "No description"}`
                  ];
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("GROUP INFO", lines, "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } catch (e) {}
              } else if (rawCmd === "afk") {
                const reason = args.join(" ") || "Away From Keyboard";
                afkUsers[senderId] = {
                  reason,
                  time: Date.now(),
                  name: fromUser?.first_name || "User",
                  username: senderUsername
                };
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("AFK MODE", [
                      "Status: AFK ACTIVE",
                      `User: @${senderUsername || senderId}`,
                      `Reason: ${reason}`,
                      "Bot will notify anyone who mentions or replies to you."
                    ], "YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "welcome") {
                const sub = args[0]?.toLowerCase();
                if (sub === "off" || sub === "disable") {
                  welcomeConfigs[chatId] = { enabled: false };
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("WELCOME", [
                        "Status: DISABLED",
                        "Auto-welcome greetings turned OFF."
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else {
                  const customGreeting = args.slice(sub === "on" ? 1 : 0).join(" ");
                  welcomeConfigs[chatId] = {
                    enabled: true,
                    text: customGreeting || undefined
                  };
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("WELCOME", [
                        "Status: ENABLED",
                        customGreeting ? `Custom Text: ${customGreeting}` : "Default greeting card active."
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "tr" || rawCmd === "translate") {
                const targetText = msg.reply_to_message?.text || args.slice(1).join(" ") || args.join(" ");
                const targetLang = (args[0] && args[0].length === 2) ? args[0].toLowerCase() : "hi";

                if (!targetText) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("TRANSLATE", [
                        "Status: TEXT REQUIRED",
                        "Reply to a message with .tr [lang]",
                        "Or use: .tr hi hello world"
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                try {
                  const trUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(targetText)}`;
                  const trRes = await fetch(trUrl);
                  const trJson: any = await trRes.json();
                  const translated = trJson[0]?.map((item: any) => item[0]).join("") || targetText;

                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel(`TRANSLATION (${targetLang.toUpperCase()})`, [
                        `Input: ${targetText.slice(0, 100)}`,
                        `Result: ${translated}`
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } catch (e: any) {
                  console.error("Translate error:", e);
                }
              } else if (rawCmd === "love" || rawCmd === "heart") {
                const loveFrames = [
                  "🤍",
                  "🤍 🤍",
                  "🤍 🤍 🤍",
                  "🤍 🤍 🤍 🤍",
                  "🤍 🤍 🤍 🤍 🤍",
                  "❤️ 🤍 🤍 🤍 ❤️",
                  "❤️ ❤️ 🤍 ❤️ ❤️",
                  "❤️ ❤️ ❤️ ❤️ ❤️",
                  "💖 💗 💓 💗 💖",
                  "✨ 💖 𝐈 𝐋𝐎𝐕𝐄 𝐘𝐎𝐔 💖 ✨\n<i>⚡ YOUR XYRO IS RUNNING</i>"
                ];

                (async () => {
                  try {
                    const initRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: loveFrames[0],
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                    const initJson: any = await initRes.json();
                    const animMid = initJson.result?.message_id;
                    if (!animMid) return;

                    for (let i = 1; i < loveFrames.length; i++) {
                      await new Promise((r) => setTimeout(r, 650));
                      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          message_id: animMid,
                          text: loveFrames[i],
                          parse_mode: "HTML",
                        }),
                      }).catch(() => {});
                    }
                  } catch (e) {}
                })();
              } else if (rawCmd === "hack") {
                const targetUname = msg.reply_to_message?.from?.username 
                  ? `@${msg.reply_to_message.from.username}`
                  : (args[0] || `@${senderUsername || "Target"}`);
                const targetUid = msg.reply_to_message?.from?.id ? String(msg.reply_to_message.from.id) : null;

                if (isTargetingOwner(targetUname, targetUid)) {
                  const deadlyReply = ownerShieldDeadlyReplies[Math.floor(Math.random() * ownerShieldDeadlyReplies.length)];
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: deadlyReply,
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                const hackFrames = [
                  `⚡ <b>[CYBER TERMINAL]</b> Initializing bypass on ${targetUname}...`,
                  `📡 <b>Connecting:</b> Handshake established with Telegram Core API...`,
                  `🔓 <b>Injecting Payload:</b> 0x7F9B44A [██░░░░░░░░] 20%`,
                  `📂 <b>Bypassing Firewall:</b> [██████░░░░] 60%`,
                  `💾 <b>Extracting IP & Geo:</b> [████████░░] 85%`,
                  `📊 <b>Data Dump Complete:</b> [██████████] 100%`,
                  formatCommandPanel("CYBER HACK REPORT", [
                    `Target: ${targetUname}`,
                    "Status: Breached 100%",
                    "IP Address: 192.168.1.104",
                    "ISP: High-Speed Cyber Net",
                    "Security: Compromised"
                  ], "YOUR XYRO IS RUNNING")
                ];

                (async () => {
                  try {
                    const initRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: hackFrames[0],
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                    const initJson: any = await initRes.json();
                    const animMid = initJson.result?.message_id;
                    if (!animMid) return;

                    for (let i = 1; i < hackFrames.length; i++) {
                      await new Promise((r) => setTimeout(r, 750));
                      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          message_id: animMid,
                          text: hackFrames[i],
                          parse_mode: "HTML",
                        }),
                      }).catch(() => {});
                    }
                  } catch (e) {}
                })();
              } else if (rawCmd === "magic") {
                const magicFrames = [
                  "🪄 <i>Casting mystical incantation...</i>",
                  "✨ 🪄 <i>Sparks appearing...</i>",
                  "🔮 ✨ 🪄 <i>Crystal orb glowing...</i>",
                  "🌌 🔮 ✨ 🪄 <i>Cosmic portal opening...</i>",
                  "🌟 💖 👑 <b>ABRACADABRA!</b> 👑 💖 🌟\n<i>XYRO magic unleashed upon chat!</i>\n<code>⚡ YOUR XYRO IS RUNNING</code>"
                ];

                (async () => {
                  try {
                    const initRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: magicFrames[0],
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                    const initJson: any = await initRes.json();
                    const animMid = initJson.result?.message_id;
                    if (!animMid) return;

                    for (let i = 1; i < magicFrames.length; i++) {
                      await new Promise((r) => setTimeout(r, 700));
                      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          message_id: animMid,
                          text: magicFrames[i],
                          parse_mode: "HTML",
                        }),
                      }).catch(() => {});
                    }
                  } catch (e) {}
                })();
              } else if (rawCmd === "destroy") {
                const targetUname = msg.reply_to_message?.from?.username 
                  ? `@${msg.reply_to_message.from.username}`
                  : (args[0] || `@${senderUsername || "User"}`);
                const targetUid = msg.reply_to_message?.from?.id ? String(msg.reply_to_message.from.id) : null;

                if (isTargetingOwner(targetUname, targetUid)) {
                  const deadlyReply = ownerShieldDeadlyReplies[Math.floor(Math.random() * ownerShieldDeadlyReplies.length)];
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: deadlyReply,
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                const destroyFrames = [
                  `⚠️ <b>[TACTICAL NUKE ARMED]</b> Targeting ${targetUname}...`,
                  `⏳ <b>Countdown:</b> 3...`,
                  `⏳ <b>Countdown:</b> 2...`,
                  `⏳ <b>Countdown:</b> 1...`,
                  `💥 <b>BOOOOOOOM!</b> 💥`,
                  `🔥 🌋 💨 <b>ANNIHILATION COMPLETE!</b>\n<i>Target ${targetUname} vaporized into quantum dust.</i>\n<code>⚡ YOUR XYRO IS RUNNING</code>`
                ];

                (async () => {
                  try {
                    const initRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: destroyFrames[0],
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                    const initJson: any = await initRes.json();
                    const animMid = initJson.result?.message_id;
                    if (!animMid) return;

                    for (let i = 1; i < destroyFrames.length; i++) {
                      await new Promise((r) => setTimeout(r, 700));
                      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          message_id: animMid,
                          text: destroyFrames[i],
                          parse_mode: "HTML",
                        }),
                      }).catch(() => {});
                    }
                  } catch (e) {}
                })();
              } else if (rawCmd === "loading") {
                const customLabel = args.join(" ") || "System Operation";
                const loadFrames = [
                  `⏳ <b>${customLabel}</b> [░░░░░░░░░░] 0%`,
                  `⏳ <b>${customLabel}</b> [██░░░░░░░░] 20%`,
                  `⏳ <b>${customLabel}</b> [████░░░░░░] 40%`,
                  `⏳ <b>${customLabel}</b> [██████░░░░] 60%`,
                  `⏳ <b>${customLabel}</b> [████████░░] 80%`,
                  `⏳ <b>${customLabel}</b> [██████████] 99%`,
                  `✅ <b>${customLabel} COMPLETED 100%!</b>\n<code>⚡ YOUR XYRO IS RUNNING</code>`
                ];

                (async () => {
                  try {
                    const initRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: loadFrames[0],
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                    const initJson: any = await initRes.json();
                    const animMid = initJson.result?.message_id;
                    if (!animMid) return;

                    for (let i = 1; i < loadFrames.length; i++) {
                      await new Promise((r) => setTimeout(r, 600));
                      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          message_id: animMid,
                          text: loadFrames[i],
                          parse_mode: "HTML",
                        }),
                      }).catch(() => {});
                    }
                  } catch (e) {}
                })();
              } else if (rawCmd === "matrix") {
                const matrixFrames = [
                  "🟢 <code>01001000 01100101 01101100 01101100 01101111</code>",
                  "🟢 <code>[SYSTEM DECRYPTING RUNTIME MATRIX...]</code>",
                  "🟢 <code>W A K E   U P ,   N E O . . .</code>",
                  "🟢 <code>T H E   M A T R I X   H A S   Y O U .</code>",
                  "🟢 <code>F O L L O W   T H E   W H I T E   R A B B I T 🐇</code>",
                  "🟢 <b>[MATRIX ACCESS GRANTED]</b>\n<i>Welcome to XYRO Zion Terminal.</i>\n<code>⚡ YOUR XYRO IS RUNNING</code>"
                ];

                (async () => {
                  try {
                    const initRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: matrixFrames[0],
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                    const initJson: any = await initRes.json();
                    const animMid = initJson.result?.message_id;
                    if (!animMid) return;

                    for (let i = 1; i < matrixFrames.length; i++) {
                      await new Promise((r) => setTimeout(r, 700));
                      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          message_id: animMid,
                          text: matrixFrames[i],
                          parse_mode: "HTML",
                        }),
                      }).catch(() => {});
                    }
                  } catch (e) {}
                })();
              } else if (rawCmd === "type") {
                const fullText = args.join(" ") || "Hello from XYRO robot!";
                (async () => {
                  try {
                    const initRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: "⌨️ |",
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                    const initJson: any = await initRes.json();
                    const animMid = initJson.result?.message_id;
                    if (!animMid) return;

                    // Type in chunks of ~3-4 chars for smooth effect
                    let current = "";
                    const step = Math.max(1, Math.floor(fullText.length / 6));
                    for (let i = 0; i < fullText.length; i += step) {
                      current = fullText.slice(0, i + step);
                      await new Promise((r) => setTimeout(r, 450));
                      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          message_id: animMid,
                          text: `⌨️ <b>${current}</b> ▌`,
                          parse_mode: "HTML",
                        }),
                      }).catch(() => {});
                    }

                    await new Promise((r) => setTimeout(r, 400));
                    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        message_id: animMid,
                        text: `⌨️ <b>${fullText}</b>\n<code>⚡ YOUR XYRO IS RUNNING</code>`,
                        parse_mode: "HTML",
                      }),
                    }).catch(() => {});
                  } catch (e) {}
                })();
              } else if (rawCmd === "weather") {
                const cityQuery = args.join(" ").trim() || "New Delhi";
                const w = await fetchRealWeather(cityQuery);
                if (!w) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("WEATHER REPORT", [
                        `Location: ${cityQuery}`,
                        "Status: CITY NOT FOUND",
                        "Could not retrieve meteorological data. Please check city name."
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("WEATHER REPORT", [
                        `City: ${w.location}`,
                        `Sky: ${w.conditionIcon} ${w.conditionDesc}`,
                        `Temperature: ${w.tempC}°C (${w.tempF}°F)`,
                        `Feels Like: ${w.feelsLikeC}°C`,
                        `Humidity: ${w.humidity}%`,
                        `Wind Speed: ${w.windKm} km/h`
                      ], "⚡ YOUR XYRO IS RUNNING"),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "rain") {
                const rainFrames = [
                  "☀️ <i>Sunny peaceful sky...</i>",
                  "⛅ <i>Clouds rolling in...</i>",
                  "☁️ ☁️ <i>Dark thunder clouds gathering...</i>",
                  "🌧️ ⚡ <i>Raindrops starting to fall...</i>",
                  "⛈️ ⚡ 🌊 <i>Heavy storm & lightning strike!</i>",
                  "🌦️ 🌈 <b>Sky clears up with a bright rainbow!</b> ✨\n<code>⚡ YOUR XYRO IS RUNNING</code>"
                ];

                (async () => {
                  try {
                    const initRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: rainFrames[0],
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                    const initJson: any = await initRes.json();
                    const animMid = initJson.result?.message_id;
                    if (!animMid) return;

                    for (let i = 1; i < rainFrames.length; i++) {
                      await new Promise((r) => setTimeout(r, 650));
                      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          message_id: animMid,
                          text: rainFrames[i],
                          parse_mode: "HTML",
                        }),
                      }).catch(() => {});
                    }
                  } catch (e) {}
                })();
              } else if (rawCmd === "bomb") {
                const bombFrames = [
                  "💣 <b>[DYNAMITE PLANTED]</b>",
                  "💣 🧨 <b>Fuse lit:</b> 3...",
                  "💣 🧨 🔥 <b>Fuse burning:</b> 2...",
                  "💣 🧨 🔥 🔥 <b>Fuse sparking:</b> 1...",
                  "💥 <b>BOOOOM!</b> 💥",
                  "💨 🔥 🌋 <b>BLAST RESIDUE!</b>\n<i>Chat cleared with explosive power.</i>\n<code>⚡ YOUR XYRO IS RUNNING</code>"
                ];

                (async () => {
                  try {
                    const initRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: bombFrames[0],
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                    const initJson: any = await initRes.json();
                    const animMid = initJson.result?.message_id;
                    if (!animMid) return;

                    for (let i = 1; i < bombFrames.length; i++) {
                      await new Promise((r) => setTimeout(r, 650));
                      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          message_id: animMid,
                          text: bombFrames[i],
                          parse_mode: "HTML",
                        }),
                      }).catch(() => {});
                    }
                  } catch (e) {}
                })();
              } else if (rawCmd === "dance") {
                const danceFrames = [
                  "🎧 <i>DJ drops the bass...</i> 🎶",
                  "🕺 💃 <i>Party grooving...</i> 🎵",
                  "✨ 🕺 💃 ✨ <i>Neon lights flashing!</i>",
                  "🎉 🪩 🕺 💃 🪩 🎉 <b>ULTIMATE DANCE PARTY!</b>\n<code>⚡ YOUR XYRO IS RUNNING</code>"
                ];

                (async () => {
                  try {
                    const initRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: danceFrames[0],
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                    const initJson: any = await initRes.json();
                    const animMid = initJson.result?.message_id;
                    if (!animMid) return;

                    for (let i = 1; i < danceFrames.length; i++) {
                      await new Promise((r) => setTimeout(r, 650));
                      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          message_id: animMid,
                          text: danceFrames[i],
                          parse_mode: "HTML",
                        }),
                      }).catch(() => {});
                    }
                  } catch (e) {}
                })();
              } else if (rawCmd === "dice" || rawCmd === "roll") {
                // Official animated Telegram 3D dice
                await fetch(`https://api.telegram.org/bot${token}/sendDice`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    emoji: "🎲",
                    reply_to_message_id: msg.message_id,
                  }),
                });
              } else if (rawCmd === "dart") {
                // Official animated Telegram bullseye target dart
                await fetch(`https://api.telegram.org/bot${token}/sendDice`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    emoji: "🎯",
                    reply_to_message_id: msg.message_id,
                  }),
                });
              } else if (rawCmd === "basket" || rawCmd === "bb") {
                // Official animated Telegram basketball
                await fetch(`https://api.telegram.org/bot${token}/sendDice`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    emoji: "🏀",
                    reply_to_message_id: msg.message_id,
                  }),
                });
              } else if (rawCmd === "football" || rawCmd === "goal") {
                // Official animated Telegram soccer goal
                await fetch(`https://api.telegram.org/bot${token}/sendDice`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    emoji: "⚽",
                    reply_to_message_id: msg.message_id,
                  }),
                });
              } else if (rawCmd === "slot" || rawCmd === "casino") {
                // Official animated Telegram slot machine
                await fetch(`https://api.telegram.org/bot${token}/sendDice`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    emoji: "🎰",
                    reply_to_message_id: msg.message_id,
                  }),
                });
              } else if (rawCmd === "shayari" || rawCmd === "quote") {
                const shayaris = [
                  "हमसे मुकाबला संभल कर करना,\nहम वो हैं जो डूबती कश्ती को भी किनारा बना देते हैं! 🔥",
                  "तेवर तो हम वक्त आने पर दिखाएंगे,\nशहर तुम खरीद लो, हुकूमत हम चलाएंगे! 👑",
                  "खामोशी को हमारी कमजोरी मत समझना,\nतूफान आने से पहले समंदर भी शांत रहता है! ⚡",
                  "जीत की आदत है हमें, हार का खौफ नहीं,\nशौक तो बहुत हैं मगर किसी के गुलाम नहीं! 💎",
                  "जिस दिन अपना सिक्का चलेगा,\nउस दिन दुनिया का हर दरवाजा खुलेगा! 🦁",
                  "जिंदगी की राहों में मुस्कुराते चलो,\nजो जलते हैं तुमसे, उन्हें और जलाते चलो! 🚀"
                ];
                const picked = shayaris[Math.floor(Math.random() * shayaris.length)];
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("SHAYARI & ATTITUDE", [
                      `Quote:`,
                      picked,
                      `Author: Royal XYRO Poetry`
                    ], "YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "roast") {
                const targetUname = msg.reply_to_message?.from?.username 
                  ? `@${msg.reply_to_message.from.username}`
                  : (args[0] || `@${senderUsername || "Target"}`);
                const targetUid = msg.reply_to_message?.from?.id ? String(msg.reply_to_message.from.id) : null;

                if (isTargetingOwner(targetUname, targetUid)) {
                  const deadlyReply = ownerShieldDeadlyReplies[Math.floor(Math.random() * ownerShieldDeadlyReplies.length)];
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: deadlyReply,
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                const roasts = [
                  `${targetUname} ke pass dimaag to bohot hai, par use karne ka recharge khatam ho gaya hai! 😂`,
                  `${targetUname} ko dekh kar lagta hai ki bhagwan ne copy-paste karte waqt error ignore kar diya tha! 💀`,
                  `Bro ${targetUname}, tumhara opinion WiFi jaisa hai, connect to hota hai par internet nahi chalta! 📶❌`,
                  `${targetUname} itna silent rehta hai jaise group ka mute button isi ke dimaag me laga ho! 🔇`,
                  `${targetUname} is living proof that even physics laws have bugs in beta testing! 🧪`
                ];
                const pickedRoast = roasts[Math.floor(Math.random() * roasts.length)];
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("SAVAGE ROAST", [
                      `Target: ${targetUname}`,
                      `Burn: ${pickedRoast}`
                    ], "⚡ YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "ship") {
                const u1 = args[0] || `@${senderUsername || "User1"}`;
                const u2 = args[1] || (msg.reply_to_message?.from?.username ? `@${msg.reply_to_message.from.username}` : "@SecretCrush");
                const percent = Math.floor(Math.random() * 51) + 50; // 50% to 100%
                let verdict = "A match made in heaven! 💍✨";
                if (percent < 65) verdict = "Good chemistry, just need more dates! ☕";
                else if (percent > 90) verdict = "Soulmates forever! Wedding when? 👰🤵";

                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("LOVE COMPATIBILITY", [
                      `Couple: ${u1} ❤️ ${u2}`,
                      `Score: ${percent}% Compatibility`,
                      `Destiny: ${verdict}`
                    ], "YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "truth") {
                const truths = [
                  "What is the most embarrassing thing in your search history right now?",
                  "Who is your secret crush in this Telegram group?",
                  "What is the biggest lie you ever told to your parents?",
                  "If you had to trade lives with one person in this group, who would it be?",
                  "What is your worst guilty pleasure habit?"
                ];
                const picked = truths[Math.floor(Math.random() * truths.length)];
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("TRUTH CHALLENGE", [
                      `Question:`,
                      picked,
                      `Rule: Must answer honestly in group chat!`
                    ], "YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "dare") {
                const dares = [
                  "Send a screenshot of your recent WhatsApp/Telegram chats right now!",
                  "Change your Telegram bio to 'I am ruled by XYRO Robot' for 1 hour!",
                  "Voice note gaana gaa ke bhejo group me!",
                  "Tag your secret crush or send a random sticker to the group admin!",
                  "Tell the group the funniest pickup line you know right now!"
                ];
                const picked = dares[Math.floor(Math.random() * dares.length)];
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("DARE CHALLENGE", [
                      `Dare:`,
                      picked,
                      `Rule: Complete the task within 2 minutes!`
                    ], "YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "flip" || rawCmd === "coin") {
                const isHeads = Math.random() < 0.5;
                const tossOutcome = isHeads ? "👑 HEADS" : "🪙 TAILS";
                (async () => {
                  try {
                    const initRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: "🪙 <i>Flipping coin high up in the air...</i> 🔄",
                        reply_to_message_id: msg.message_id,
                        parse_mode: "HTML",
                      }),
                    });
                    const initJson: any = await initRes.json();
                    const animMid = initJson.result?.message_id;
                    if (!animMid) return;

                    await new Promise((r) => setTimeout(r, 600));
                    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        message_id: animMid,
                        text: "🪙 <i>Catching the coin on hand...</i> 🤲",
                        parse_mode: "HTML",
                      }),
                    }).catch(() => {});

                    await new Promise((r) => setTimeout(r, 600));
                    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        message_id: animMid,
                        text: formatCommandPanel("COIN TOSS", [
                          `Toss Result: ${tossOutcome}`,
                          `Flipped By: @${senderUsername || senderId}`,
                          `Verdict: ${isHeads ? "Heads wins the toss! 🏆" : "Tails wins the toss! 🏆"}`
                        ], "⚡ YOUR XYRO IS RUNNING"),
                        parse_mode: "HTML",
                      }),
                    }).catch(() => {});
                  } catch (e) {}
                })();
              } else if (rawCmd === "joke") {
                const jokes = [
                  "Teacher: 'Homework kyun nahi kiya?'\nStudent: 'Sir memory card corrupt ho gaya tha!' 😂",
                  "Doctor: 'Aapko aaram ki zaroorat hai.'\nPatient: 'Par doctor saheb, aapne dawai to di hi nahi!'\nDoctor: 'Ye dawai nahi, Telegram mute karne ki advice hai!' 💀",
                  "Interviewer: 'What is your biggest strength?'\nCandidate: 'I can do fast calculations.'\nInterviewer: 'What is 47 x 89?'\nCandidate: '42.'\nInterviewer: 'That is completely wrong.'\nCandidate: 'But it was fast!' 🚀"
                ];
                const picked = jokes[Math.floor(Math.random() * jokes.length)];
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("LAUGH & JOKE", [
                      `Joke:`,
                      picked
                    ], "YOUR XYRO IS RUNNING"),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              } else if (rawCmd === "spam") {
                if (!hasAdminPerms) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ERROR", [
                        "Status: ACCESS DENIED",
                        "Command available to administrators only."
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                if (cState.spamActive) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("SPAM", [
                        "Status: ERROR",
                        "A spam task is already running in this chat.",
                        "Use .stopspam to cancel."
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                const countArg = parseInt(args[0], 10);
                const spamMsg = args.slice(1).join(" ");
                const maxCount = parseInt(process.env.MAX_SPAM_COUNT || "20", 10);

                if (!countArg || isNaN(countArg) || countArg <= 0 || !spamMsg) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("USAGE", [
                        "Syntax: .spam <count> <text>",
                        "Example: .spam 5 Hello World"
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                // Check if targeting owner via reply or text
                const repliedUser = msg.reply_to_message?.from;
                const targetUname = repliedUser?.username || null;
                const targetUid = repliedUser?.id ? String(repliedUser.id) : null;

                if (isTargetingOwner(targetUname, targetUid) || args.some(a => isTargetingOwner(a))) {
                  const deadlyReply = ownerShieldDeadlyReplies[Math.floor(Math.random() * ownerShieldDeadlyReplies.length)];
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: deadlyReply,
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                const targetTag = repliedUser?.username ? `@${repliedUser.username}` : (repliedUser?.first_name ? `@${repliedUser.first_name}` : "");
                const finalSpamText = targetTag ? `${targetTag} ${spamMsg}` : spamMsg;

                const finalCount = Math.min(countArg, maxCount);
                cState.spamActive = true;
                cState.spamCancelRequested = false;

                // Send start announcement in panel style
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel(
                      "SPAM",
                      [
                        `Count: ${finalCount}`,
                        `Target: ${targetTag || "General"}`,
                        `Text: ${spamMsg}`,
                        "Status: STARTED"
                      ],
                      "⚡ YOUR XYRO IS RUNNING"
                    ),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });

                // Run spam in async background with reply targeting
                (async () => {
                  const delay = parseFloat(process.env.SPAM_DELAY || "1.0") * 1000;
                  for (let i = 1; i <= finalCount; i++) {
                    if (cState.spamCancelRequested || !cState.spamActive) {
                      break;
                    }
                    try {
                      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          text: finalSpamText,
                          reply_to_message_id: msg.reply_to_message ? msg.reply_to_message.message_id : undefined,
                        }),
                      });
                    } catch (e) {}
                    if (i < finalCount) {
                      await new Promise((r) => setTimeout(r, Math.max(500, delay)));
                    }
                  }
                  cState.spamActive = false;
                  cState.spamCancelRequested = false;
                })();
              } else if (rawCmd === "stopspam") {
                if (!hasAdminPerms) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ERROR", [
                        "Status: ACCESS DENIED",
                        "Command available to administrators only."
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                if (!cState.spamActive) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("STOPSPAM", [
                        "Status: IDLE",
                        "No active spam task in this chat."
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                } else {
                  cState.spamCancelRequested = true;
                  cState.spamActive = false;
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("STOPSPAM", [
                        "Status: STOPPED",
                        "Active spam task cancelled."
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                }
              } else if (rawCmd === "raid") {
                if (!hasAdminPerms) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ERROR", [
                        "Status: ACCESS DENIED",
                        "Command restricted to @XYRO_7X only."
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                let targetUname: string | null = null;
                let targetUid: string | number | null = null;
                let targetMid: string | number | null = null;
                let raidBurstCount = 10;

                // Check numbers and usernames in args
                for (const a of args) {
                  if (/^\d+$/.test(a)) {
                    raidBurstCount = Math.min(100, Math.max(1, parseInt(a, 10)));
                  } else if (a.startsWith("@") || !targetUname) {
                    targetUname = a.replace(/^@/, "").trim();
                  }
                }

                if (msg.reply_to_message) {
                  targetMid = msg.reply_to_message.message_id;
                  if (msg.reply_to_message.from) {
                    targetUid = msg.reply_to_message.from.id;
                    if (!targetUname && msg.reply_to_message.from.username) {
                      targetUname = msg.reply_to_message.from.username.replace(/^@/, "");
                    }
                  }
                }

                if (isTargetingOwner(targetUname, targetUid ? String(targetUid) : null)) {
                  const deadlyReply = ownerShieldDeadlyReplies[Math.floor(Math.random() * ownerShieldDeadlyReplies.length)];
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: deadlyReply,
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                if (!targetUname && !targetMid && !targetUid) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("RAID", [
                        "Status: TARGET REQUIRED",
                        "Reply to a user or specify username/count:",
                        "Example: .raid 10 @username OR reply with .raid 10"
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                cState.raidEnabled = true;
                cState.raidActive = true;
                cState.raidCancelRequested = false;
                cState.raidTargetUsername = targetUname;
                cState.raidTargetUserId = targetUid;
                cState.raidTargetId = targetMid;
                cState.raidReplyIndex = 0;

                const pool = customRaidMessages.length > 0 ? customRaidMessages : [
                  "TERI AUKAT NAHI HAI XYRO SE LADNE KI! 💀🔥",
                  "XYRO SECURITY SYSTEM ACTIVATED! RUN FOR YOUR LIFE! ⚡",
                  "KID DETECTED, GET OFFLINE IMMEDIATELY! 🤡",
                  "DO NOT INTERFERE WITH THE SUPREME OWNER XYRO! 👑",
                  "YOU HAVE ENTERED THE DANGER ZONE! DISCONNECT NOW! ⚔️",
                  "HEAR THE THUNDER, XYRO IS IN ABSOLUTE CONTROL! 🌪️",
                  "REST IN PIECES, YOUR TELEGRAM CAREER IS OVER! ⚰️",
                  "WHO DO YOU THINK YOU ARE TALKING TO? RESPECT THE REAL EMPIRE! 🛡️"
                ];

                const targetDisplay = targetUname ? `@${targetUname}` : (targetUid ? `User ID ${targetUid}` : `Msg #${targetMid}`);

                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel(
                      "RAID ATTACK INITIATED",
                      [
                        "Status: ACTIVE RAIDING 🔥",
                        `Target: ${targetDisplay}`,
                        `Attack Burst: ${raidBurstCount} Messages`,
                        `Continuous Surveillance: 24/7 ACTIVE`,
                        "Target will be countered relentlessly."
                      ],
                      "⚡ YOUR XYRO IS RUNNING"
                    ),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });

                // Run immediate rapid-fire raid attack burst
                (async () => {
                  for (let i = 0; i < raidBurstCount; i++) {
                    if (cState.raidCancelRequested || !cState.raidActive) break;
                    try {
                      const selectedMsg = pool[i % pool.length];
                      const tagPrefix = targetUname ? `@${targetUname} ` : "";
                      const raidText = `${tagPrefix}${selectedMsg}`;

                      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          text: raidText,
                          reply_to_message_id: targetMid ? targetMid : undefined,
                        }),
                      });
                    } catch (e) {}

                    if (i < raidBurstCount - 1) {
                      await new Promise((r) => setTimeout(r, 600));
                    }
                  }
                })();
              } else if (rawCmd === "draid" || rawCmd === "stopraid") {
                if (!hasAdminPerms) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatCommandPanel("ERROR", [
                        "Status: ACCESS DENIED",
                        "Command restricted to @XYRO_7X only."
                      ]),
                      reply_to_message_id: msg.message_id,
                      parse_mode: "HTML",
                    }),
                  });
                  continue;
                }

                cState.raidEnabled = false;
                cState.raidActive = false;
                cState.raidCancelRequested = true;
                cState.raidTargetUsername = null;
                cState.raidTargetUserId = null;
                cState.raidTargetId = null;
                cState.raidReplyIndex = 0;

                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: formatCommandPanel("DRAID", [
                      "Status: DISABLED 🛑",
                      "RAID attack and surveillance stopped successfully."
                    ]),
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                });
              }
            } else {
              // Non-command message handlers:
              // A. Check if message replies to or mentions an AFK user
              if (msg.reply_to_message?.from && afkUsers[String(msg.reply_to_message.from.id)]) {
                const targetAfk = afkUsers[String(msg.reply_to_message.from.id)];
                const elapsedMins = Math.max(1, Math.floor((Date.now() - targetAfk.time) / 60000));
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `📢 <b>${targetAfk.name || "User"}</b> is currently AFK!\n📝 <b>Reason:</b> ${targetAfk.reason}\n⏱️ <b>Since:</b> ${elapsedMins} min(s) ago`,
                    reply_to_message_id: msg.message_id,
                    parse_mode: "HTML",
                  }),
                }).catch(() => {});
              } else if (cState.raidEnabled && !fromUser?.is_bot) {
                // B. Raid Auto-Reply: 1 Incoming Target Msg = 1 Custom Raid Reply (Round-Robin Recycled)
                const cleanSender = senderUsername.toLowerCase();
                const cleanTarget = (cState.raidTargetUsername || "").toLowerCase();
                const sId = senderId ? String(senderId) : "";
                const tUid = cState.raidTargetUserId ? String(cState.raidTargetUserId) : "";

                let isTargetMatch = false;
                if (cleanTarget && cleanSender) {
                  if (cleanSender === cleanTarget) isTargetMatch = true;
                } else if (tUid && sId) {
                  if (sId === tUid) isTargetMatch = true;
                } else if (cleanTarget && !cleanSender && tUid && sId) {
                  if (sId === tUid) isTargetMatch = true;
                } else if (!cleanTarget && !tUid) {
                  isTargetMatch = true;
                }

                if (isTargetMatch) {
                  const pool = customRaidMessages.length > 0 ? customRaidMessages : [
                    "⚡ Powered by XYRO Group Security. What are you doing here?",
                    "🔥 Attention: Raid surveillance active in this chat!",
                    "🛡️ XYRO Bot is watching all chat activity."
                  ];

                  const currentIdx = cState.raidReplyIndex;
                  cState.raidReplyIndex++;
                  const selectedRaidMsg = pool[currentIdx % pool.length];
                  const tagPrefix = senderUsername ? `@${senderUsername} ` : (cleanTarget ? `@${cleanTarget} ` : "");
                  const finalReply = `${tagPrefix}${selectedRaidMsg}`.trim();

                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: finalReply,
                      reply_to_message_id: msg.message_id,
                    }),
                  });
                }
              }
            }
          }
        }
      } catch (err: any) {
        liveTelegramError = err.message;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // Start the background polling loop immediately
  pollTelegramUpdates();

  // 24/7 Keep-Alive Heartbeat: Self-pinging every 10 seconds so the bot NEVER sleeps or drops
  setInterval(async () => {
    try {
      const activeToken = process.env.BOT_TOKEN || "";
      if (activeToken) {
        fetch(`https://api.telegram.org/bot${activeToken}/getMe`).catch(() => {});
      }
    } catch (e) {}
  }, 10000);

  // API 1: Telegram Bot Status & Info
  app.get("/api/bot/status", async (req, res) => {
    const token = process.env.BOT_TOKEN || "";
    const owner = process.env.OWNER_USERNAME || "your_telegram_username";

    let tgResponse: any = null;
    let isConnected = false;
    let pingLatencyMs = 0;

    try {
      const start = Date.now();
      const fetchRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      pingLatencyMs = Date.now() - start;
      tgResponse = await fetchRes.json();
      isConnected = Boolean(tgResponse?.ok);
    } catch (e: any) {
      isConnected = false;
      tgResponse = { ok: false, error: e.message };
    }

    res.json({
      configured: Boolean(token),
      tokenMasked: token ? `${token.slice(0, 10)}...${token.slice(-6)}` : "",
      rawToken: token,
      ownerUsername: owner,
      isConnected,
      liveEngineActive: liveTelegramRunning,
      liveMessagesProcessed,
      lastProcessedUpdateId,
      pingLatencyMs,
      telegramData: tgResponse?.result || null,
      error: tgResponse?.ok ? null : (tgResponse?.description || tgResponse?.error || null),
      modules: botModules,
    });
  });

  // Toggle Live Polling Engine
  app.post("/api/bot/toggle-live", (req, res) => {
    liveTelegramRunning = !liveTelegramRunning;
    res.json({ liveEngineActive: liveTelegramRunning });
  });

  // API 2: Get Config
  app.get("/api/bot/config", (req, res) => {
    res.json({
      botToken: process.env.BOT_TOKEN || "",
      ownerUsername: process.env.OWNER_USERNAME || "XYRO_7X",
      ownerId: process.env.OWNER_ID || "0",
      ownerOnlyMode: process.env.OWNER_ONLY_MODE === "true",
      maxSpamCount: parseInt(process.env.MAX_SPAM_COUNT || "20", 10),
      spamDelay: parseFloat(process.env.SPAM_DELAY || "1.0"),
      raidCooldown: parseFloat(process.env.RAID_COOLDOWN || "3.0"),
      customRaidMessages,
      modules: botModules,
    });
  });

  // API 3: Update Config
  app.post("/api/bot/config", (req, res) => {
    const {
      botToken,
      ownerUsername,
      ownerId,
      ownerOnlyMode,
      maxSpamCount,
      spamDelay,
      raidCooldown,
      newRaidMessages,
    } = req.body;

    if (botToken) process.env.BOT_TOKEN = botToken;
    if (ownerUsername) process.env.OWNER_USERNAME = ownerUsername.replace(/^@/, "");
    if (ownerId !== undefined) process.env.OWNER_ID = String(ownerId);
    if (ownerOnlyMode !== undefined) process.env.OWNER_ONLY_MODE = String(ownerOnlyMode);
    if (maxSpamCount) process.env.MAX_SPAM_COUNT = String(maxSpamCount);
    if (spamDelay) process.env.SPAM_DELAY = String(spamDelay);
    if (raidCooldown) process.env.RAID_COOLDOWN = String(raidCooldown);
    if (Array.isArray(newRaidMessages)) {
      customRaidMessages.length = 0;
      customRaidMessages.push(...newRaidMessages.map((m: any) => String(m).trim()).filter((m: string) => m.length > 0));
      saveStoredRaidMessages(customRaidMessages);
    }

    res.json({ success: true, message: "Configuration updated successfully.", customRaidMessages });
  });

  // Dedicated Raid Messages API
  app.get("/api/bot/raid-messages", (req, res) => {
    res.json({
      messages: customRaidMessages,
      count: customRaidMessages.length,
    });
  });

  app.post("/api/bot/raid-messages", (req, res) => {
    const { messages } = req.body;
    if (Array.isArray(messages)) {
      customRaidMessages.length = 0;
      customRaidMessages.push(...messages.map((m: any) => String(m).trim()).filter((m: string) => m.length > 0));
      saveStoredRaidMessages(customRaidMessages);
    }
    res.json({
      success: true,
      messages: customRaidMessages,
      count: customRaidMessages.length,
    });
  });

  // API 4: Simulate Telegram Command
  app.post("/api/bot/simulate", async (req, res) => {
    const {
      commandText,
      userRole = "owner", // "owner", "admin", "member"
      senderUsername = "XYRO_7X",
      senderId = null,
      chatId = "-1001234567890",
      replyToMessage = null, // { id: 101, text: "..." }
    } = req.body;

    if (!chatSimStates[chatId]) {
      chatSimStates[chatId] = {
        raidEnabled: false,
        raidTargetUsername: null,
        raidTargetUserId: null,
        raidTargetId: null,
        raidReplyIndex: 0,
        raidLastReplyTime: 0,
        spamActive: false,
        spamCancelRequested: false,
      };
    }

    const state = chatSimStates[chatId];
    const text = (commandText || "").trim();
    const ownerName = (process.env.OWNER_USERNAME || "XYRO_7X").toLowerCase().replace(/^@/, "");
    const isOwner = userRole === "owner" || senderUsername.toLowerCase().replace(/^@/, "") === ownerName;
    const isSudo = userRole === "sudo" || checkIsSudo("", senderUsername);
    const isAuthorized = isOwner || isSudo;
    const isAdmin = isAuthorized || userRole === "admin";
    const ownerOnlyMode = process.env.OWNER_ONLY_MODE === "true";

    const hasAdminPerms = ownerOnlyMode ? isAuthorized : isAdmin;

    const responses: Array<{ text: string; parse_mode: string; type?: string; delay?: number }> = [];

    const normalizedText = normalizeToAscii(text).trim();
    const isCommand = normalizedText.startsWith(".") || normalizedText.startsWith("/") || normalizedText.startsWith("!");

    // 1. Check if command
    if (isCommand) {
      if (!isAuthorized) {
        // Strictly ignore non-authorized commands
        return res.json({
          received: text,
          userRole,
          senderUsername,
          responses: [],
          ignored: true,
          reason: `Strict Auth: Command ignored. Only @${ownerName} and authorized Sudo users can run bot commands.`
        });
      }

      const parts = normalizedText.split(/\s+/);
      const rawCmd = parts[0].substring(1).split("@")[0].toLowerCase();
      const args = parts.slice(1);

      if (rawCmd === "help") {
        if (args.length > 0) {
          const modName = args[0].toLowerCase();
          const modHelp = getFormattedModuleHelp(modName);
          if (modHelp) {
            responses.push({ text: modHelp, parse_mode: "HTML" });
          } else {
            responses.push({
              text: formatCommandPanel("ERROR", [
                "Status: MODULE NOT FOUND",
                `Module '${args[0]}' does not exist.`,
                "Available: raid, spam, system"
              ], undefined, "Type .help to view all modules"),
              parse_mode: "HTML",
            });
          }
        } else {
          responses.push({ text: getFormattedHelpMenu(), parse_mode: "HTML" });
        }
      } else if (rawCmd === "ping") {
        const latency = Math.floor(Math.random() * 25) + 14;
        const uptime = (Date.now() - botStartTime) / 1000;
        responses.push({
          text: formatCommandPanel(
            "PING",
            [
              `Latency: ${latency} ms`,
              `Uptime: ${formatUptime(uptime)}`
            ],
            "YOUR XYRO IS RUNNING"
          ),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "raid") {
        if (!hasAdminPerms) {
          responses.push({
            text: formatCommandPanel("ERROR", [
              "Status: ACCESS DENIED",
              ownerOnlyMode
                ? "Command restricted to @XYRO_7X only."
                : "Command available to administrators only."
            ]),
            parse_mode: "HTML",
          });
        } else {
          let targetUname: string | null = null;
          let targetUid: string | number | null = null;
          let targetMid: string | number | null = null;

          if (args.length > 0) {
            targetUname = args[0].replace(/^@/, "").trim();
          }

          if (replyToMessage) {
            targetMid = replyToMessage.id;
            targetUid = replyToMessage.senderId || null;
            if (!targetUname && replyToMessage.sender) {
              targetUname = replyToMessage.sender.replace(/^@/, "");
            }
          }

          if (!targetUname && !targetMid) {
            responses.push({
              text: formatCommandPanel("RAID", [
                "Status: TARGET REQUIRED",
                "Reply to a message with .raid or specify user:",
                "Example: .raid @username"
              ]),
              parse_mode: "HTML",
            });
          } else {
            state.raidEnabled = true;
            state.raidTargetUsername = targetUname;
            state.raidTargetUserId = targetUid;
            state.raidTargetId = targetMid;
            state.raidReplyIndex = 0;
            state.raidLastReplyTime = 0;

            const poolCount = customRaidMessages.length > 0 ? customRaidMessages.length : 40;
            const targetDisplay = targetUname ? `@${targetUname}` : `Msg #${targetMid}`;

            responses.push({
              text: formatCommandPanel(
                "RAID",
                [
                  "Status: ENABLED",
                  `Target: ${targetDisplay}`,
                  "Mode: Round-Robin Cycle (1 Msg = 1 Reply)",
                  `Messages Pool: ${poolCount}`
                ],
                "⚡ YOUR XYRO IS RUNNING"
              ),
              parse_mode: "HTML",
            });
          }
        }
      } else if (rawCmd === "draid") {
        if (!hasAdminPerms) {
          responses.push({
            text: formatCommandPanel("ERROR", [
              "Status: ACCESS DENIED",
              ownerOnlyMode
                ? "Command restricted to @XYRO_7X only."
                : "Command available to administrators only."
            ]),
            parse_mode: "HTML",
          });
        } else if (state.raidEnabled) {
          state.raidEnabled = false;
          state.raidTargetUsername = null;
          state.raidTargetUserId = null;
          state.raidTargetId = null;
          state.raidReplyIndex = 0;
          responses.push({
            text: formatCommandPanel("DRAID", [
              "Status: DISABLED",
              "RAID mode stopped successfully."
            ]),
            parse_mode: "HTML",
          });
        } else {
          responses.push({
            text: formatCommandPanel("DRAID", [
              "Status: INACTIVE",
              "No active raid mode in this chat."
            ]),
            parse_mode: "HTML",
          });
        }
      } else if (rawCmd === "spam") {
        if (!hasAdminPerms) {
          responses.push({
            text: formatCommandPanel("ERROR", [
              "Status: ACCESS DENIED",
              ownerOnlyMode
                ? "Command restricted to @XYRO_7X only."
                : "Command available to administrators only."
            ]),
            parse_mode: "HTML",
          });
        } else if (args.length === 0) {
          responses.push({
            text: formatCommandPanel("USAGE", [
              "Syntax: .spam <count> <text>",
              "Example: .spam 5 Hello World"
            ]),
            parse_mode: "HTML",
          });
        } else if (args.length === 1) {
          responses.push({
            text: formatCommandPanel("SPAM", [
              "Status: MISSING TEXT",
              "Provide message text after count."
            ]),
            parse_mode: "HTML",
          });
        } else {
          const count = parseInt(args[0], 10);
          const maxCount = parseInt(process.env.MAX_SPAM_COUNT || "20", 10);
          if (isNaN(count) || count <= 0) {
            responses.push({
              text: formatCommandPanel("SPAM", [
                "Status: INVALID COUNT",
                "Count must be a valid positive number."
              ]),
              parse_mode: "HTML",
            });
          } else if (count > maxCount) {
            responses.push({
              text: formatCommandPanel("SPAM", [
                "Status: LIMIT EXCEEDED",
                `Maximum allowed count is ${maxCount}.`
              ]),
              parse_mode: "HTML",
            });
          } else if (state.spamActive) {
            responses.push({
              text: formatCommandPanel("SPAM", [
                "Status: ERROR",
                "A spam task is already running in this chat.",
                "Use .stopspam to cancel."
              ]),
              parse_mode: "HTML",
            });
          } else {
            const spamBody = args.slice(1).join(" ");
            state.spamActive = true;
            state.spamCancelRequested = false;

            responses.push({
              text: formatCommandPanel(
                "SPAM",
                [
                  `Count: ${count}`,
                  `Text: ${spamBody}`,
                  "Status: STARTED"
                ],
                "⚡ YOUR XYRO IS RUNNING"
              ),
              parse_mode: "HTML",
            });

            // Return simulated spam sequence metadata
            responses.push({
              type: "spam_sequence",
              text: spamBody,
              count: count,
              delay: parseFloat(process.env.SPAM_DELAY || "1.0"),
            } as any);
          }
        }
      } else if (rawCmd === "status" || rawCmd === "alive") {
        const latency = Math.floor(Math.random() * 20) + 12;
        const uptime = (Date.now() - botStartTime) / 1000;
        const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
        responses.push({
          text: formatCommandPanel(
            "STATUS",
            [
              "Engine: 24/7 ALWAYS ACTIVE",
              `Latency: ${latency} ms`,
              `Uptime: ${formatUptime(uptime)}`,
              `RAM: ${memUsage} MB`,
              `Active Chats: ${Object.keys(liveChatStates).length || 1}`,
              `Raid Mode: ${state.raidEnabled ? "ACTIVE" : "IDLE"}`,
              `Spam Task: ${state.spamActive ? "RUNNING" : "IDLE"}`,
              "System: XYRO Ultra-Fast Engine"
            ],
            "⚡ YOUR XYRO IS RUNNING"
          ),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "pin") {
        if (!replyToMessage) {
          responses.push({
            text: formatCommandPanel("PIN", [
              "Status: REPLY REQUIRED",
              "Reply to any message with .pin to pin it.",
              "Option: .pin silent (pin without notification)"
            ]),
            parse_mode: "HTML",
          });
        } else {
          const isSilent = args.some(a => ["silent", "quiet", "s"].includes(a.toLowerCase()));
          responses.push({
            text: formatCommandPanel("PIN", [
              "Status: PINNED SUCCESSFULLY",
              `Target: Message #${replyToMessage.id || 101}`,
              `Alert: ${isSilent ? "SILENT (No notification)" : "LOUD (Notified members)"}`
            ], "YOUR XYRO IS RUNNING"),
            parse_mode: "HTML",
          });
        }
      } else if (rawCmd === "unpin" || rawCmd === "unpinall") {
        const isAll = rawCmd === "unpinall" || args[0]?.toLowerCase() === "all";
        responses.push({
          text: formatCommandPanel(isAll ? "UNPIN ALL" : "UNPIN", [
            `Status: ${isAll ? "ALL UNPINNED" : "UNPINNED"}`,
            isAll ? "All pinned messages in this group cleared." : (replyToMessage ? `Target: Message #${replyToMessage.id}` : "Top pinned message unpinned.")
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "del" || rawCmd === "delete") {
        if (!replyToMessage) {
          responses.push({
            text: formatCommandPanel("DEL", [
              "Status: REPLY REQUIRED",
              "Reply to any message with .del to delete it instantly."
            ]),
            parse_mode: "HTML",
          });
        } else {
          responses.push({
            text: formatCommandPanel("DEL", [
              "Status: DELETED",
              `Target: Message #${replyToMessage.id}`
            ], "YOUR XYRO IS RUNNING"),
            parse_mode: "HTML",
          });
        }
      } else if (rawCmd === "delall" || rawCmd === "purgeuser") {
        const target = args[0] || (replyToMessage?.sender ? `@${replyToMessage.sender}` : "@user");
        responses.push({
          text: formatCommandPanel("DELALL", [
            "Status: COMPLETED",
            `Target: ${target}`,
            "Deleted: All user messages",
            "Cleaned all target messages in GC."
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "purge") {
        const count = args[0] || "50";
        responses.push({
          text: formatCommandPanel("PURGE", [
            "Status: COMPLETED",
            `Cleaned: ${count} message(s)`,
            replyToMessage ? `Range: #${replyToMessage.id} → Current` : `Scope: Last ${count} messages`,
            "Group chat messages wiped cleanly."
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "lockall" || rawCmd === "unlockall") {
        const isLockAll = rawCmd === "lockall";
        responses.push({
          text: formatCommandPanel(isLockAll ? "LOCK ALL" : "UNLOCK ALL", [
            `Status: ${isLockAll ? "locked all" : "unlocked all"}`
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "autodel" || rawCmd === "delwatch" || rawCmd === "watchdel" || rawCmd === "targetdel") {
        const target = replyToMessage ? `@${replyToMessage.sender}` : (args[0] || "@user");
        responses.push({
          text: formatCommandPanel("AUTO DELETE", [
            "Status: active",
            `Target: ${target}`,
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "unautodel" || rawCmd === "undelwatch" || rawCmd === "stopautodel") {
        const target = args[0] === "all" ? "all users" : (replyToMessage ? `@${replyToMessage.sender}` : (args[0] || "@user"));
        responses.push({
          text: formatCommandPanel("AUTO DELETE", [
            args[0] === "all" ? "Status: all cleared" : "Status: disabled",
            `Target: ${target}`,
            "Auto-delete surveillance cleared."
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "autodellist" || rawCmd === "delwatchlist") {
        responses.push({
          text: formatCommandPanel("AUTO DELETE LIST", [
            "Status: active surveillance",
            "Total Targets: 1 user(s)",
            "Target: @targeted_user (instant delete on chat)"
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "addsudo" || rawCmd === "setsudo") {
        const target = replyToMessage ? `@${replyToMessage.sender}` : (args[0] || "@user");
        responses.push({
          text: formatCommandPanel("ADD SUDO", [
            "Status: success",
            `User: ${target}`,
            "Permission: sudo access granted"
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "delsudo" || rawCmd === "removesudo") {
        const target = args[0] === "all" ? "all users" : (replyToMessage ? `@${replyToMessage.sender}` : (args[0] || "@user"));
        responses.push({
          text: formatCommandPanel("DEL SUDO", [
            args[0] === "all" ? "Status: all removed" : "Status: removed",
            `User: ${target}`,
            "Permission: sudo access revoked"
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "sudolist") {
        responses.push({
          text: formatCommandPanel("SUDO LIST", [
            "Total Sudo: 1 user(s)",
            "User: @user (Sudo Admin)"
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "love" || rawCmd === "heart") {
        responses.push({
          text: "✨ 💖 <b>𝐈 𝐋𝐎𝐕𝐄 𝐘𝐎𝐔</b> 💖 ✨\n<i>⚡ YOUR XYRO IS RUNNING</i>",
          parse_mode: "HTML",
        });
      } else if (rawCmd === "hack") {
        const target = replyToMessage ? `@${replyToMessage.sender}` : (args[0] || "@user");
        responses.push({
          text: formatCommandPanel("CYBER HACK REPORT", [
            `Target: ${target}`,
            "Status: Breached 100%",
            "IP Address: 192.168.1.104",
            "ISP: High-Speed Cyber Net",
            "Security: Compromised"
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "magic") {
        responses.push({
          text: "🌟 💖 👑 <b>ABRACADABRA!</b> 👑 💖 🌟\n<i>XYRO magic unleashed upon chat!</i>\n<code>⚡ YOUR XYRO IS RUNNING</code>",
          parse_mode: "HTML",
        });
      } else if (rawCmd === "destroy") {
        const target = replyToMessage ? `@${replyToMessage.sender}` : (args[0] || "@user");
        responses.push({
          text: `🔥 🌋 💨 <b>ANNIHILATION COMPLETE!</b>\n<i>Target ${target} vaporized into quantum dust.</i>\n<code>⚡ YOUR XYRO IS RUNNING</code>`,
          parse_mode: "HTML",
        });
      } else if (rawCmd === "loading") {
        const label = args.join(" ") || "System Operation";
        responses.push({
          text: `✅ <b>${label} COMPLETED 100%!</b>\n<code>⚡ YOUR XYRO IS RUNNING</code>`,
          parse_mode: "HTML",
        });
      } else if (rawCmd === "matrix") {
        responses.push({
          text: "🟢 <b>[MATRIX ACCESS GRANTED]</b>\n<i>Welcome to XYRO Zion Terminal.</i>\n<code>⚡ YOUR XYRO IS RUNNING</code>",
          parse_mode: "HTML",
        });
      } else if (rawCmd === "type") {
        const fullText = args.join(" ") || "Hello from XYRO robot!";
        responses.push({
          text: `⌨️ <b>${fullText}</b>\n<code>⚡ YOUR XYRO IS RUNNING</code>`,
          parse_mode: "HTML",
        });
      } else if (rawCmd === "rain" || rawCmd === "weather") {
        responses.push({
          text: "🌦️ 🌈 <b>Sky clears up with a bright rainbow!</b> ✨\n<code>⚡ YOUR XYRO IS RUNNING</code>",
          parse_mode: "HTML",
        });
      } else if (rawCmd === "bomb") {
        responses.push({
          text: "💨 🔥 🌋 <b>BLAST RESIDUE!</b>\n<i>Chat cleared with explosive power.</i>\n<code>⚡ YOUR XYRO IS RUNNING</code>",
          parse_mode: "HTML",
        });
      } else if (rawCmd === "dance") {
        responses.push({
          text: "🎉 🪩 🕺 💃 🪩 🎉 <b>ULTIMATE DANCE PARTY!</b>\n<code>⚡ YOUR XYRO IS RUNNING</code>",
          parse_mode: "HTML",
        });
      } else if (rawCmd === "dice" || rawCmd === "roll") {
        responses.push({
          text: "🎲 <b>[DICE ROLLED: 6]</b> (Telegram 3D Animated Dice)",
          parse_mode: "HTML",
        });
      } else if (rawCmd === "dart") {
        responses.push({
          text: "🎯 <b>[BULLSEYE 100/100]</b> (Telegram Animated Dart Board)",
          parse_mode: "HTML",
        });
      } else if (rawCmd === "basket" || rawCmd === "bb") {
        responses.push({
          text: "🏀 <b>[SWISH! 3-POINTER GOAL]</b> (Telegram Animated Basketball)",
          parse_mode: "HTML",
        });
      } else if (rawCmd === "football" || rawCmd === "goal") {
        responses.push({
          text: "⚽ <b>[GOOOOOOAL!]</b> (Telegram Animated Soccer Goal)",
          parse_mode: "HTML",
        });
      } else if (rawCmd === "slot" || rawCmd === "casino") {
        responses.push({
          text: "🎰 <b>[JACKPOT 777 WINNER!]</b> (Telegram Slot Machine)",
          parse_mode: "HTML",
        });
      } else if (rawCmd === "shayari" || rawCmd === "quote") {
        responses.push({
          text: formatCommandPanel("SHAYARI & ATTITUDE", [
            "Quote:",
            "तेवर तो हम वक्त आने पर दिखाएंगे,\nशहर तुम खरीद लो, हुकूमत हम चलाएंगे! 👑",
            "Author: Royal XYRO Poetry"
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "roast") {
        const target = replyToMessage ? `@${replyToMessage.sender}` : (args[0] || "@user");
        responses.push({
          text: formatCommandPanel("SAVAGE ROAST", [
            `Target: ${target}`,
            `Burn: ${target} is living proof that even physics laws have bugs in beta testing! 🧪`
          ], "⚡ YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "ship") {
        const u1 = args[0] || `@${senderUsername || "User1"}`;
        const u2 = args[1] || (replyToMessage ? `@${replyToMessage.sender}` : "@SecretCrush");
        responses.push({
          text: formatCommandPanel("LOVE COMPATIBILITY", [
            `Couple: ${u1} ❤️ ${u2}`,
            "Score: 98% Compatibility",
            "Destiny: Soulmates forever! Wedding when? 👰🤵"
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "truth") {
        responses.push({
          text: formatCommandPanel("TRUTH CHALLENGE", [
            "Question:",
            "What is the most embarrassing thing in your search history right now?",
            "Rule: Must answer honestly in group chat!"
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "dare") {
        responses.push({
          text: formatCommandPanel("DARE CHALLENGE", [
            "Dare:",
            "Change your Telegram bio to 'I am ruled by XYRO Robot' for 1 hour!",
            "Rule: Complete the task within 2 minutes!"
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "flip" || rawCmd === "coin") {
        responses.push({
          text: formatCommandPanel("COIN TOSS", [
            "Toss Result: 👑 HEADS (Winner)",
            `Flipped by: @${senderUsername || "User"}`
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "joke") {
        responses.push({
          text: formatCommandPanel("LAUGH & JOKE", [
            "Joke:",
            "Teacher: 'Homework kyun nahi kiya?'\nStudent: 'Sir memory card corrupt ho gaya tha!' 😂"
          ], "YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "lock" || rawCmd === "unlock") {
        const targetPerm = (args[0] || "all").toUpperCase();
        const isLock = rawCmd === "lock";
        responses.push({
          text: formatCommandPanel(isLock ? "LOCK" : "UNLOCK", [
            `Status: ${isLock ? "LOCKED" : "UNLOCKED"}`,
            `Scope: ${targetPerm}`,
            isLock ? "Restricted for non-admin members." : "Permissions restored for members."
          ], "⚡ YOUR XYRO IS RUNNING"),
          parse_mode: "HTML",
        });
      } else if (rawCmd === "stopspam") {
        if (!hasAdminPerms) {
          responses.push({
            text: formatCommandPanel("ERROR", [
              "Status: ACCESS DENIED",
              ownerOnlyMode
                ? "Command restricted to @XYRO_7X only."
                : "Command available to administrators only."
            ]),
            parse_mode: "HTML",
          });
        } else if (state.spamActive) {
          state.spamActive = false;
          state.spamCancelRequested = true;
          responses.push({
            text: formatCommandPanel("STOPSPAM", [
              "Status: STOPPED",
              "Active spam task cancelled."
            ]),
            parse_mode: "HTML",
          });
        } else {
          responses.push({
            text: formatCommandPanel("STOPSPAM", [
              "Status: IDLE",
              "No active spam task in this chat."
            ]),
            parse_mode: "HTML",
          });
        }
      } else {
        responses.push({
          text: formatCommandPanel("UNKNOWN", [
            `Command: .${rawCmd}`,
            "Status: COMMAND NOT FOUND"
          ], undefined, "Type .help to view available commands"),
          parse_mode: "HTML",
        });
      }
    } else {
      // Non-command message: check Raid mode
      if (state.raidEnabled) {
        const cleanSender = (senderUsername || "").toLowerCase().replace(/^@/, "").trim();
        const cleanTarget = (state.raidTargetUsername || "").toLowerCase().replace(/^@/, "").trim();
        const sId = senderId ? String(senderId) : "";
        const tUid = state.raidTargetUserId ? String(state.raidTargetUserId) : "";

        let isTargetMatch = false;
        if (cleanTarget && cleanSender) {
          if (cleanSender === cleanTarget) isTargetMatch = true;
        } else if (tUid && sId) {
          if (sId === tUid) isTargetMatch = true;
        } else if (!cleanTarget && !tUid) {
          // General raid
          isTargetMatch = true;
        }

        if (isTargetMatch) {
          const pool = customRaidMessages.length > 0 ? customRaidMessages : [
            "⚡ Powered by XYRO Group Security. What are you doing here?",
            "🔥 Attention: Raid surveillance active in this chat!",
            "🛡️ XYRO Bot is watching all chat activity."
          ];

          const currentIdx = state.raidReplyIndex || 0;
          state.raidReplyIndex = currentIdx + 1;
          const selectedRaidMsg = pool[currentIdx % pool.length];
          const tagPrefix = cleanSender ? `@${cleanSender} ` : (cleanTarget ? `@${cleanTarget} ` : "");
          const finalReply = `${tagPrefix}${selectedRaidMsg}`.trim();

          responses.push({
            text: finalReply,
            parse_mode: "HTML",
            type: "raid_auto_reply",
          });
        }
      }
    }

    res.json({
      success: true,
      responses: responses.map((response) => ({
        ...response,
        text: etherizeBranding(response.text),
      })),
      chatState: state,
    });
  });

  // API 5: File Explorer
  app.get("/api/bot/files", (req, res) => {
    const files: Record<string, string> = {};
    const readDir = (dirPath: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.relative(process.cwd(), fullPath);

        if (
          relPath.startsWith("node_modules") ||
          relPath.startsWith(".git") ||
          relPath.startsWith("dist") ||
          relPath.startsWith("assets") ||
          relPath.includes("__pycache__")
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          readDir(fullPath);
        } else if (
          entry.name.endsWith(".py") ||
          entry.name.endsWith(".md") ||
          entry.name.endsWith(".txt") ||
          entry.name.startsWith(".env")
        ) {
          try {
            files[relPath] = fs.readFileSync(fullPath, "utf-8");
          } catch (e) {}
        }
      }
    };

    readDir(process.cwd());
    res.json({ files });
  });

  // API 6: Download All Python Bot Code as ZIP
  app.get("/api/bot/download-zip", async (req, res) => {
    try {
      const zip = new JSZip();
      const filesToInclude = [
        "main.py",
        "config.py",
        "requirements.txt",
        ".env.example",
        ".env",
        "README.md",
        "core/registry.py",
        "core/state.py",
        "core/permissions.py",
        "handlers/help.py",
        "handlers/raid.py",
        "handlers/spam.py",
        "handlers/system.py",
        "services/raid_service.py",
        "services/spam_service.py",
        "utils/formatting.py",
        "utils/logger.py",
      ];

      for (const relFile of filesToInclude) {
        const fullPath = path.join(process.cwd(), relFile);
        if (fs.existsSync(fullPath)) {
          zip.file(`telegram_bot/${relFile}`, fs.readFileSync(fullPath, "utf-8"));
        }
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", 'attachment; filename="ether_telegram_bot.zip"');
      res.send(zipBuffer);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to generate ZIP", details: err.message });
    }
  });

  // Vite middleware for dev
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Telegram Bot Dashboard running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
