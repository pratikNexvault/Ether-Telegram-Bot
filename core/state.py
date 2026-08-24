import asyncio
import time
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class ChatState:
    chat_id: int
    raid_enabled: bool = False
    raid_target_message_id: Optional[int] = None
    raid_target_user_id: Optional[int] = None
    raid_target_username: Optional[str] = None
    raid_reply_index: int = 0
    raid_last_reply_time: float = 0.0
    active_spam_task: Optional[asyncio.Task] = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

class ChatStateManager:
    """
    Thread-safe per-chat state manager.
    Maintains isolated states for raid and spam for every Telegram chat/group.
    """
    def __init__(self):
        self._states: dict[int, ChatState] = {}
        self._global_lock = asyncio.Lock()

    async def get_state(self, chat_id: int) -> ChatState:
        async with self._global_lock:
            if chat_id not in self._states:
                self._states[chat_id] = ChatState(chat_id=chat_id)
            return self._states[chat_id]

    async def enable_raid(
        self,
        chat_id: int,
        target_message_id: Optional[int] = None,
        target_user_id: Optional[int] = None,
        target_username: Optional[str] = None
    ) -> None:
        state = await self.get_state(chat_id)
        async with state.lock:
            state.raid_enabled = True
            state.raid_target_message_id = target_message_id
            state.raid_target_user_id = target_user_id
            state.raid_target_username = target_username.lstrip("@").strip() if target_username else None
            state.raid_reply_index = 0
            state.raid_last_reply_time = 0.0

    async def disable_raid(self, chat_id: int) -> bool:
        """
        Disables raid mode for the given chat.
        Returns True if raid was active and got disabled, False if it wasn't active.
        """
        state = await self.get_state(chat_id)
        async with state.lock:
            if not state.raid_enabled:
                return False
            state.raid_enabled = False
            state.raid_target_message_id = None
            state.raid_target_user_id = None
            state.raid_target_username = None
            state.raid_reply_index = 0
            return True

    async def is_raid_active(self, chat_id: int) -> tuple[bool, Optional[int], Optional[int], Optional[str]]:
        state = await self.get_state(chat_id)
        async with state.lock:
            return (
                state.raid_enabled,
                state.raid_target_message_id,
                state.raid_target_user_id,
                state.raid_target_username
            )

    async def get_next_raid_index(self, chat_id: int) -> int:
        state = await self.get_state(chat_id)
        async with state.lock:
            idx = state.raid_reply_index
            state.raid_reply_index += 1
            return idx

    async def can_raid_reply(self, chat_id: int, cooldown: float) -> bool:
        state = await self.get_state(chat_id)
        async with state.lock:
            if not state.raid_enabled:
                return False
            now = time.time()
            if now - state.raid_last_reply_time >= cooldown:
                state.raid_last_reply_time = now
                return True
            return False

    async def start_spam_task(self, chat_id: int, task: asyncio.Task) -> bool:
        """
        Registers a new spam task. If another spam task is already running, returns False.
        """
        state = await self.get_state(chat_id)
        async with state.lock:
            if state.active_spam_task and not state.active_spam_task.done():
                return False
            state.active_spam_task = task
            return True

    async def cancel_spam_task(self, chat_id: int) -> bool:
        """
        Cancels any active spam task for this chat.
        Returns True if a task was actively running and cancelled, False otherwise.
        """
        state = await self.get_state(chat_id)
        async with state.lock:
            task = state.active_spam_task
            if task and not task.done():
                task.cancel()
                try:
                    await asyncio.wait_for(asyncio.shield(task), timeout=0.1)
                except (asyncio.CancelledError, asyncio.TimeoutError, Exception):
                    pass
                state.active_spam_task = None
                return True
            state.active_spam_task = None
            return False

    async def is_spam_running(self, chat_id: int) -> bool:
        state = await self.get_state(chat_id)
        async with state.lock:
            return bool(state.active_spam_task and not state.active_spam_task.done())

    async def clear_spam_task(self, chat_id: int) -> None:
        state = await self.get_state(chat_id)
        async with state.lock:
            state.active_spam_task = None

# Global state instance
chat_state_manager = ChatStateManager()
