from typing import Any
from utils.formatting import format_main_help_menu, format_module_help, escape_html
from utils.logger import logger
from core.registry import registry

async def handle_help_command(update: Any, context: Any) -> None:
    """
    Handles .help and .help <module> commands.
    """
    message = getattr(update, "effective_message", None) or getattr(update, "message", None)
    if not message:
        return

    text = message.text or ""
    parts = text.strip().split()

    # Determine if a specific module was requested
    # e.g., ".help raid" -> parts[1] is "raid"
    module_arg = None
    if len(parts) > 1:
        module_arg = parts[1].lower().strip()

    if module_arg:
        # Check if requested module exists in registry
        mod_help = format_module_help(module_arg)
        if mod_help:
            await message.reply_text(mod_help, parse_mode="HTML")
            logger.info(f"Served module help for '{module_arg}' in chat {message.chat_id}")
            return
        else:
            # Fallback for unknown module
            available = ", ".join([f"<code>{m}</code>" for m in registry.get_all_modules().keys()])
            err_msg = (
                f"❌ <b>Module '{escape_html(module_arg)}' not found.</b>\n"
                f"Available modules: {available}\n"
                f"Type <code>.help</code> to view all modules."
            )
            await message.reply_text(err_msg, parse_mode="HTML")
            return

    # Render main menu with dynamic counts
    help_text = format_main_help_menu()
    await message.reply_text(help_text, parse_mode="HTML")
    logger.info(f"Served main help menu in chat {message.chat_id}")
