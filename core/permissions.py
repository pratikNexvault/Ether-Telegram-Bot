from typing import Any
import config

def is_owner(user: Any) -> bool:
    """
    Strictly checks if the user matches the configured bot owner (@XYRO_7X or OWNER_ID).
    """
    if not user:
        return False

    user_id = getattr(user, "id", 0)
    if config.OWNER_ID and user_id == config.OWNER_ID:
        return True

    username = getattr(user, "username", None)
    if username and config.OWNER_USERNAME:
        clean_user = str(username).lower().lstrip("@").strip()
        clean_owner = config.OWNER_USERNAME.lower().lstrip("@").strip()
        if clean_user == clean_owner:
            return True

    return False

async def is_admin_or_owner(update: Any, context: Any) -> bool:
    """
    Strictly requires Bot Owner (@XYRO_7X) status for all commands.
    """
    message = getattr(update, "effective_message", None) or getattr(update, "message", None)
    user = getattr(update, "effective_user", None) or (message.from_user if message else None)

    if not user:
        return False

    return is_owner(user)
