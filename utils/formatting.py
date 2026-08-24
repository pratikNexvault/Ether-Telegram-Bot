import html
import time
from typing import Optional, List, Union
import config
from core.registry import registry, ModuleInfo, CommandInfo

def to_bold_serif(text: str) -> str:
    """
    Converts standard ASCII characters to Mathematical Bold Serif Unicode (e.g. 𝐓𝐞𝐱𝐭 𝐬𝐭𝐲𝐥𝐞, 𝟏, 𝟐).
    """
    out = []
    for char in text:
        code = ord(char)
        if 65 <= code <= 90:  # A-Z
            out.append(chr(0x1D400 + (code - 65)))
        elif 97 <= code <= 122:  # a-z
            out.append(chr(0x1D41A + (code - 97)))
        elif 48 <= code <= 57:  # 0-9
            out.append(chr(0x1D7CE + (code - 48)))
        else:
            out.append(char)
    return "".join(out)

def escape_html(text: str) -> str:
    """Escapes user text safely for Telegram HTML mode."""
    if not text:
        return ""
    return html.escape(str(text))

def format_uptime(seconds: float) -> str:
    """Formats seconds into human-readable format like '1m 13s', '2h 15m', etc."""
    secs = max(0, int(seconds))
    days = secs // 86400
    hours = (secs % 86400) // 3600
    minutes = (secs % 3600) // 60
    rem_secs = secs % 60

    if days > 0:
        return f"{days}d {hours}h {minutes}m"
    elif hours > 0:
        return f"{hours}h {minutes}m {rem_secs}s"
    elif minutes > 0:
        return f"{minutes}m {rem_secs}s"
    else:
        return f"{rem_secs}s"

def format_command_panel(
    title: str,
    content: Union[List[str], str],
    footer: Optional[str] = None,
    note: Optional[str] = None,
    apply_bold_font: bool = True,
    bullet: str = "◇➤"
) -> str:
    """
    Standardized ETHER UI System with Mathematical Bold Serif Typography:
      ❀━━━━━━〔 𝐏𝐈𝐍𝐆 〕━━━━━━❀
      ◇➤ 𝐋𝐚𝐭𝐞𝐧𝐜𝐲: 82 ms
      ◇➤ 𝐔𝐩𝐭𝐢𝐦𝐞: 1m 13s
      𝐘𝐎𝐔𝐑 𝐗𝐘𝐑𝐎 𝐈𝐒 𝐑𝐔𝐍𝐍𝐈𝐍𝐆
      ❀━━━━━━━━━━━━━━━━━━━━❀
    """
    raw_title = title.strip()
    styled_title = to_bold_serif(raw_title.upper()) if apply_bold_font else raw_title.upper()
    title_bracket = f"〔 {styled_title} 〕"

    # Dynamic side bar count calculation
    title_len = len(raw_title)
    if title_len <= 4:
        side_bars = "━━━━━━"
    elif title_len <= 6:
        side_bars = "━━━━━━"
    elif title_len <= 8:
        side_bars = "━━━━━"
    elif title_len <= 10:
        side_bars = "━━━━"
    else:
        side_bars = "━━━"

    header = f"❀{side_bars}{title_bracket}{side_bars}❀"
    
    # Calculate visual width for bottom bar
    # Mathematical bold serif characters take 1 visual cell in monospace
    total_bar_count = len(side_bars) * 2 + len(f"〔 {raw_title.upper()} 〕")
    footer_bar = f"❀{'━' * total_bar_count}❀"

    if isinstance(content, str):
        raw_lines = [content]
    else:
        raw_lines = content

    content_lines = []
    bullet_prefix = f"{bullet.rstrip()} "
    for line in raw_lines:
        sline = str(line).strip()
        if not sline:
            content_lines.append("")
        elif sline.startswith("◇➤") or sline.startswith("◇ ") or sline.startswith("   "):
            content_lines.append(sline)
        else:
            if apply_bold_font and ":" in sline:
                key, val = sline.split(":", 1)
                content_lines.append(f"{bullet_prefix}{to_bold_serif(key)}:{val}")
            elif apply_bold_font:
                content_lines.append(f"{bullet_prefix}{to_bold_serif(sline)}")
            else:
                content_lines.append(f"{bullet_prefix}{sline}")

    panel_parts = [header]
    panel_parts.extend(content_lines)

    if footer:
        styled_footer = to_bold_serif(footer) if apply_bold_font else footer
        panel_parts.append(styled_footer.strip())

    panel_parts.append(footer_bar)

    rendered_panel = f"<pre>{html.escape(chr(10).join(panel_parts))}</pre>"

    if note:
        styled_note = to_bold_serif(note.strip()) if apply_bold_font else note.strip()
        rendered_panel += f"\n\n{escape_html(styled_note)}"

    return rendered_panel

def format_ping_response(latency_ms: float, uptime_seconds: float) -> str:
    """Standardized response for .ping command."""
    return format_command_panel(
        title="PING",
        content=[
            f"Latency: {round(latency_ms)} ms",
            f"Uptime: {format_uptime(uptime_seconds)}"
        ],
        footer="YOUR ETHER IS RUNNING"
    )

def format_main_help_menu() -> str:
    """Standardized response for main .help command."""
    modules = registry.get_all_modules()
    
    # Priority display order matching user preference
    preferred_order = ["system", "spam", "raid"]
    sorted_mod_names = sorted(
        modules.keys(),
        key=lambda k: (preferred_order.index(k) if k in preferred_order else 999, k)
    )

    lines = []
    for mod_name in sorted_mod_names:
        mod_info = modules[mod_name]
        cmd_count = len(mod_info.commands)
        plural = "command" if cmd_count == 1 else "commands"
        lines.append(f"{to_bold_serif(mod_name)} ( {to_bold_serif(str(cmd_count))} {to_bold_serif(plural)} )")

    return format_command_panel(
        title="MODULES",
        content=lines,
        bullet="◇",
        apply_bold_font=False
    )

def format_module_help(module_name: str) -> Optional[str]:
    """Standardized response for detailed .help <module> command."""
    mod_info = registry.get_module(module_name)
    if not mod_info:
        return None

    lines = []
    for cmd in mod_info.commands:
        perm_badge = f" [{to_bold_serif('ADMIN')}]" if cmd.permission == "admin" else ""
        lines.append(f".{cmd.name}{perm_badge}")
        lines.append(f"   {to_bold_serif(cmd.description)}")

    return format_command_panel(
        title=f"{mod_info.name.upper()} MODULE",
        content=lines,
        footer="YOUR ETHER IS RUNNING",
        apply_bold_font=False
    )

def format_raid_enabled(message_count: int = 20) -> str:
    """Standardized response for .raid command."""
    return format_command_panel(
        title="RAID",
        content=[
            "Status: ENABLED",
            "Mode: Custom Reply",
            f"Messages: {message_count}"
        ],
        footer="⚡ YOUR ETHER IS RUNNING"
    )

def format_raid_disabled() -> str:
    """Standardized response for .draid command."""
    return format_command_panel(
        title="DRAID",
        content=[
            "Status: DISABLED",
            "RAID mode stopped successfully."
        ]
    )

def format_spam_started(count: int, text: str) -> str:
    """Standardized response for .spam command."""
    return format_command_panel(
        title="SPAM",
        content=[
            f"Count: {count}",
            f"Text: {text}",
            "Status: STARTED"
        ],
        footer="⚡ YOUR ETHER IS RUNNING"
    )

def format_spam_stopped() -> str:
    """Standardized response for .stopspam command."""
    return format_command_panel(
        title="STOPSPAM",
        content=[
            "Status: STOPPED",
            "Active spam task cancelled."
        ]
    )
