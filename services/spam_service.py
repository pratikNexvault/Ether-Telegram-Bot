import asyncio
from typing import Callable, Awaitable, Any
import config
from utils.logger import logger
from utils.formatting import format_spam_completed
from core.state import chat_state_manager

async def execute_spam(
    chat_id: int,
    count: int,
    text: str,
    send_message_fn: Callable[[int, str], Awaitable[Any]]
) -> None:
    """
    Controlled rate-limited spam runner.
    Executes sequentially with configurable delay and clean cancellation support.
    """
    logger.info(f"[SpamService] Starting spam in chat {chat_id} (count={count})")
    try:
        for i in range(count):
            await send_message_fn(chat_id, text)
            # Delay between messages (can be interrupted by .stopspam cancellation)
            if i < count - 1:
                await asyncio.sleep(config.SPAM_DELAY)

        # Notify completion only if not cancelled
        await send_message_fn(chat_id, format_spam_completed())
        logger.info(f"[SpamService] Spam completed in chat {chat_id}")

    except asyncio.CancelledError:
        logger.info(f"[SpamService] Spam task in chat {chat_id} was successfully cancelled.")
        # Re-raise so caller/event loop knows it was cleanly cancelled
        raise
    except Exception as e:
        logger.error(f"[SpamService] Unexpected error during spam execution in chat {chat_id}: {e}")
    finally:
        await chat_state_manager.clear_spam_task(chat_id)
