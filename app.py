#!/usr/bin/env python3
"""
Entry point for the Inkdrop application.
This file maintains backward compatibility while using the new organized structure.
"""

# Import the main Flask app from the new structure
from src.api.app import app, logger

if __name__ == '__main__':
    from src.infrastructure.env import FLASK_HOST, FLASK_PORT, DEBUG
    logger.info(f"Starting Flask application on {FLASK_HOST}:{FLASK_PORT} in {'DEBUG' if DEBUG else 'PRODUCTION'} mode")
    app.run(
        host=FLASK_HOST,
        port=FLASK_PORT,
        debug=DEBUG
    )
