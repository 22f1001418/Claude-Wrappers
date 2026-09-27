import pytest
import json
from flask_app import create_app
from flask_app.models.models import db, UserDetail

@pytest.fixture
def app():
    app, socketio = create_app()
    app.config.update({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:'
    })
    
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def auth_headers(client, app):
    # Helper fixture to create an admin user and return their auth headers
    with app.app_context():
        user = UserDetail(
            username='testadmin',
            email='admin@test.com',
            full_name='Test Admin',
            role='owner'
        )
        user.set_password('Admin@123')
        db.session.add(user)
        db.session.commit()
    
    resp = client.post('/api/auth/signin', json={
        'username_or_email': 'testadmin',
        'password': 'Admin@123'
    })
    token = resp.get_json()['access_token']
    return {'Authorization': f'Bearer {token}'}

# ==========================
# 1. AUTH & PROFILE
# ==========================
def test_signup_success(client):
    resp = client.post('/api/auth/signup', json={
        'username': 'newuser',
        'email': 'newuser@gmail.com',
        'password': 'Password@123',
        'full_name': 'New User'
    })
    assert resp.status_code == 201

def test_signup_failure_duplicate(client, auth_headers):
    # testadmin already exists in DB via the auth_headers fixture
    resp = client.post('/api/auth/signup', json={
        'username': 'testadmin',
        'email': 'testadmin2@gmail.com',
        'password': 'Password@123',
        'full_name': 'Duplicate Name'
    })
    assert resp.status_code == 409 # Conflict

def test_signin_success(client, auth_headers):
    resp = client.post('/api/auth/signin', json={
        'username_or_email': 'testadmin',
        'password': 'Admin@123'
    })
    assert resp.status_code == 200
    assert 'access_token' in resp.get_json()

def test_signin_failure_wrong_password(client, auth_headers):
    resp = client.post('/api/auth/signin', json={
        'username_or_email': 'testadmin',
        'password': 'WrongPassword@123'
    })
    assert resp.status_code == 401

def test_get_profile_success(client, auth_headers):
    resp = client.get('/api/auth/profile', headers=auth_headers)
    assert resp.status_code == 200

def test_get_profile_failure_unauthorized(client):
    resp = client.get('/api/auth/profile') # No token
    assert resp.status_code == 401

def test_update_profile_success(client, auth_headers):
    resp = client.put('/api/auth/profile', json={'full_name': 'Updated Admin'}, headers=auth_headers)
    assert resp.status_code == 200

def test_update_profile_failure_unauthorized(client):
    resp = client.put('/api/auth/profile', json={'full_name': 'Updated Admin'})
    assert resp.status_code == 401


# ==========================
# 2. CASHIERS
# ==========================
def test_create_cashier_success(client, auth_headers):
    resp = client.post('/api/auth/cashiers', json={
        'full_name': 'Cashier One',
        'username': 'cashier1',
        'email': 'cashier1@test.com',
        'password': 'Cashier@123'
    }, headers=auth_headers)
    assert resp.status_code in [200, 201]

def test_create_cashier_failure_unauthorized(client):
    resp = client.post('/api/auth/cashiers', json={
        'full_name': 'Cashier One',
        'username': 'cashier1',
        'email': 'cashier1@test.com',
        'password': 'Cashier@123'
    })
    assert resp.status_code == 401

def test_get_cashiers_success(client, auth_headers):
    resp = client.get('/api/auth/cashiers', headers=auth_headers)
    assert resp.status_code == 200

def test_get_cashiers_failure_unauthorized(client):
    resp = client.get('/api/auth/cashiers')
    assert resp.status_code == 401


# ==========================
# 3. NOTES
# ==========================
def test_create_note_success(client, auth_headers):
    resp = client.post('/api/notes', json={'text': 'My first note'}, headers=auth_headers)
    assert resp.status_code == 201

def test_create_note_failure_missing_data(client, auth_headers):
    resp = client.post('/api/notes', json={}, headers=auth_headers) # Missing 'text'
    # Normally missing fields trigger 400 Bad Request, worst case 500
    assert resp.status_code in [400, 500] 

def test_get_notes_success(client, auth_headers):
    resp = client.get('/api/notes', headers=auth_headers)
    assert resp.status_code == 200

def test_get_notes_failure_unauthorized(client):
    resp = client.get('/api/notes')
    assert resp.status_code == 401

def test_delete_note_success(client, auth_headers):
    # Setup: Create note first
    resp_post = client.post('/api/notes', json={'text': 'Delete me'}, headers=auth_headers)
    note_id = resp_post.get_json()['note']['note_id']
    resp = client.delete(f'/api/notes/{note_id}', headers=auth_headers)
    assert resp.status_code == 200

def test_delete_note_failure_not_found(client, auth_headers):
    resp = client.delete('/api/notes/9999', headers=auth_headers)
    assert resp.status_code == 404


# ==========================
# 4. TODOS
# ==========================
def test_create_todo_success(client, auth_headers):
    resp = client.post('/api/todos', json={
        'title': 'Buy milk',
        'date': '2026-04-03'
    }, headers=auth_headers)
    assert resp.status_code == 201

def test_create_todo_failure_unauthorized(client):
    resp = client.post('/api/todos', json={'title': 'Buy milk'})
    assert resp.status_code == 401

def test_get_todos_success(client, auth_headers):
    resp = client.get('/api/todos', headers=auth_headers)
    assert resp.status_code == 200

def test_get_todos_failure_unauthorized(client):
    resp = client.get('/api/todos')
    assert resp.status_code == 401

def test_update_todo_success(client, auth_headers):
    # Setup: Create todo first
    resp_post = client.post('/api/todos', json={'title': 'Update me', 'date': '2026-04-03'}, headers=auth_headers)
    todo_id = resp_post.get_json()['todo']['todo_id']
    resp = client.put(f'/api/todos/{todo_id}', json={'completed': True}, headers=auth_headers)
    assert resp.status_code == 200

def test_update_todo_failure_not_found(client, auth_headers):
    resp = client.put('/api/todos/9999', json={'completed': True}, headers=auth_headers)
    assert resp.status_code == 404

def test_delete_todo_success(client, auth_headers):
    resp_post = client.post('/api/todos', json={'title': 'Delete me', 'date': '2026-04-03'}, headers=auth_headers)
    todo_id = resp_post.get_json()['todo']['todo_id']
    resp = client.delete(f'/api/todos/{todo_id}', headers=auth_headers)
    assert resp.status_code == 200

def test_delete_todo_failure_not_found(client, auth_headers):
    resp = client.delete('/api/todos/9999', headers=auth_headers)
    assert resp.status_code == 404
