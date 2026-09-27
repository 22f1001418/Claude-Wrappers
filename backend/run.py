# Entry point for the Flask server.
# Using standard threading mode (simple-websocket) for better compatibility

from flask_app import create_app

app, socketio = create_app()

socketio.run(app, debug=True, host='0.0.0.0', port=5001, allow_unsafe_werkzeug=True)
