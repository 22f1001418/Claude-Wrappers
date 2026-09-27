# gevent monkey-patch MUST be first, before any other imports
from gevent import monkey
monkey.patch_all(ssl=False)

from flask_app import create_app

app, socketio = create_app()

if __name__ == '__main__':
    socketio.run(app, debug=False, host='0.0.0.0', port=5001)
