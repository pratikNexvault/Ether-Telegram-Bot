# 🚀 XYRO Custom Telegram Group Bot

A modular Telegram Group Bot built with Python, featuring a dynamic module registry, custom Unicode `.help` menu inspired by the reference design, safe rate-limited spam system with instantaneous task cancellation, and context-aware group raid auto-reply surveillance.

---

## 📸 .help Command Interface

When a user runs `.help`, the bot dynamically renders the module menu:

```
❊═══〖 MODULES 〗═══❊
◇➤ raid (2 commands)
◇➤ spam (2 commands)
◇➤ system (1 command)

Type .help <module> for commands
❊═════════════════════════════════❊
```

*Command counts are **automatically calculated** from the module registry. Adding new commands or modules requires zero manual help-text editing.*

---

## ⚡ Features & Modules

### 1. 🛡️ Raid Module (`.help raid`)
- **`.raid`** *(Admin / Owner only)*: Activate custom reply mode by replying to any message in the group. Locks onto target message and enables group auto-replies.
- **`.draid`** *(Admin / Owner only)*: Instantly disables raid mode and clears tracking state.
- **Auto-Reply Surveillance**: Automatically monitors eligible incoming group messages and replies using randomized responses from `CUSTOM_RAID_MESSAGES`.
- **Anti-Loop & Cooldown**: Protected by `RAID_COOLDOWN` (default: 3.0s), ignores bot messages, commands, and service updates.

### 2. ⚡ Spam Module (`.help spam`)
- **`.spam <count> <text>`** *(Admin / Owner only)*: Starts controlled sequential messaging with configurable `SPAM_DELAY` (default: 1.0s) and max cap `MAX_SPAM_COUNT` (default: 20).
- **`.stopspam`** *(Admin / Owner only)*: Cancels any active spam task in the group immediately, even if sleeping.
- **Strict Input Validation**: Rejects missing parameters, negative numbers, non-integers, and excessive counts with clear error cards.
- **Concurrent Task Isolation**: Uses per-chat `asyncio.Task` instances with concurrency locks.

### 3. ⚙️ System Module (`.help system`)
- **`.ping`** *(Everyone)*: Responds with `🏓 Pong!` and calculates round-trip network response latency.

---

## 👑 Owner & Permission Architecture

- **Owner Configuration**: Configured for `@XYRO_7X` (`OWNER_USERNAME=XYRO_7X`).
- **Owner-Only Mode**: Set `OWNER_ONLY_MODE=true` in `.env` to restrict all admin commands exclusively to `@XYRO_7X`.
- **Group Admin Mode**: If `OWNER_ONLY_MODE=false`, both Telegram Group Administrators/Creators and `@XYRO_7X` can execute admin commands.
- Normal members receive: `❌ This command is available to group administrators only.`

---

## 🛠️ Project Structure

```
telegram_bot/
├── main.py                  # Main Telegram Bot runner & update dispatcher
├── config.py                # Environment & dynamic configuration loader
├── requirements.txt         # Python dependencies
├── .env.example             # Configuration template
├── README.md                # Comprehensive documentation
│
├── core/
│   ├── registry.py          # Dynamic module & command registry with auto-counting
│   ├── state.py             # Thread-safe per-chat state & asyncio task manager
│   └── permissions.py       # Owner (@XYRO_7X) & Telegram group admin validator
│
├── handlers/
│   ├── help.py              # .help and .help <module> formatting & dispatch
│   ├── raid.py              # .raid and .draid commands
│   ├── spam.py              # .spam and .stopspam commands
│   └── system.py            # .ping command
│
├── services/
│   ├── raid_service.py      # Incoming message listener, cooldown & loop protection
│   └── spam_service.py      # Asyncio sequential spam runner & cancellation
│
└── utils/
    ├── formatting.py        # Telegram HTML escaping & Unicode reference card builder
    └── logger.py            # Token-redacted logger
```

---

## 🚀 How to Run Locally

### 1. Prerequisites
- Python 3.10+
- Telegram Bot Token from [@BotFather](https://t.me/BotFather)

### 2. Setup
```bash
# Clone or navigate to the directory
cd telegram_bot

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure your environment
cp .env.example .env
# Edit .env and verify BOT_TOKEN and OWNER_USERNAME
```

### 3. Start the Bot
```bash
python3 main.py
```

---

## 🧩 How to Add New Modules & Commands

Adding a new module and command is seamless and **automatically reflects in `.help`**:

1. Open `core/registry.py` (or your new handler file) and register:
```python
from core.registry import registry

# 1. Register new module
registry.register_module("moderation", "Chat moderation tools", icon="🛡️")

# 2. Register command under module
registry.register_command(
    name="mute",
    syntax=".mute <duration>",
    description="Mutes a disruptive member",
    module="moderation",
    permission="admin"
)
```

2. That's it! `.help` will now automatically display:
```
❊═══〖 MODULES 〗═══❊
◇➤ moderation (1 command)
◇➤ raid (2 commands)
◇➤ spam (2 commands)
◇➤ system (1 command)

Type .help <module> for commands
❊═════════════════════════════════❊
```
And `.help moderation` will display the command's syntax and description.
