"""
Flask Application for VyापारAI
Main Flask backend server with authentication and database support
"""

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from datetime import timedelta
import os
from sqlalchemy import text
from dotenv import load_dotenv

def create_app():
    """
    Application factory pattern
    """
    app = Flask(__name__)

    # Load backend .env values (including Razorpay keys)
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    load_dotenv(os.path.join(project_root, ".env"))
    
    # Configuration
    basedir = os.path.abspath(os.path.dirname(__file__))
    
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    # Point to the root directory database 
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', f'sqlite:///{os.path.join(basedir, "grocery_shop.sqlite3")}')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # JWT Configuration
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)
    app.config['JWT_TOKEN_LOCATION'] = ['headers']
    app.config['JWT_HEADER_NAME'] = 'Authorization'
    app.config['JWT_HEADER_TYPE'] = 'Bearer'

    # Celery and notification configuration
    app.config['CELERY_BROKER_URL'] = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6380/0')
    app.config['CELERY_RESULT_BACKEND'] = os.environ.get('CELERY_RESULT_BACKEND', app.config['CELERY_BROKER_URL'])
    app.config['CELERY_TASK_TRACK_STARTED'] = True
    app.config['CELERY_TASK_TIME_LIMIT'] = int(os.environ.get('CELERY_TASK_TIME_LIMIT', '1800'))
    app.config['CELERY_TASK_ALWAYS_EAGER'] = os.environ.get('CELERY_TASK_ALWAYS_EAGER', 'false').lower() == 'true'
    app.config['CELERY_TIMEZONE'] = os.environ.get('CELERY_TIMEZONE', 'Asia/Kolkata')
    app.config['CELERY_LOW_STOCK_THRESHOLD'] = int(os.environ.get('CELERY_LOW_STOCK_THRESHOLD', '10'))
    app.config['CELERY_CREDIT_REMINDER_DAYS'] = int(os.environ.get('CELERY_CREDIT_REMINDER_DAYS', '2'))

    exports_dir = os.environ.get('EXPORTS_DIR', 'exports')
    if not os.path.isabs(exports_dir):
        exports_dir = os.path.join(project_root, exports_dir)
    app.config['EXPORTS_DIR'] = os.path.abspath(exports_dir)

    # SMTP configuration (used by Celery notification jobs)
    app.config['MAIL_ENABLED'] = os.environ.get('MAIL_ENABLED', 'false').lower() == 'true'
    app.config['MAIL_HOST'] = os.environ.get('MAIL_HOST', '')
    app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', '587'))
    app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', '')
    app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', '')
    app.config['MAIL_FROM'] = os.environ.get('MAIL_FROM', 'no-reply@vyaparai.local')
    app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'true').lower() == 'true'
    app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'false').lower() == 'true'

    # Redis cache configuration for faster API responses
    app.config['CACHE_ENABLED'] = os.environ.get('CACHE_ENABLED', 'true').lower() == 'true'
    app.config['CACHE_DEFAULT_TIMEOUT'] = int(os.environ.get('CACHE_DEFAULT_TIMEOUT', '120'))
    app.config['CACHE_KEY_PREFIX'] = os.environ.get('CACHE_KEY_PREFIX', 'vyaparai:cache:')
    if app.config['CACHE_ENABLED']:
        app.config['CACHE_TYPE'] = 'RedisCache'
        app.config['CACHE_REDIS_URL'] = os.environ.get('CACHE_REDIS_URL', app.config['CELERY_BROKER_URL'])
    else:
        app.config['CACHE_TYPE'] = 'NullCache'
    
    # Initialize extensions
    from .models.models import db, bcrypt
    from .extensions import cache
    db.init_app(app)
    bcrypt.init_app(app)
    cache.init_app(app)
    
    jwt = JWTManager(app)
    
    # JWT Error Handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            'success': False,
            'message': 'Token has expired'
        }), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({
            'success': False,
            'message': 'Invalid token'
        }), 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({
            'success': False,
            'message': 'Authorization token is missing'
        }), 401
    
    # Enable CORS with proper headers
    CORS(app, supports_credentials=True)
    
    # Initialize Socket.IO for real-time detection streaming  
    socketio = SocketIO(
        app, 
        cors_allowed_origins="*",
        async_mode='threading',
        always_connect=True
    )
    
    # Register blueprints
    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.chatbot import chatbot_bp
    from .routes.dashboard import dashboard_bp  
    from .routes.inventory import inventory_bp
    from .routes.credit import credit_bp
    from .routes.app_bounding_boxes import yolo_bp, init_socketio, startup_preload
    from .routes.todos import todos_bp
    from .routes.notes import notes_bp
    from flask_app.routes.billing import billing_bp
    from .routes.admin_products import admin_products_bp
    from .routes.unknown_items import unknown_items_bp
    from .routes.notifications import notifications_bp
    from .routes.settings import settings_bp

    app.register_blueprint(billing_bp)
    app.register_blueprint(dashboard_bp)        
    app.register_blueprint(auth_bp)
    app.register_blueprint(chatbot_bp)
    app.register_blueprint(inventory_bp)
    app.register_blueprint(credit_bp)
    app.register_blueprint(yolo_bp)
    app.register_blueprint(todos_bp)
    app.register_blueprint(notes_bp)
    app.register_blueprint(admin_products_bp)
    app.register_blueprint(unknown_items_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(settings_bp)

    # Configure Celery with Flask app context and task discovery
    from .celery_app import init_celery
    init_celery(app)
    
    # Initialize SocketIO in yolo blueprint
    init_socketio(socketio)

    
    # Create database tables and initialize default data
    with app.app_context():
        db.create_all()
        print("✓ Database tables created successfully")

        # Add owner_username to sales if this is an existing SQLite database.
        # This keeps credit data scoped per user without recreating the database.
        schema_ready = True
        try:
            if app.config['SQLALCHEMY_DATABASE_URI'].startswith('sqlite:'):
                with db.engine.begin() as conn:
                    sales_columns = {
                        row[1] for row in conn.execute(text("PRAGMA table_info(sales)")).fetchall()
                    }
                    if 'owner_username' not in sales_columns:
                        conn.execute(text("ALTER TABLE sales ADD COLUMN owner_username VARCHAR"))
                        print("✓ Added owner_username column to sales table")

                    user_columns = {
                        row[1] for row in conn.execute(text("PRAGMA table_info(user_details)")).fetchall()
                    }
                    if 'daily_report_enabled' not in user_columns:
                        conn.execute(text("ALTER TABLE user_details ADD COLUMN daily_report_enabled BOOLEAN DEFAULT 1"))
                        print("✓ Added daily_report_enabled column to user_details table")
                    if 'daily_report_day_mode' not in user_columns:
                        conn.execute(text("ALTER TABLE user_details ADD COLUMN daily_report_day_mode VARCHAR DEFAULT 'same_day'"))
                        print("✓ Added daily_report_day_mode column to user_details table")
                    if 'daily_report_time' not in user_columns:
                        conn.execute(text("ALTER TABLE user_details ADD COLUMN daily_report_time VARCHAR DEFAULT '20:30'"))
                        print("✓ Added daily_report_time column to user_details table")
                    if 'daily_report_last_sent_for_date' not in user_columns:
                        conn.execute(text("ALTER TABLE user_details ADD COLUMN daily_report_last_sent_for_date DATE"))
                        print("✓ Added daily_report_last_sent_for_date column to user_details table")
                    if 'workspace_reminders_enabled' not in user_columns:
                        conn.execute(text("ALTER TABLE user_details ADD COLUMN workspace_reminders_enabled BOOLEAN DEFAULT 1"))
                        print("✓ Added workspace_reminders_enabled column to user_details table")
                    if 'credit_reminders_enabled' not in user_columns:
                        conn.execute(text("ALTER TABLE user_details ADD COLUMN credit_reminders_enabled BOOLEAN DEFAULT 1"))
                        print("✓ Added credit_reminders_enabled column to user_details table")
                    if 'low_stock_threshold' not in user_columns:
                        conn.execute(text("ALTER TABLE user_details ADD COLUMN low_stock_threshold INTEGER DEFAULT 10"))
                        print("✓ Added low_stock_threshold column to user_details table")

                    verified_user_columns = {
                        row[1] for row in conn.execute(text("PRAGMA table_info(user_details)")).fetchall()
                    }
                    required_user_columns = {
                        'daily_report_enabled',
                        'daily_report_day_mode',
                        'daily_report_time',
                        'daily_report_last_sent_for_date',
                        'workspace_reminders_enabled',
                        'credit_reminders_enabled',
                        'low_stock_threshold',
                    }
                    missing_after_migration = required_user_columns - verified_user_columns
                    if missing_after_migration:
                        raise RuntimeError(
                            f"Missing user_details columns after migration: {sorted(missing_after_migration)}"
                        )

                # Drop any stale session/connection state before ORM queries.
                db.session.remove()
        except Exception as schema_error:
            schema_ready = False
            db.session.rollback()
            print(f"⚠ Could not ensure schema update columns: {schema_error}")
        
        # Import models
        from .models.models import UserDetail, Inventory, Product, ListedProduct
        
        # Check if UserDetail table is empty and add default admin user
        try:
            user_count = UserDetail.query.count()
        except Exception as user_count_error:
            print(f"⚠ Could not query UserDetail via ORM at startup: {user_count_error}")
            user_count = db.session.execute(text("SELECT COUNT(*) FROM user_details")).scalar() or 0

        if user_count == 0 and schema_ready:
            print("⚠ No users found. Creating default admin user...")
            default_admin = UserDetail(
                full_name='Admin#1',
                username='admin',
                email='admin@vyaparai.com',
                role='admin'
            )
            default_admin.set_password('Admin@123')
            db.session.add(default_admin)
            db.session.commit()
            print("✓ Default admin user created successfully")
        else:
            print(f"✓ Found {user_count} existing user(s)")
        
        # Initialize Listed Products for YOLO detection
        if ListedProduct.query.count() == 0:
            print("⚠ No listed products found. Adding YOLO detectable products...")
            yolo_products = [
                'biscuit_5050',
                'biscuit_goodDay',
                'biscuit_goodDay_butter',
                'biscuit_krackJack',
                'biscuit_parleg',
                'boroline_box',
                'boroline_tube',
                'boroplus_lotion',
                'boroplus_tube',
                'boroplus_vasocare',
                'chips_lays',
                'chocolate_dairyMilk',
                'cracker_bisk_farm',
                'dabur_gulabari',
                'dabur_honey',
                'jam_kissan',
                'maggi_small',
                'maggi_special_masala',
                'milky_bar',
                'nescafe_coffee',
                'nivea_cream',
                'oats_saffola',
                'rice_daawat',
                'surf_excel_bar'
            ]
            
            for product_name in yolo_products:
                listed_product = ListedProduct(
                    class_name=product_name
                )
                db.session.add(listed_product)
            
            db.session.commit()
            print(f"✓ Added {len(yolo_products)} listed products successfully")
        else:
            print(f"✓ Found {ListedProduct.query.count()} existing listed product(s)")

    @app.route('/')
    def index():
        """
        API root endpoint with information about available routes
        """
        return {
            'message': 'VyापारAI Backend API',
            'status': 'Running',
            'version': '1.0.0',
            'description': 'AI-powered retail operations platform',
            'endpoints': {
                'authentication': {
                    'signup': {
                        'path': '/api/auth/signup',
                        'method': 'POST',
                        'description': 'Register a new user',
                        'frontend_page': 'http://localhost:3000/signup'
                    },
                    'login': {
                        'path': '/api/auth/login',
                        'method': 'POST',
                        'description': 'Login user and get JWT tokens',
                        'frontend_page': 'http://localhost:3000/login'
                    },
                    'refresh': {
                        'path': '/api/auth/refresh',
                        'method': 'POST',
                        'description': 'Refresh access token',
                        'requires': 'refresh_token'
                    },
                    'logout': {
                        'path': '/api/auth/logout',
                        'method': 'POST',
                        'description': 'Logout user',
                        'requires': 'access_token'
                    },
                    'profile': {
                        'path': '/api/auth/profile',
                        'methods': ['GET', 'PUT'],
                        'description': 'Get or update user profile',
                        'requires': 'access_token'
                    },
                    'change_password': {
                        'path': '/api/auth/change-password',
                        'method': 'POST',
                        'description': 'Change user password',
                        'requires': 'access_token'
                    }
                },
                'chatbot': {
                    'chat': {
                        'path': '/api/chatbot/chat',
                        'method': 'POST',
                        'description': 'Send message to AI chatbot',
                        'requires': 'access_token'
                    },
                    'history': {
                        'path': '/api/chatbot/history',
                        'method': 'GET',
                        'description': 'Get chat history',
                        'requires': 'access_token'
                    }
                }
            },
            'frontend': {
                'home': 'http://localhost:3000',
                'login': 'http://localhost:3000/login',
                'signup': 'http://localhost:3000/signup'
            },
            'documentation': {
                'health_check': '/health',
                'api_version': 'v1'
            }
        }
    
    @app.route('/api')
    def api_info():
        """
        API information endpoint
        """
        return {
            'api': 'VyापारAI Backend',
            'version': '1.0.0',
            'status': 'active',
            'endpoints': {
                'auth': '/api/auth',
                'chatbot': '/api/chatbot'
            }
        }
    
    @app.route('/health')
    def health():
        return {'status': 'healthy'}
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Resource not found'}, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return {'error': 'Internal server error'}, 500
    
    # JWT error handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return {'error': 'Token has expired', 'expired': True}, 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return {'error': 'Invalid token', 'invalid': True}, 401
    
    @jwt.unauthorized_loader
    def unauthorized_callback(error):
        return {'error': 'Authorization required', 'unauthorized': True}, 401
    
    # Load dummy data before preloading detection system
    from .models.dummy_data import load_dummy_data
    with app.app_context():
        load_dummy_data()
    
    # Pre-load YOLO model in the background so /detection starts faster
    startup_preload(app)
    
    return app, socketio

if __name__ == '__main__':
    app, socketio = create_app()
    socketio.run(app, debug=True, port=5001, host='0.0.0.0')
