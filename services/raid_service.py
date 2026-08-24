import random
from typing import Any, Callable, Awaitable
import config
from utils.logger import logger
from core.state import chat_state_manager

async def process_incoming_raid_message(
    chat_id: int,
    message_id: int,
    sender_id: int,
    sender_username: str,
    is_bot: bool,
    text: str,
    reply_fn: Callable[[int, int, str], Awaitable[Any]]
) -> bool:
    """
    Evaluates new incoming messages against active raid rules:
    - Verifies message is not from a bot
    - Verifies message is not a command
    - Verifies raid is active in the chat
    - Checks if target user is set and matches the incoming sender
    - Cycles through CUSTOM_RAID_MESSAGES round-robin (1 target message = 1 custom raid reply, recycled)
    - Formats reply with target user mention: @username <message>
    """
    # 1. Protection against self/bot loops
    if is_bot:
        return False

    # 2. Ignore commands
    trimmed = (text or "").strip()
    if any(trimmed.startswith(p) for p in config.COMMAND_PREFIXES):
        return False

    # 3. Check raid status & target info
    is_active, target_msg_id, target_user_id, target_username = await chat_state_manager.is_raid_active(chat_id)
    if not is_active:
        return False

    # 4. Target matching
    clean_sender_uname = str(sender_username or "").lower().lstrip("@").strip()
    clean_target_uname = str(target_username or "").lower().lstrip("@").strip()

    is_targeted = False
    if clean_target_uname and clean_sender_uname:
        if clean_sender_uname == clean_target_uname:
            is_targeted = True
    elif target_user_id and sender_id:
        if sender_id == target_user_id:
            is_targeted = True
    elif target_msg_id and not clean_target_uname and not target_user_id:
        # General chat raid if only message ID was supplied with no specific user info
        is_targeted = True
    elif not clean_target_uname and not target_user_id:
        # General chat raid
        is_targeted = True

    if not is_targeted:
        return False

    # 5. Check Cooldown (cooldown between rapid auto-replies, default 1.0 - 3.0s)
    can_reply = await chat_state_manager.can_raid_reply(chat_id, config.RAID_COOLDOWN)
    if not can_reply:
        logger.debug(f"[RaidService] Cooldown active for chat {chat_id}, ignoring message {message_id}")
        return False

    # 6. Pick next message in round-robin sequence (recycled indefinitely)
    pool = config.CUSTOM_RAID_MESSAGES
    if not pool:
        pool = [
            "⚡ Powered by ETHER Group Security. What are you doing here?",
            "🔥 Attention: Raid surveillance active in this chat!",
            "🛡️ Message detected. ETHER Bot is watching all activity."
        ]

    next_idx = await chat_state_manager.get_next_raid_index(chat_id)
    selected_msg = pool[next_idx % len(pool)]

    # Format reply with target @username if available
    tag_prefix = f"@{sender_username.lstrip('@')} " if sender_username else (f"@{clean_target_uname} " if clean_target_uname else "")
    final_reply_text = f"{tag_prefix}{selected_msg}".strip()

    logger.info(f"[RaidService] Auto-replying in chat {chat_id} to message {message_id} (Cycle #{next_idx % len(pool) + 1}/{len(pool)})")

    try:
        target_to_reply = message_id or target_msg_id
        await reply_fn(chat_id, target_to_reply, final_reply_text)
        return True
    except Exception as e:
        logger.error(f"[RaidService] Error sending raid reply in chat {chat_id}: {e}")
        return False
