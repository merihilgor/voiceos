"""
Logger Configuration - Rotating file handler for VoiceOS backend

Usage:
    from logger_config import get_logger
    logger = get_logger(__name__)
    logger.debug('Detailed info')
    logger.info('Normal operation')
    logger.warning('Recoverable issue')
    logger.error('Failure')

Config:
    LOG_LEVEL: DEBUG|INFO|WARNING|ERROR (default: INFO)
    LOG_DIR: Directory for log files (default: ./logs)
"""

import os
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Configuration from environment
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO').upper()
LOG_DIR = os.environ.get('LOG_DIR', './logs')
MAX_BYTES = 1_000_000  # 1MB per file
BACKUP_COUNT = 5       # Keep 5 rotated files

# Ensure log directory exists
Path(LOG_DIR).mkdir(parents=True, exist_ok=True)

# Formatter with timestamp, level, module, and message
LOG_FORMAT = '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

# Create formatters
formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)

# Console handler (for stdout)
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
console_handler.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

# File handler with rotation
file_handler = RotatingFileHandler(
    os.path.join(LOG_DIR, 'voiceos.log'),
    maxBytes=MAX_BYTES,
    backupCount=BACKUP_COUNT,
    encoding='utf-8'
)
file_handler.setFormatter(formatter)
file_handler.setLevel(logging.DEBUG)  # File captures everything

# Error-only file handler
error_handler = RotatingFileHandler(
    os.path.join(LOG_DIR, 'voiceos_errors.log'),
    maxBytes=MAX_BYTES,
    backupCount=BACKUP_COUNT,
    encoding='utf-8'
)
error_handler.setFormatter(formatter)
error_handler.setLevel(logging.ERROR)  # Only errors


def get_logger(name: str) -> logging.Logger:
    """Get a configured logger instance."""
    logger = logging.getLogger(name)
    
    # Avoid adding handlers multiple times
    if not logger.handlers:
        logger.setLevel(logging.DEBUG)
        logger.addHandler(console_handler)
        logger.addHandler(file_handler)
        logger.addHandler(error_handler)
    
    return logger


# Root logger for the application
root_logger = get_logger('voiceos')


def log_startup_info():
    """Log configuration on startup."""
    root_logger.info('=' * 50)
    root_logger.info('VoiceOS Backend Starting')
    root_logger.info(f'Log Level: {LOG_LEVEL}')
    root_logger.info(f'Log Directory: {LOG_DIR}')
    root_logger.info(f'Max File Size: {MAX_BYTES / 1_000_000:.1f}MB')
    root_logger.info(f'Backup Count: {BACKUP_COUNT}')
    root_logger.info('=' * 50)
