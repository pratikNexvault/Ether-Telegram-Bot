import os
import re
import time

# Safely load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # Built-in lightweight .env loader fallback
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("\"'")
                        if k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

def _safe_int(val: str, default: int) -> int:
    try:
        cleaned = re.sub(r"[^\d-]", "", str(val))
        return int(cleaned) if cleaned else default
    except Exception:
        return default

def _safe_float(val: str, default: float) -> float:
    try:
        cleaned = re.search(r"[-+]?\d*\.?\d+", str(val))
        return float(cleaned.group(0)) if cleaned else default
    except Exception:
        return default

# Telegram Bot Token
BOT_TOKEN: str = os.getenv("BOT_TOKEN", "").strip()

# Bot Owner & Authorized Super Users (STRICT: Only @XYRO_7X can use bot commands)
OWNER_USERNAME: str = os.getenv("OWNER_USERNAME", "XYRO_7X").lstrip("@").strip()
OWNER_ID: int = _safe_int(os.getenv("OWNER_ID", "0"), 0)

# If OWNER_ONLY_MODE is True, only the owner (@XYRO_7X) can execute commands.
OWNER_ONLY_MODE: bool = os.getenv("OWNER_ONLY_MODE", "true").lower() in ("true", "1", "yes")

# Spam Configuration
MAX_SPAM_COUNT: int = _safe_int(os.getenv("MAX_SPAM_COUNT", "20"), 20)
SPAM_DELAY: float = _safe_float(os.getenv("SPAM_DELAY", "1.0"), 1.0)

# Raid Configuration
RAID_COOLDOWN: float = _safe_float(os.getenv("RAID_COOLDOWN", "3.0"), 3.0)

# Custom Raid Messages (Configurable list loaded by raid service)
CUSTOM_RAID_MESSAGES: list[str] = [
    "⚡ Powered by ETHER Group Security. What are you doing here?",
    "🔥 Attention: Raid surveillance active in this chat!",
    "🛡️ Message detected. ETHER Bot is watching all activity.",
    "⚔️ Auto-response triggered! Respect group guidelines.",
    "🎯 Target message locked. Raid reply protocol engaged!",
    "🚀 Group protected by ETHER custom system.",
    "💥 You invoked the raid protocol. Proceed with caution!"
]

# Supported command prefixes
COMMAND_PREFIXES: tuple[str, ...] = (".", "/")

# Bot process start timestamp for dynamic uptime calculation
BOT_START_TIME: float = time.time()
