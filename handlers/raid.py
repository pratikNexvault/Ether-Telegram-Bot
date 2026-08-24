from typing import Any
import config
from utils.logger import logger
from utils.formatting import (
    format_raid_enabled,
    format_raid_disabled,
    format_raid_not_active,
    format_admin_only_error,
    format_owner_only_error,
    format_command_panel
)
from core.permissions import is_admin_or_owner
from core.state import chat_state_manager

async def handle_raid_command(update: Any, context: Any) -> None:
    """
    Handles .raid command.
    Can be invoked by replying to a target message OR specifying @username:
    - .raid (in reply to target message)
    - .raid @username
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

    # 2. Extract target from command args or message reply
    text = (message.text or "").strip()
    parts = text.split()
    target_username = None
    target_user_id = None
    target_msg_id = None

    if len(parts) > 1:
        raw_target = parts[1].strip()
        target_username = raw_target.lstrip("@")
    
    reply_to = getattr(message, "reply_to_message", None)
    if reply_to:
        target_msg_id = reply_to.message_id
        target_from = getattr(reply_to, "from_user", None)
        if target_from:
            target_user_id = target_from.id
            if not target_username and target_from.username:
                target_username = target_from.username

    if not target_username and not target_msg_id:
        error_panel = format_command_panel(
            title="RAID",
            content=[
                "Status: TARGET REQUIRED",
                "Reply to a message with .raid or specify user:",
                "Example: .raid @username"
            ]
        )
        await message.reply_text(error_panel, parse_mode="HTML")
        return

    # 3. Activate Raid Mode for this chat with target
    await chat_state_manager.enable_raid(
        chat_id=chat_id,
        target_message_id=target_msg_id,
        target_user_id=target_user_id,
        target_username=target_username
    )

    msg_count = len(config.CUSTOM_RAID_MESSAGES) if config.CUSTOM_RAID_MESSAGES else 20
    target_display = f"@{target_username}" if target_username else f"Msg #{target_msg_id}"
    
    confirm_panel = format_command_panel(
        title="RAID",
        content=[
            "Status: ENABLED",
            f"Target: {target_display}",
            "Mode: Round-Robin Cycle (1 Msg = 1 Reply)",
            f"Messages: {msg_count}"
        ],
        footer="⚡ YOUR ETHER IS RUNNING"
    )
    await message.reply_text(confirm_panel, parse_mode="HTML")
    logger.info(f"Raid mode enabled in chat {chat_id} on target {target_display} (Pool: {msg_count} messages)")

async def handle_draid_command(update: Any, context: Any) -> None:
    """
    Handles .draid command.
    Disables raid mode for the current chat.
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

    # 2. Disable Raid Mode
    was_active = await chat_state_manager.disable_raid(chat_id)
    if was_active:
        await message.reply_text(format_raid_disabled(), parse_mode="HTML")
        logger.info(f"Raid mode disabled in chat {chat_id}")
    else:
        await message.reply_text(format_raid_not_active(), parse_mode="HTML")
