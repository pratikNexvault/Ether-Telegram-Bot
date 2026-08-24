from dataclasses import dataclass, field
from typing import Callable, Any, Optional

@dataclass
class CommandInfo:
    name: str
    syntax: str
    description: str
    module: str
    permission: str = "everyone"  # "everyone", "admin", "owner"
    handler: Optional[Callable[..., Any]] = None

@dataclass
class ModuleInfo:
    name: str
    description: str
    icon: str = "⚡"
    commands: list[CommandInfo] = field(default_factory=list)

class ModuleRegistry:
    """
    Centralized dynamic command & module registry.
    Automatically maintains command counts and descriptions.
    Adding a new command automatically updates .help counts.
    """
    def __init__(self):
        self._modules: dict[str, ModuleInfo] = {}
        self._commands: dict[str, CommandInfo] = {}

    def register_module(self, name: str, description: str, icon: str = "⚡") -> ModuleInfo:
        clean_name = name.lower().strip()
        if clean_name not in self._modules:
            self._modules[clean_name] = ModuleInfo(
                name=clean_name,
                description=description,
                icon=icon,
                commands=[]
            )
        return self._modules[clean_name]

    def register_command(
        self,
        name: str,
        syntax: str,
        description: str,
        module: str,
        permission: str = "everyone",
        handler: Optional[Callable[..., Any]] = None
    ) -> CommandInfo:
        clean_mod = module.lower().strip()
        clean_cmd = name.lower().strip().lstrip("./")

        # Auto-create module if not registered yet
        if clean_mod not in self._modules:
            self.register_module(clean_mod, f"{clean_mod.capitalize()} commands")

        cmd_info = CommandInfo(
            name=clean_cmd,
            syntax=syntax,
            description=description,
            module=clean_mod,
            permission=permission,
            handler=handler
        )

        # Update command map
        self._commands[clean_cmd] = cmd_info

        # Update module command list (prevent duplicates)
        mod = self._modules[clean_mod]
        mod.commands = [c for c in mod.commands if c.name != clean_cmd]
        mod.commands.append(cmd_info)

        return cmd_info

    def get_module(self, name: str) -> Optional[ModuleInfo]:
        return self._modules.get(name.lower().strip())

    def get_all_modules(self) -> dict[str, ModuleInfo]:
        return dict(sorted(self._modules.items()))

    def get_module_command_count(self, module_name: str) -> int:
        mod = self.get_module(module_name)
        return len(mod.commands) if mod else 0

    def get_command(self, name: str) -> Optional[CommandInfo]:
        clean_name = name.lower().strip().lstrip("./")
        return self._commands.get(clean_name)

    def get_commands_for_module(self, module_name: str) -> list[CommandInfo]:
        mod = self.get_module(module_name)
        return mod.commands if mod else []

# Global shared registry instance
registry = ModuleRegistry()

# Pre-populate base modules and commands as requested
def initialize_default_registry():
    # 1. RAID MODULE
    registry.register_module("raid", "Custom automatic reply system", icon="⚡")
    registry.register_command(
        name="raid",
        syntax=".raid",
        description="Enable custom reply mode (reply to a message)",
        module="raid",
        permission="admin"
    )
    registry.register_command(
        name="draid",
        syntax=".draid",
        description="Disable custom reply mode",
        module="raid",
        permission="admin"
    )

    # 2. SPAM MODULE
    registry.register_module("spam", "Controlled repeated messaging", icon="⚡")
    registry.register_command(
        name="spam",
        syntax=".spam <count> <text>",
        description="Start controlled repeated messaging",
        module="spam",
        permission="admin"
    )
    registry.register_command(
        name="stopspam",
        syntax=".stopspam",
        description="Stop active spam task",
        module="spam",
        permission="admin"
    )

    # 3. SYSTEM MODULE
    registry.register_module("system", "Basic system and diagnostic commands", icon="⚙")
    registry.register_command(
        name="ping",
        syntax=".ping",
        description="Check bot response and latency",
        module="system",
        permission="everyone"
    )

# Initialize on import
initialize_default_registry()
