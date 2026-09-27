import pytest

from flask_app import create_app
from flask_app.models.models import (
    db,
    UserDetail,
    Cashier,
    Inventory,
    Product,
    Bill,
    Sale,
)


@pytest.fixture(scope="module")
def app():
    app, socketio = create_app()
    app.config.update(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture(scope="module")
def client(app):
    return app.test_client()


@pytest.fixture(scope="module", autouse=True)
def mock_chatbot(app):
    # Keep chatbot endpoints deterministic in tests.
    import flask_app.routes.chatbot as chatbot_routes

    chatbot_routes.ask_vyaparai = lambda question: f"mock-answer:{question}"
    chatbot_routes.ask_owner_chatbot = (
        lambda question, session, username: f"mock-owner-answer:{username}:{question}"
    )


@pytest.fixture(scope="module", autouse=True)
def seed_users(app):
    with app.app_context():
        def ensure_user(username, email, full_name, role, password):
            existing = UserDetail.query.filter_by(username=username).first()
            if existing:
                # Normalize seeded users so signin credentials are deterministic.
                existing.email = email
                existing.full_name = full_name
                existing.role = role
                existing.set_password(password)
                db.session.flush()
                return existing
            created = UserDetail(
                username=username,
                email=email,
                full_name=full_name,
                role=role,
            )
            created.set_password(password)
            db.session.add(created)
            db.session.flush()
            return created

        owner = ensure_user(
            "owner_full", "owner_full@mail.com", "Owner Full", "owner", "Owner@123"
        )
        ensure_user(
            "admin_full", "admin_full@mail.com", "Admin Full", "admin", "Admin@123"
        )
        ensure_user("user_full", "user_full@mail.com", "User Full", "user", "User@123")
        ensure_user(
            "cashier_full",
            "cashier_full@mail.com",
            "Cashier Full",
            "cashier",
            "Cashier@123",
        )

        rel = Cashier.query.filter_by(
            cashier_username="cashier_full", added_by_owner="owner_full"
        ).first()
        if not rel:
            rel = Cashier(cashier_username="cashier_full", added_by_owner="owner_full")
            db.session.add(rel)

        inv = Inventory.query.filter_by(username="owner_full").first()
        if not inv:
            inv = Inventory(username="owner_full", inventory_name="Owner Full Inventory")
            db.session.add(inv)
            db.session.flush()

        product = Product.query.filter_by(
            inventory_id=inv.inventory_id, product_name="Milk Pack"
        ).first()
        if not product:
            product = Product(
                inventory_id=inv.inventory_id,
                class_name=None,
                product_name="Milk Pack",
                unit_price=50,
                brand="DairyBrand",
                stock=12,
            )
            db.session.add(product)
            db.session.flush()

        existing_bill = Bill.query.filter_by(bill_id=9001).first()
        if not existing_bill:
            bill = Bill(
                bill_id=9001,
                product_name="Milk Pack",
                units=2,
                unit_price=50,
                product_id=product.product_id,
            )
            db.session.add(bill)

        existing_sale = Sale.query.filter_by(bill_id=9001).first()
        if not existing_sale:
            sale = Sale(
                bill_id=9001,
                customer_name="Sample Customer",
                customer_phone="9999999999",
                total_cost=100,
                amount_paid=50,
                payment_method="cash",
            )
            sale.update_payment_fields()
            db.session.add(sale)

        existing_credit_sale = Sale.query.filter_by(bill_id=9002).first()
        if not existing_credit_sale:
            credit_sale = Sale(
                bill_id=9002,
                customer_name="Credit Customer",
                customer_phone="8888888888",
                total_cost=500,
                amount_paid=100,
                payment_method="credit",
            )
            credit_sale.update_payment_fields()
            db.session.add(credit_sale)

        db.session.commit()


@pytest.fixture(scope="module")
def tokens(client, seed_users):
    def login(username_or_email, password):
        resp = client.post(
            "/api/auth/signin",
            json={"username_or_email": username_or_email, "password": password},
        )
        assert resp.status_code == 200
        return resp.get_json()

    owner = login("owner_full", "Owner@123")
    admin = login("admin_full", "Admin@123")
    user = login("user_full", "User@123")

    return {
        "owner_access": owner["access_token"],
        "owner_refresh": owner["refresh_token"],
        "admin_access": admin["access_token"],
        "user_access": user["access_token"],
    }


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


# ==========================
# AUTH ROUTES
# ==========================
def test_signup_success(client):
    resp = client.post(
        "/api/auth/signup",
        json={
            "username": "signup_full_new",
            "email": "signup_full_new@mail.com",
            "password": "Signup@123",
            "full_name": "Signup Full New",
        },
    )
    assert resp.status_code == 201


def test_signup_failure_duplicate(client):
    first = client.post(
        "/api/auth/signup",
        json={
            "username": "dup_case_user",
            "email": "dup_case_user@mail.com",
            "password": "Signup@123",
            "full_name": "Dup Case User",
        },
    )
    assert first.status_code == 201

    resp = client.post(
        "/api/auth/signup",
        json={
            "username": "dup_case_user",
            "email": "dup_case_user_2@mail.com",
            "password": "Signup@123",
            "full_name": "Dup Case User Again",
        },
    )
    assert resp.status_code == 409


def test_signin_success(client):
    resp = client.post(
        "/api/auth/signin",
        json={"username_or_email": "owner_full", "password": "Owner@123"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.get_json()
    assert "refresh_token" in resp.get_json()


def test_signin_failure_wrong_password(client):
    resp = client.post(
        "/api/auth/signin",
        json={"username_or_email": "owner_full", "password": "Wrong@123"},
    )
    assert resp.status_code == 401


def test_refresh_success(client, tokens):
    resp = client.post("/api/auth/refresh", headers=_bearer(tokens["owner_refresh"]))
    assert resp.status_code == 200
    assert "access_token" in resp.get_json()


def test_refresh_failure_invalid_token(client):
    resp = client.post("/api/auth/refresh", headers=_bearer("invalid.refresh.token"))
    assert resp.status_code in (401, 422)


def test_logout_success(client, tokens):
    resp = client.post("/api/auth/logout", headers=_bearer(tokens["owner_access"]))
    assert resp.status_code == 200


def test_logout_failure_unauthorized(client):
    resp = client.post("/api/auth/logout")
    assert resp.status_code == 401


def test_get_profile_success(client, tokens):
    resp = client.get("/api/auth/profile", headers=_bearer(tokens["owner_access"]))
    assert resp.status_code == 200


def test_get_profile_failure_unauthorized(client):
    resp = client.get("/api/auth/profile")
    assert resp.status_code == 401


def test_update_profile_success(client, tokens):
    resp = client.put(
        "/api/auth/profile",
        json={"full_name": "Owner Full Updated"},
        headers=_bearer(tokens["owner_access"]),
    )
    assert resp.status_code == 200


def test_update_profile_failure_unauthorized(client):
    resp = client.put("/api/auth/profile", json={"full_name": "Should Fail"})
    assert resp.status_code == 401


def test_change_password_success(client, tokens):
    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": "Owner@123", "new_password": "Owner@456"},
        headers=_bearer(tokens["owner_access"]),
    )
    assert resp.status_code == 200


def test_change_password_failure_wrong_current(client, tokens):
    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": "WrongOld@123", "new_password": "Owner@789"},
        headers=_bearer(tokens["owner_access"]),
    )
    assert resp.status_code == 401


def test_get_users_success_admin(client, tokens):
    resp = client.get("/api/auth/users", headers=_bearer(tokens["admin_access"]))
    assert resp.status_code == 200


def test_get_users_failure_forbidden_non_admin(client, tokens):
    resp = client.get("/api/auth/users", headers=_bearer(tokens["owner_access"]))
    assert resp.status_code == 403


def test_verify_token_success(client, tokens):
    resp = client.get("/api/auth/verify-token", headers=_bearer(tokens["owner_access"]))
    assert resp.status_code == 200


def test_verify_token_failure_no_token(client):
    resp = client.get("/api/auth/verify-token")
    assert resp.status_code == 401


def test_get_cashiers_success(client, tokens):
    resp = client.get("/api/auth/cashiers", headers=_bearer(tokens["owner_access"]))
    assert resp.status_code == 200


def test_get_cashiers_failure_unauthorized(client):
    resp = client.get("/api/auth/cashiers")
    assert resp.status_code == 401


def test_create_cashier_success(client, tokens):
    resp = client.post(
        "/api/auth/cashiers",
        json={
            "full_name": "Created Cashier",
            "username": "created_cashier",
            "email": "created_cashier@mail.com",
            "password": "Created@123",
        },
        headers=_bearer(tokens["owner_access"]),
    )
    assert resp.status_code == 201


def test_create_cashier_failure_unauthorized(client):
    resp = client.post(
        "/api/auth/cashiers",
        json={
            "full_name": "NoAuth Cashier",
            "username": "noauth_cashier",
            "email": "noauth_cashier@mail.com",
            "password": "Noauth@123",
        },
    )
    assert resp.status_code == 401


def test_delete_cashier_success(client, tokens):
    resp = client.delete(
        "/api/auth/cashiers/created_cashier",
        headers=_bearer(tokens["owner_access"]),
    )
    assert resp.status_code == 200


def test_delete_cashier_failure_not_found(client, tokens):
    resp = client.delete(
        "/api/auth/cashiers/not_exists_cashier",
        headers=_bearer(tokens["owner_access"]),
    )
    assert resp.status_code == 404


# ==========================
# INVENTORY + DASHBOARD
# ==========================
def test_inventory_products_success(client, tokens):
    resp = client.get(
        "/api/inventory/products", headers=_bearer(tokens["owner_access"])
    )
    assert resp.status_code == 200


def test_inventory_products_failure_unauthorized(client):
    resp = client.get("/api/inventory/products")
    assert resp.status_code == 401


def test_inventory_low_stock_success(client, tokens):
    resp = client.get(
        "/api/inventory/low-stock", headers=_bearer(tokens["owner_access"])
    )
    assert resp.status_code == 200


def test_inventory_low_stock_failure_unauthorized(client):
    resp = client.get("/api/inventory/low-stock")
    assert resp.status_code == 401


def test_inventory_stats_success(client, tokens):
    resp = client.get("/api/inventory/stats", headers=_bearer(tokens["owner_access"]))
    assert resp.status_code == 200


def test_inventory_stats_failure_unauthorized(client):
    resp = client.get("/api/inventory/stats")
    assert resp.status_code == 401


def test_restock_recommendations_success(client, tokens):
    resp = client.get(
        "/api/inventory/restock-recommendations",
        headers=_bearer(tokens["owner_access"]),
    )
    assert resp.status_code == 200


def test_restock_recommendations_failure_unauthorized(client):
    resp = client.get("/api/inventory/restock-recommendations")
    assert resp.status_code == 401


def test_dashboard_stats_success(client, tokens):
    resp = client.get("/api/dashboard/stats", headers=_bearer(tokens["owner_access"]))
    assert resp.status_code == 200


def test_dashboard_stats_failure_unauthorized(client):
    resp = client.get("/api/dashboard/stats")
    assert resp.status_code == 401


# ==========================
# BILLING + CREDITS
# ==========================
def test_billing_products_success(client):
    resp = client.get("/api/billing/products?q=Milk")
    assert resp.status_code == 200


def test_billing_products_failure_wrong_method(client):
    resp = client.post("/api/billing/products", json={})
    assert resp.status_code == 405


def test_billing_check_customer_success(client):
    resp = client.get("/api/billing/check-customer?name=Credit")
    assert resp.status_code == 200


def test_billing_check_customer_failure_missing_name(client):
    resp = client.get("/api/billing/check-customer")
    assert resp.status_code == 400


def test_billing_create_success(client):
    resp = client.post(
        "/api/billing/create",
        json={
            "customer_name": "Walk-in",
            "items": [
                {
                    "product_id": None,
                    "product_name": "Sample Item",
                    "units": 1,
                    "unit_price": 100,
                }
            ],
            "total_cost": 100,
            "amount_paid": 100,
            "payment_method": "cash",
        },
    )
    assert resp.status_code == 200


def test_billing_create_failure_empty_items(client):
    resp = client.post(
        "/api/billing/create",
        json={"customer_name": "Walk-in", "items": [], "total_cost": 0, "amount_paid": 0},
    )
    assert resp.status_code == 400


def test_credits_dashboard_success(client):
    resp = client.get("/api/credits/dashboard")
    assert resp.status_code == 200


def test_credits_dashboard_failure_wrong_method(client):
    resp = client.post("/api/credits/dashboard", json={})
    assert resp.status_code == 405


def test_credits_search_success(client):
    resp = client.get("/api/credits/search?q=Credit")
    assert resp.status_code == 200


def test_credits_search_failure_wrong_method(client):
    resp = client.post("/api/credits/search", json={})
    assert resp.status_code == 405


def test_clear_credit_success(client, app):
    with app.app_context():
        credit_sale = Sale.query.filter(Sale.amount_remaining > 0).first()
        assert credit_sale is not None
        sale_id = credit_sale.sale_id

    resp = client.put(
        f"/api/credits/clear/{sale_id}",
        json={"amount_paid": 10, "new_due_date": "2026-12-31"},
    )
    assert resp.status_code == 200


def test_clear_credit_failure_invalid_amount(client, app):
    with app.app_context():
        credit_sale = Sale.query.filter(Sale.amount_remaining > 0).first()
        assert credit_sale is not None
        sale_id = credit_sale.sale_id

    resp = client.put(f"/api/credits/clear/{sale_id}", json={"amount_paid": -10})
    assert resp.status_code == 400


# ==========================
# NOTES + TODOS
# ==========================
def test_get_notes_success(client, tokens):
    resp = client.get("/api/notes", headers=_bearer(tokens["owner_access"]))
    assert resp.status_code == 200


def test_get_notes_failure_unauthorized(client):
    resp = client.get("/api/notes")
    assert resp.status_code == 401


def test_create_note_success(client, tokens):
    resp = client.post(
        "/api/notes",
        json={"text": "Full test note"},
        headers=_bearer(tokens["owner_access"]),
    )
    assert resp.status_code == 201


def test_create_note_failure_missing_text(client, tokens):
    resp = client.post(
        "/api/notes", json={}, headers=_bearer(tokens["owner_access"])
    )
    assert resp.status_code == 400


def test_delete_note_success(client, tokens):
    created = client.post(
        "/api/notes",
        json={"text": "Delete this note"},
        headers=_bearer(tokens["owner_access"]),
    )
    note_id = created.get_json()["note"]["note_id"]

    resp = client.delete(
        f"/api/notes/{note_id}", headers=_bearer(tokens["owner_access"])
    )
    assert resp.status_code == 200


def test_delete_note_failure_not_found(client, tokens):
    resp = client.delete("/api/notes/99999", headers=_bearer(tokens["owner_access"]))
    assert resp.status_code == 404


def test_get_todos_success(client, tokens):
    resp = client.get("/api/todos", headers=_bearer(tokens["owner_access"]))
    assert resp.status_code == 200


def test_get_todos_failure_unauthorized(client):
    resp = client.get("/api/todos")
    assert resp.status_code == 401


def test_create_todo_success(client, tokens):
    resp = client.post(
        "/api/todos",
        json={"title": "Full suite todo", "date": "2026-04-14"},
        headers=_bearer(tokens["owner_access"]),
    )
    assert resp.status_code == 201


def test_create_todo_failure_missing_required(client, tokens):
    resp = client.post(
        "/api/todos", json={"title": "Missing date"}, headers=_bearer(tokens["owner_access"])
    )
    assert resp.status_code == 400


def test_update_todo_success(client, tokens):
    created = client.post(
        "/api/todos",
        json={"title": "Update this", "date": "2026-04-14"},
        headers=_bearer(tokens["owner_access"]),
    )
    todo_id = created.get_json()["todo"]["todo_id"]

    resp = client.put(
        f"/api/todos/{todo_id}",
        json={"completed": True},
        headers=_bearer(tokens["owner_access"]),
    )
    assert resp.status_code == 200


def test_update_todo_failure_not_found(client, tokens):
    resp = client.put(
        "/api/todos/99999",
        json={"completed": True},
        headers=_bearer(tokens["owner_access"]),
    )
    assert resp.status_code == 404


def test_delete_todo_success(client, tokens):
    created = client.post(
        "/api/todos",
        json={"title": "Delete this", "date": "2026-04-14"},
        headers=_bearer(tokens["owner_access"]),
    )
    todo_id = created.get_json()["todo"]["todo_id"]

    resp = client.delete(
        f"/api/todos/{todo_id}", headers=_bearer(tokens["owner_access"])
    )
    assert resp.status_code == 200


def test_delete_todo_failure_not_found(client, tokens):
    resp = client.delete("/api/todos/99999", headers=_bearer(tokens["owner_access"]))
    assert resp.status_code == 404


def test_toggle_todo_success(client, tokens):
    created = client.post(
        "/api/todos",
        json={"title": "Toggle this", "date": "2026-04-14"},
        headers=_bearer(tokens["owner_access"]),
    )
    todo_id = created.get_json()["todo"]["todo_id"]

    resp = client.patch(
        f"/api/todos/{todo_id}/toggle", headers=_bearer(tokens["owner_access"])
    )
    assert resp.status_code == 200


def test_toggle_todo_failure_not_found(client, tokens):
    resp = client.patch(
        "/api/todos/99999/toggle", headers=_bearer(tokens["owner_access"])
    )
    assert resp.status_code == 404


# ==========================
# CHATBOT
# ==========================
def test_chatbot_chat_success(client):
    resp = client.post("/api/chatbot/chat", json={"question": "How to improve sales?"})
    assert resp.status_code == 200
    assert "answer" in resp.get_json()


def test_chatbot_chat_failure_missing_question(client):
    resp = client.post("/api/chatbot/chat", json={})
    assert resp.status_code == 400


def test_chatbot_user_chat_success(client, tokens):
    resp = client.post(
        "/api/chatbot/user-chat",
        json={"question": "Show my dashboard insights"},
        headers=_bearer(tokens["owner_access"]),
    )
    assert resp.status_code == 200
    assert "answer" in resp.get_json()


def test_chatbot_user_chat_failure_unauthorized(client):
    resp = client.post("/api/chatbot/user-chat", json={"question": "Hi"})
    assert resp.status_code == 401


def test_chatbot_health_success(client):
    resp = client.get("/api/chatbot/health")
    assert resp.status_code == 200


def test_chatbot_health_failure_wrong_method(client):
    resp = client.post("/api/chatbot/health", json={})
    assert resp.status_code == 405


def test_chatbot_history_success(client):
    resp = client.get("/api/chatbot/history")
    assert resp.status_code == 200


def test_chatbot_history_failure_wrong_method(client):
    resp = client.post("/api/chatbot/history", json={})
    assert resp.status_code == 405
