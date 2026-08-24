import asyncio
import sys
import os
import json
import time
import urllib.request
import urllib.parse
from typing import Any, Optional

import config
from utils.logger import logger
from core.registry import registry
from core.state import chat_state_manager
from handlers.help import handle_help_command
from handlers.system import handle_ping_command
from handlers.spam import handle_spam_command, handle_stopspam_command
from handlers.raid import handle_raid_command, handle_draid_command
from services.raid_service import process_incoming_raid_message

# Universal Telegram Message Abstraction to support both PTB and native Async Engine
class TelegramUser:
    def __init__(self, data: dict):
        self.id: int = data.get("id", 0)
        self.is_bot: bool = data.get("is_bot", False)
        self.first_name: str = data.get("first_name", "")
        self.username: Optional[str] = data.get("username")

class TelegramChat:
    def __init__(self, data: dict, bot_instance: Any = None):
        self.id: int = data.get("id", 0)
        self.type: str = data.get("type", "group")
        self.title: str = data.get("title", "")
        self._bot = bot_instance

    async def get_member(self, user_id: int):
        if self._bot:
            return await self._bot.get_chat_member(self.id, user_id)
        # Default mock member object
        class Member:
            status = "member"
        return Member()

class TelegramMessage:
    def __init__(self, data: dict, bot_instance: Any = None):
        self.message_id: int = data.get("message_id", 0)
        self.date: int = data.get("date", 0)
        self.text: str = data.get("text", "")
        self.from_user: Optional[TelegramUser] = TelegramUser(data.get("from", {})) if "from" in data else None
        self.chat: TelegramChat = TelegramChat(data.get("chat", {}), bot_instance)
        self.chat_id: int = self.chat.id
        self._bot = bot_instance
        self.reply_to_message: Optional[TelegramMessage] = (
            TelegramMessage(data.get("reply_to_message", {}), bot_instance)
            if "reply_to_message" in data else None
        )

    async def reply_text(self, text: str, parse_mode: str = "HTML") -> Any:
        if self._bot:
            return await self._bot.send_message(
                chat_id=self.chat_id,
                text=text,
                reply_to_message_id=self.message_id,
                parse_mode=parse_mode
            )

class TelegramUpdate:
    def __init__(self, data: dict, bot_instance: Any = None):
        self.update_id: int = data.get("update_id", 0)
        self.message: Optional[TelegramMessage] = (
            TelegramMessage(data.get("message", {}), bot_instance)
            if "message" in data else None
        )
        self.effective_message = self.message
        self.effective_chat = self.message.chat if self.message else None
        self.effective_user = self.message.from_user if self.message else None

class NativeTelegramBot:
    """High-performance asynchronous Telegram Bot API client using standard libraries."""
    def __init__(self, token: str):
        self.token = token
        self.base_url = f"https://api.telegram.org/bot{token}"
        self.username = ""
        self.bot_id = 0

    async def _make_request(self, method: str, payload: dict = None) -> dict:
        url = f"{self.base_url}/{method}"
        headers = {"Content-Type": "application/json"}
        data_bytes = json.dumps(payload or {}).encode("utf-8") if payload else None

        loop = asyncio.get_running_loop()
        def _sync_req():
            req = urllib.request.Request(url, data=data_bytes, headers=headers, method="POST" if payload else "GET")
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except Exception as e:
                logger.error(f"API Error ({method}): {e}")
                return {"ok": False, "error": str(e)}

        return await loop.run_in_executor(None, _sync_req)

    async def get_me(self) -> dict:
        res = await self._make_request("getMe")
        if res.get("ok"):
            res_data = res.get("result", {})
            self.username = res_data.get("username", "")
            self.bot_id = res_data.get("id", 0)
        return res

    async def get_chat_member(self, chat_id: int, user_id: int):
        res = await self._make_request("getChatMember", {"chat_id": chat_id, "user_id": user_id})
        class Member:
            def __init__(self, status):
                self.status = status
        if res.get("ok"):
            status = res.get("result", {}).get("status", "member")
            return Member(status)
        return Member("member")

    async def send_message(
        self,
        chat_id: int,
        text: str,
        reply_to_message_id: Optional[int] = None,
        parse_mode: str = "HTML"
    ) -> dict:
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode
        }
        if reply_to_message_id:
            payload["reply_to_message_id"] = reply_to_message_id
        return await self._make_request("sendMessage", payload)

    async def get_updates(self, offset: int = 0, timeout: int = 25) -> list:
        payload = {"offset": offset, "timeout": timeout, "allowed_updates": ["message"]}
        res = await self._make_request("getUpdates", payload)
        if res.get("ok"):
            return res.get("result", [])
        return []

async def process_update(update: TelegramUpdate, bot: NativeTelegramBot):
    """Core message router following the exact pipeline specifications."""
    msg = update.message
    if not msg or not msg.text:
        return

    text = msg.text.strip()
    chat_id = msg.chat_id
    from_user = msg.from_user
    is_bot = from_user.is_bot if from_user else False

    # 1. Ignore bot messages (Loop Protection)
    if is_bot or (from_user and from_user.id == bot.bot_id):
        return

    # 2. Check if this is an explicit command
    is_cmd = False
    cmd_name = ""
    for p in config.COMMAND_PREFIXES:
        if text.startswith(p):
            is_cmd = True
            first_word = text[len(p):].split()[0]
            # Strip @BotUsername if present (e.g. .help@MyBot)
            cmd_name = first_word.split("@")[0].lower()
            break

    # Context wrapper
    class Context:
        def __init__(self, bot_inst):
            self.bot = bot_inst

    ctx = Context(bot)

    if is_cmd:
        from core.permissions import is_owner
        if not is_owner(from_user):
            sender_tag = f"@{from_user.username}" if (from_user and from_user.username) else f"ID:{from_user.id if from_user else 0}"
            logger.info(f"🚫 Ignored command '{cmd_name}' from unauthorized user {sender_tag} (Strict Owner Only: @{config.OWNER_USERNAME})")
            return

        logger.info(f"Command '{cmd_name}' received from owner @{from_user.username if from_user else 'unknown'} in chat {chat_id}")
        if cmd_name == "help":
            await handle_help_command(update, ctx)
        elif cmd_name == "ping":
            await handle_ping_command(update, ctx)
        elif cmd_name == "spam":
            await handle_spam_command(update, ctx)
        elif cmd_name == "stopspam":
            await handle_stopspam_command(update, ctx)
        elif cmd_name == "raid":
            await handle_raid_command(update, ctx)
        elif cmd_name == "draid":
            await handle_draid_command(update, ctx)
        return

    # 3. If not a command, check Raid Service for auto-replies
    async def reply_closure(c_id: int, reply_msg_id: int, reply_text: str):
        await bot.send_message(c_id, reply_text, reply_to_message_id=reply_msg_id, parse_mode="HTML")

    await process_incoming_raid_message(
        chat_id=chat_id,
        message_id=msg.message_id,
        sender_id=from_user.id if from_user else 0,
        sender_username=from_user.username if from_user and from_user.username else "",
        is_bot=is_bot,
        text=text,
        reply_fn=reply_closure
    )

async def main():
    """Main Telegram Bot entry point."""
    print("=" * 60)
    print(" 🚀 ETHER CUSTOM TELEGRAM GROUP BOT ")
    print("=" * 60)

    if not config.BOT_TOKEN or config.BOT_TOKEN == "YOUR_BOT_TOKEN":
        logger.error("BOT_TOKEN is not configured! Please set BOT_TOKEN in .env")
        print("\n❌ Error: BOT_TOKEN is missing in .env file!")
        return

    logger.info("Initializing ETHER Telegram Bot...")
    logger.info(f"Configured Owner: @{config.OWNER_USERNAME}")
    logger.info(f"Loaded Modules: {list(registry.get_all_modules().keys())}")

    bot = NativeTelegramBot(config.BOT_TOKEN)
    me_resp = await bot.get_me()

    if not me_resp.get("ok"):
        logger.error(f"Failed to connect to Telegram API: {me_resp.get('error')}")
        print("❌ Telegram connection failed. Check your BOT_TOKEN.")
        return

    bot_info = me_resp.get("result", {})
    logger.info(f"Bot connected successfully as @{bot_info.get('username')} (ID: {bot_info.get('id')})")
    print(f"\n✅ Bot is LIVE as @{bot_info.get('username')}!")
    print(f"👑 Owner: @{config.OWNER_USERNAME}")
    print("📡 Polling for updates...\n")

    offset = 0
    while True:
        try:
            updates = await bot.get_updates(offset=offset, timeout=20)
            for upd_raw in updates:
                upd_id = upd_raw.get("update_id", 0)
                offset = max(offset, upd_id + 1)
                update = TelegramUpdate(upd_raw, bot)
                # Dispatch update asynchronously to prevent blocking the polling loop
                asyncio.create_task(process_update(update, bot))
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Polling exception: {e}")
            await asyncio.sleep(3)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Bot stopped by user.")
