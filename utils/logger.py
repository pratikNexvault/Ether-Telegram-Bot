import logging
import sys
import config

class RedactTokenFilter(logging.Filter):
    """Filter that redacts sensitive Telegram Bot Token from log outputs."""
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str) and config.BOT_TOKEN:
            record.msg = record.msg.replace(config.BOT_TOKEN, "[REDACTED_BOT_TOKEN]")
        return True

def setup_logger(name: str = "TelegramBot") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)

        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )

        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(formatter)
        stream_handler.addFilter(RedactTokenFilter())
        logger.addHandler(stream_handler)

    return logger

logger = setup_logger()
