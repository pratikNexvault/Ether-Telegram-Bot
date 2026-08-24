export interface CommandDoc {
  name: string;
  syntax: string;
  description: string;
  permission: "everyone" | "admin" | "owner";
}

export interface ModuleDoc {
  name: string;
  description: string;
  icon: string;
  commands: CommandDoc[];
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderRole: "owner" | "admin" | "member" | "bot";
  text: string;
  timestamp: string;
  isCommand?: boolean;
  replyToId?: string;
  parseMode?: string;
  type?: "bot_response" | "user_msg" | "raid_reply" | "spam_msg";
}

export interface BotStatus {
  configured: boolean;
  tokenMasked: string;
  rawToken: string;
  ownerUsername: string;
  isConnected: boolean;
  pingLatencyMs: number;
  telegramData: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
    supports_inline_queries?: boolean;
  } | null;
  error: string | null;
  modules: ModuleDoc[];
}

export interface BotConfig {
  botToken: string;
  ownerUsername: string;
  ownerId: string;
  ownerOnlyMode: boolean;
  maxSpamCount: number;
  spamDelay: number;
  raidCooldown: number;
  customRaidMessages: string[];
  modules: ModuleDoc[];
}
