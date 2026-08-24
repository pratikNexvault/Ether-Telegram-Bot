import asyncio
from typing import Any
import config
from utils.logger import logger
from utils.formatting import (
    format_spam_started,
    format_spam_stopped,
    format_no_spam_active,
    format_spam_already_running,
    format_admin_only_error,
    format_owner_only_error,
    format_usage_error,
    format_command_panel
)
from core.permissions import is_admin_or_owner
from core.state import chat_state_manager
from services.spam_service import execute_spam

async def handle_spam_command(update: Any, context: Any) -> None:
    """
    Handles .spam <count> <text> command.
    Strictly validates inputs, checks permissions, and launches a background asyncio task.
    """
    message = getattr(update, "effective_message", None) or getattr(update, "message", None)
    if not message:
        return

    chat_id = message.chat_id

    # 1. Admin / Owner Permission Check
    has_perm = await is_admin_or_owner(update, context)
    if not has_perm:
        if config.OWNER_ONLY_MODE:
            await message.reply_text(format_owner_only_error(), parse_mode="HTML")
        else:
            await message.reply_text(format_admin_only_error(), parse_mode="HTML")
        return

    # 2. Parse command arguments
    raw_text = (message.text or "").strip()
    parts = raw_text.split(maxsplit=2)

    # Validation: Missing arguments
    if len(parts) < 2:
        await message.reply_text(
            format_usage_error("SPAM", ".spam <count> <text>", ".spam 5 Hello"),
            parse_mode="HTML"
        )
        return

    # Validation: Missing text
    if len(parts) < 3:
        await message.reply_text(
            format_command_panel("SPAM", ["Status: MISSING TEXT", "Provide message text after count."]),
            parse_mode="HTML"
        )
        return

    count_str = parts[1]
    spam_text = parts[2]

    # Validation: Invalid count format
    try:
        count = int(count_str)
    except ValueError:
        await message.reply_text(
            format_command_panel("SPAM", ["Status: INVALID COUNT", "Count must be a valid number."]),
            parse_mode="HTML"
        )
        return

    # Validation: Zero or negative
    if count <= 0:
        await message.reply_text(
            format_command_panel("SPAM", ["Status: INVALID COUNT", "Count must be greater than 0."]),
            parse_mode="HTML"
        )
        return

    # Validation: Exceeds configured max
    if count > config.MAX_SPAM_COUNT:
        await message.reply_text(
            format_command_panel("SPAM", [f"Status: LIMIT EXCEEDED", f"Maximum allowed count is {config.MAX_SPAM_COUNT}."]),
            parse_mode="HTML"
        )
        return

    # 3. Check if spam is already running
    if await chat_state_manager.is_spam_running(chat_id):
        await message.reply_text(format_spam_already_running(), parse_mode="HTML")
        return

    # 4. Announce start
    await message.reply_text(format_spam_started(count, spam_text), parse_mode="HTML")

    # Define message sender closure for the service
    async def send_msg(c_id: int, txt: str):
        bot = getattr(context, "bot", None)
        if bot:
            await bot.send_message(chat_id=c_id, text=txt, parse_mode="HTML")
        else:
            await message.reply_text(txt, parse_mode="HTML")

    # 5. Launch background spam task
    task = asyncio.create_task(execute_spam(chat_id, count, spam_text, send_msg))
    await chat_state_manager.start_spam_task(chat_id, task)

async def handle_stopspam_command(update: Any, context: Any) -> None:
    """
    Handles .stopspam command.
    Stops any active spam task in this group immediately.
    """
    message = getattr(update, "effective_message", None) or getattr(update, "message", None)
    if not message:
        return

    chat_id = message.chat_id

    # 1. Admin / Owner Permission Check
    has_perm = await is_admin_or_owner(update, context)
    if not has_perm:
        if config.OWNER_ONLY_MODE:
            await message.reply_text(format_owner_only_error(), parse_mode="HTML")
        else:
            await message.reply_text(format_admin_only_error(), parse_mode="HTML")
        return

    # 2. Cancel active spam task
    was_cancelled = await chat_state_manager.cancel_spam_task(chat_id)
    if was_cancelled:
        await message.reply_text(format_spam_stopped(), parse_mode="HTML")
        logger.info(f"Spam stopped by admin in chat {chat_id}")
    else:
        await message.reply_text(format_no_spam_active(), parse_mode="HTML")
