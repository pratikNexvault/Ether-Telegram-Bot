import time
from typing import Any
import config
from utils.logger import logger
from utils.formatting import format_ping_response

async def handle_ping_command(update: Any, context: Any) -> None:
    """
    Handles .ping command.
    Responds with dynamic latency and dynamic uptime in ETHER panel UI.
    """
    message = getattr(update, "effective_message", None) or getattr(update, "message", None)
    if not message:
        return

    start_time = time.time()
    
    # Calculate dynamic uptime
    uptime_secs = time.time() - config.BOT_START_TIME

    # Initial placeholder or quick measure
    temp_msg = await message.reply_text("<code>Checking latency...</code>", parse_mode="HTML")
    latency_ms = max(5.0, (time.time() - start_time) * 1000)

    final_text = format_ping_response(latency_ms, uptime_secs)
    try:
        await temp_msg.edit_text(final_text, parse_mode="HTML")
    except Exception:
        await message.reply_text(final_text, parse_mode="HTML")

    logger.info(f"Ping command handled (latency: {latency_ms:.1f}ms, uptime: {uptime_secs:.0f}s)")
