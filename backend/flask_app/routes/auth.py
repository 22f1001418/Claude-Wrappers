"""
Authentication Routes for VyaपारAI
Handles user registration, login, logout, and authorization
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, 
    create_refresh_token,
    jwt_required, 
    get_jwt_identity,
    get_jwt
)
from datetime import datetime, timedelta
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token as google_id_token
from sqlalchemy.exc import IntegrityError
from ..models.models import db, UserDetail, Cashier
from flask_app.tasks.notifications import send_new_cashier_credentials_email
from flask_app.utils.notification_utils import create_notification
import re
import os

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def _get_google_client_id():
    return os.getenv('GOOGLE_CLIENT_ID') or os.getenv('NEXT_PUBLIC_GOOGLE_CLIENT_ID')


def _generate_unique_username(base_username):
    base = re.sub(r'[^a-zA-Z0-9_]+', '_', base_username or '').strip('_').lower()
    if not base:
        base = 'google_user'
    if len(base) < 3:
        base = f'{base}_user'

    candidate = base
    suffix = 1
    while UserDetail.query.filter_by(username=candidate).first():
        candidate = f'{base}_{suffix}'
        suffix += 1

    return candidate


def _issue_tokens(user):
    access_token = create_access_token(identity=user.username)
    refresh_token = create_refresh_token(identity=user.username)

    return jsonify({
        'message': 'Authentication successful',
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token
    })


def validate_email(email):
    """
    Validate email format
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_password(password):
    """
    Validate password strength
    - At least 8 characters
    - Contains at least one uppercase letter
    - Contains at least one lowercase letter
    - Contains at least one number
    - Contains at least one special character
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one number"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;\'/`~]', password):
        return False, "Password must contain at least one special character"
    return True, "Password is valid"


def _google_auth_response(user, message='Google authentication successful'):
    access_token = create_access_token(identity=user.username)
    refresh_token = create_refresh_token(identity=user.username)

    return jsonify({
        'message': message,
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 200


@auth_bp.route('/signup', methods=['POST'])
def signup():
    """
    Register a new user
    
    Expected JSON body:
    {
        "username": "string",
        "email": "string",
        "password": "string",
        "full_name": "string" (optional),
        "phone": "string" (optional)
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['username', 'email', 'password']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        username = data['username'].strip()
        email = data['email'].strip().lower()
        password = data['password']
        full_name = data.get('full_name', '').strip()
        phone = data.get('phone', '').strip()
        
        # Validate username
        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters long'}), 400
        
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return jsonify({'error': 'Username can only contain letters, numbers, and underscores'}), 400
        
        # Validate email
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate password
        is_valid, message = validate_password(password)
        if not is_valid:
            return jsonify({'error': message}), 400
        
        # Check if user already exists
        if UserDetail.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already exists'}), 409
        
        existing_email_user = UserDetail.query.filter_by(email=email).first()
        if existing_email_user:
            if existing_email_user.google_id:
                return jsonify({'error': 'This email is already linked with Google. Continue with Google sign-in.'}), 409
            return jsonify({'error': 'Email already registered'}), 409
        
        # Create new user
        new_user = UserDetail(
            username=username,
            email=email if email else None,
            role='owner',
            full_name=full_name if full_name else None
        )
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()
        
        # Create access and refresh tokens
        access_token = create_access_token(identity=new_user.username)
        refresh_token = create_refresh_token(identity=new_user.username)

        return jsonify({
            'message': 'User registered successfully',
            'user': new_user.to_dict(),
            'access_token': access_token,
            'refresh_token': refresh_token
        }), 201

    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Email already registered'}), 409
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500


@auth_bp.route('/signin', methods=['POST'])
def login():
    """
    Authenticate user and return JWT tokens
    
    Expected JSON body:
    {
        "username_or_email": "string",
        "password": "string"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        username_or_email = data.get('username_or_email', '').strip()
        password = data.get('password', '')
        
        if not username_or_email or not password:
            return jsonify({'error': 'Username/email and password are required'}), 400
        
        # Find user by username or email
        user = UserDetail.query.filter(
            (UserDetail.username == username_or_email) | 
            (UserDetail.email == username_or_email.lower())
        ).first()
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # If the account was created or linked with Google and does not use a password flow,
        # direct the user back to Google sign-in.
        if user.google_id and (not user.password or user.auth_provider == 'google'):
            return jsonify({'error': 'This account uses Google sign-in. Continue with Google.'}), 401

        # Verify password
        if not user.check_password(password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Create tokens
        access_token = create_access_token(identity=user.username)
        refresh_token = create_refresh_token(identity=user.username)
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict(),
            'access_token': access_token,
            'refresh_token': refresh_token
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Login failed: {str(e)}'}), 500


@auth_bp.route('/google', methods=['POST'])
def google_auth():
    """
    Authenticate or link a user using a Google ID token.

    Expected JSON body:
    {
        "credential": "Google ID token"
    }
    """
    try:
        data = request.get_json() or {}
        credential = data.get('credential', '')

        if not credential:
            return jsonify({'error': 'Google credential is required'}), 400

        client_id = _get_google_client_id()
        if not client_id:
            return jsonify({'error': 'Google sign-in is not configured on the server'}), 500

        try:
            payload = google_id_token.verify_oauth2_token(
                credential,
                GoogleRequest(),
                client_id
            )
        except ValueError:
            return jsonify({'error': 'Invalid or expired Google token'}), 401

        email = str(payload.get('email', '')).strip().lower()
        google_id = str(payload.get('sub', '')).strip()
        full_name = str(payload.get('name', '')).strip()
        email_verified = payload.get('email_verified', False)

        if not email or not google_id or not full_name:
            return jsonify({'error': 'Google account did not return required profile data'}), 400

        if not email_verified:
            return jsonify({'error': 'Google email is not verified'}), 401

        user = UserDetail.query.filter_by(email=email).first()

        if user:
            if user.google_id and user.google_id != google_id:
                return jsonify({'error': 'This email is already linked with a different Google account'}), 409

            if not user.google_id:
                user.google_id = google_id
                if not user.auth_provider:
                    user.auth_provider = 'google'
                if not user.full_name and full_name:
                    user.full_name = full_name
                db.session.commit()

            return _google_auth_response(user, 'Google login successful')

        username = _generate_unique_username(email.split('@')[0])
        new_user = UserDetail(
            username=username,
            email=email,
            role='owner',
            full_name=full_name,
            auth_provider='google',
            google_id=google_id
        )

        db.session.add(new_user)
        db.session.commit()

        return _google_auth_response(new_user, 'Google account created successfully')

    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'This email is already linked to an account'}), 409
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Google authentication failed: {str(e)}'}), 500


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh access token using refresh token
    """
    try:
        current_user_id = get_jwt_identity()
        
        # Create new access token
        access_token = create_access_token(identity=current_user_id)
        
        return jsonify({
            'access_token': access_token
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Token refresh failed: {str(e)}'}), 500


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Logout user (token invalidation handled client-side)
    """
    try:
        current_username = get_jwt_identity()
        
        return jsonify({
            'message': 'Logout successful'
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Logout failed: {str(e)}'}), 500


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """
    Get current user profile (Protected route example)
    """
    try:
        current_username = get_jwt_identity()
        user = UserDetail.query.get(current_username)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch profile: {str(e)}'}), 500


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """
    Update user profile
    
    Expected JSON body:
    {
        "full_name": "string" (optional),
        "username": "string" (optional),
        "email": "string" (optional),
        "role": "string" (optional)
    }
    """
    try:
        current_username = get_jwt_identity()
        user = UserDetail.query.get(current_username)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Update allowed fields
        if 'full_name' in data:
            full_name = data['full_name'].strip()
            if full_name:
                user.full_name = full_name
        
        if 'username' in data:
            new_username = data['username'].strip()
            if new_username and new_username != user.username:
                # Check if username is already taken
                existing_user = UserDetail.query.filter_by(username=new_username).first()
                if existing_user:
                    return jsonify({'error': 'Username already taken'}), 409
                
                # Username validation
                if len(new_username) < 3:
                    return jsonify({'error': 'Username must be at least 3 characters'}), 400
                if not new_username.replace('_', '').isalnum():
                    return jsonify({'error': 'Username can only contain letters, numbers, and underscores'}), 400
                
                # Update username - this is tricky with primary key
                # We need to create a new user and delete the old one
                # For now, return an error suggesting this limitation
                # In production, you'd handle this with a proper migration
                return jsonify({'error': 'Username changes are currently not supported due to database constraints. Please contact support.'}), 400
        
        if 'email' in data:
            new_email = data['email'].strip().lower()
            if not validate_email(new_email):
                return jsonify({'error': 'Invalid email format'}), 400
            
            # Check if email is already taken by another user
            existing_user = UserDetail.query.filter_by(email=new_email).first()
            if existing_user and existing_user.username != user.username:
                return jsonify({'error': 'Email already in use'}), 409
            
            user.email = new_email
        
        if 'role' in data:
            user.role = data['role'].strip()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Profile update failed: {str(e)}'}), 500


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """
    Change user password
    
    Expected JSON body:
    {
        "current_password": "string",
        "new_password": "string"
    }
    """
    try:
        current_username = get_jwt_identity()
        user = UserDetail.query.get(current_username)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        
        if not current_password or not new_password:
            return jsonify({'error': 'Current password and new password are required'}), 400
        
        # Verify current password
        if not user.check_password(current_password):
            return jsonify({'error': 'Current password does not match the Old Password Field'}), 401
        
        # Validate new password
        is_valid, message = validate_password(new_password)
        if not is_valid:
            return jsonify({'error': message}), 400
        
        # Update password
        user.set_password(new_password)
        db.session.commit()
        
        return jsonify({
            'message': 'Password changed successfully. Please login again.'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Password change failed: {str(e)}'}), 500


@auth_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    """
    Get all users (Admin only)
    """
    try:
        current_username = get_jwt_identity()
        current_user = UserDetail.query.get(current_username)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if user is admin
        if current_user and current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized. Admin access required'}), 403
        
        users = UserDetail.query.all()
        
        return jsonify({
            'users': [user.to_dict() for user in users],
            'total': len(users)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch users: {str(e)}'}), 500


@auth_bp.route('/verify-token', methods=['GET'])
@jwt_required()
def verify_token():
    """
    Verify if the current token is valid
    """
    try:
        current_username = get_jwt_identity()
        user = UserDetail.query.get(current_username)
        
        if not user:
            return jsonify({'error': 'User not found', 'valid': False}), 404
        
        return jsonify({
            'valid': True,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Invalid token', 'valid': False}), 401


@auth_bp.route('/cashiers', methods=['GET'])
@jwt_required()
def get_cashiers():
    """
    Get all cashiers (Owner only)
    """
    try:
        current_username = get_jwt_identity()
        current_user = UserDetail.query.get(current_username)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if user is owner/admin
        if current_user.role not in ['admin', 'owner', 'user']:
            return jsonify({'error': 'Unauthorized. Owner access required'}), 403
        
        # Get all cashiers with their relationship details
        cashiers_data = []
        cashiers = UserDetail.query.filter_by(role='cashier').all()
        
        for cashier in cashiers:
            cashier_dict = cashier.to_dict()
            
            # Get relationship info (who added this cashier and when)
            relationship = Cashier.query.filter_by(cashier_username=cashier.username).first()
            if relationship:
                cashier_dict['added_by'] = relationship.added_by_owner
                cashier_dict['date_added'] = relationship.date_added.isoformat() if relationship.date_added else None
                
                # Get owner details
                owner = UserDetail.query.get(relationship.added_by_owner)
                if owner:
                    cashier_dict['added_by_name'] = owner.full_name or owner.username
            
            cashiers_data.append(cashier_dict)
        
        return jsonify({
            'cashiers': cashiers_data,
            'total': len(cashiers_data)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch cashiers: {str(e)}'}), 500


@auth_bp.route('/cashiers', methods=['POST'])
@jwt_required()
def create_cashier():
    """
    Create a new cashier (Owner only)
    
    Expected JSON body:
    {
        "full_name": "string",
        "username": "string",
        "email": "string",
        "password": "string"
    }
    """
    try:
        current_username = get_jwt_identity()
        current_user = UserDetail.query.get(current_username)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if user is owner/admin
        if current_user.role not in ['admin', 'owner', 'user']:
            return jsonify({'error': 'Unauthorized. Owner access required'}), 403
        
        data = request.get_json()
        
        # Validate required fields
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['full_name', 'username', 'email', 'password']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        full_name = data['full_name'].strip()
        username = data['username'].strip()
        email = data['email'].strip().lower()
        password = data['password']
        
        # Validate username
        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters long'}), 400
        
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return jsonify({'error': 'Username can only contain letters, numbers, and underscores'}), 400
        
        # Validate email
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate password
        is_valid, message = validate_password(password)
        if not is_valid:
            return jsonify({'error': message}), 400
        
        # Check if user already exists
        if UserDetail.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already exists'}), 409
        
        # Check if email already exists
        if UserDetail.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 409
        
        # Create new cashier user
        plaintext_password = password
        new_cashier = UserDetail(
            username=username,
            email=email,
            role='cashier',
            full_name=full_name
        )
        new_cashier.set_password(plaintext_password)
        
        db.session.add(new_cashier)
        db.session.flush()  # Flush to ensure the user is created before creating relationship
        
        # Create cashier relationship record linking owner and cashier
        cashier_relationship = Cashier(
            cashier_username=username,
            added_by_owner=current_username
        )
        
        db.session.add(cashier_relationship)
        db.session.commit()

        owner_display_name = current_user.full_name or current_user.username
        send_new_cashier_credentials_email.delay(
            email,
            username,
            plaintext_password,
            owner_display_name,
        )

        create_notification(
            current_username,
            event_type="cashier_added",
            title="Cashier added",
            message=f"Cashier {username} was added successfully.",
            payload={"cashier_username": username, "cashier_email": email},
        )

        create_notification(
            username,
            event_type="cashier_account_created",
            title="Your cashier account is ready",
            message=f"Your cashier account was created by {owner_display_name}. Please sign in and change your password.",
            payload={"added_by": current_username},
        )
        
        return jsonify({
            'message': 'Cashier created successfully',
            'cashier': new_cashier.to_dict(),
            'relationship': cashier_relationship.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create cashier: {str(e)}'}), 500

@auth_bp.route('/cashiers/<username>', methods=['DELETE'])
@jwt_required()
def delete_cashier(username):
    """
    Delete a cashier (Owner only)
    """
    try:
        current_username = get_jwt_identity()
        current_user = UserDetail.query.get(current_username)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if user is owner/admin
        if current_user.role not in ['admin', 'owner']:
            return jsonify({'error': 'Unauthorized. Owner access required'}), 403
        
        # Find the cashier
        cashier = UserDetail.query.get(username)
        
        if not cashier:
            return jsonify({'error': 'Cashier not found'}), 404
        
        # Verify the user is a cashier
        if cashier.role != 'cashier':
            return jsonify({'error': 'Can only delete cashiers'}), 400
        
        # Don't allow deleting yourself
        if cashier.username == current_username:
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        # Delete cashier relationship records first (foreign key constraint)
        cashier_relationships = Cashier.query.filter_by(cashier_username=username).all()
        for relationship in cashier_relationships:
            db.session.delete(relationship)
        
        # Then delete the cashier user
        db.session.delete(cashier)
        db.session.commit()

        create_notification(
            current_username,
            event_type="cashier_deleted",
            title="Cashier removed",
            message=f"Cashier {username} was removed from your account.",
            payload={"cashier_username": username},
        )
        
        return jsonify({
            'message': f'Cashier {username} deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete cashier: {str(e)}'}), 500


    

@auth_bp.route('/admins', methods=['GET'])
@jwt_required()
def get_admins():
    try:
        current_username = get_jwt_identity()
        current_user = UserDetail.query.get(current_username)

        # Only admin allowed
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized. Admin access required'}), 403

        admins = UserDetail.query.filter_by(role='admin').all()

        return jsonify({
            'admins': [admin.to_dict() for admin in admins],
            'total': len(admins)
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to fetch admins: {str(e)}'}), 500
    

@auth_bp.route('/admins', methods=['POST'])
@jwt_required()
def create_admin():
    try:
        current_username = get_jwt_identity()
        current_user = UserDetail.query.get(current_username)

        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json()

        required_fields = ['full_name', 'username', 'email', 'password']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400

        # Check duplicates
        if UserDetail.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 409

        if UserDetail.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 409

        # Create admin
        new_admin = UserDetail(
            username=data['username'],
            email=data['email'],
            full_name=data['full_name'],
            role='admin'
        )
        new_admin.set_password(data['password'])

        db.session.add(new_admin)
        db.session.commit()

        return jsonify({
            'message': f'Admin {data["username"]} created successfully'
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/admins/<username>', methods=['DELETE'])
@jwt_required()
def delete_admin(username):
    try:
        current_username = get_jwt_identity()
        current_user = UserDetail.query.get(current_username)

        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403

        # Prevent self-delete
        if username == current_username:
            return jsonify({'error': 'You cannot delete yourself'}), 400

        admin = UserDetail.query.filter_by(username=username, role='admin').first()

        if not admin:
            return jsonify({'error': 'Admin not found'}), 404

        db.session.delete(admin)
        db.session.commit()

        return jsonify({'message': f'Admin {username} deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500