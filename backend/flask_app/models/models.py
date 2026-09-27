"""
Database Models for VyaपारAI
SQLAlchemy models matching existing grocery_shop.sqlite3 database schema
"""

import json

from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from datetime import datetime, date

db = SQLAlchemy()
bcrypt = Bcrypt()


class UserDetail(db.Model):
    """
    User Details Model for authentication
    Maps to: user_details table
    """
    __tablename__ = 'user_details'
    
    full_name = db.Column(db.String, nullable=False)
    username = db.Column(db.String, primary_key=True)
    email = db.Column(db.String, nullable=False, unique=True)
    # password = db.Column(db.String, nullable=False)
    role = db.Column(db.String)
    auth_provider = db.Column(db.String, default="local")  # 👈 NEW
    google_id = db.Column(db.String, unique=True, nullable=True)  # 👈 NEW
    password = db.Column(db.String, nullable=True)  # 👈 changed
    daily_report_enabled = db.Column(db.Boolean, nullable=False, default=True)
    daily_report_day_mode = db.Column(db.String, nullable=False, default='same_day')
    daily_report_time = db.Column(db.String, nullable=False, default='20:30')
    daily_report_last_sent_for_date = db.Column(db.Date, nullable=True)
    workspace_reminders_enabled = db.Column(db.Boolean, nullable=False, default=True)
    credit_reminders_enabled = db.Column(db.Boolean, nullable=False, default=True)
    low_stock_threshold = db.Column(db.Integer, nullable=False, default=10)

    
    def check_password(self, password):
        """
        Verify password against hash
        """
        return bcrypt.check_password_hash(self.password, password)
    
    def set_password(self, password):
        """
        Set hashed password
        """
        self.password = bcrypt.generate_password_hash(password).decode('utf-8')
    
    def to_dict(self):
        return {
            'full_name': self.full_name,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'daily_report_enabled': self.daily_report_enabled,
            'daily_report_day_mode': self.daily_report_day_mode,
            'daily_report_time': self.daily_report_time,
            'workspace_reminders_enabled': self.workspace_reminders_enabled,
            'credit_reminders_enabled': self.credit_reminders_enabled,
            'low_stock_threshold': self.low_stock_threshold
        }
    
    def __repr__(self):
        return f'<UserDetail {self.username}>'


class ListedProduct(db.Model):
    """
    Listed Products Model - Products that can be listed/recognized
    Maps to: listed_products table
    """
    __tablename__ = 'listed_products'
    
    item_id = db.Column(db.Integer, primary_key=True)
    class_name = db.Column(db.String)
    
    def to_dict(self):
        return {
            'item_id': self.item_id,
            'class_name': self.class_name
        }
    
    def __repr__(self):
        return f'<ListedProduct {self.class_name}>'


class UnknownItem(db.Model):
    """
    Unknown Items Model - Items not recognized by the system
    Maps to: unknown_items table
    """
    __tablename__ = 'unknown_items'
    
    item_id = db.Column(db.Integer, primary_key=True)
    class_name = db.Column(db.String)
    count = db.Column(db.Integer, nullable=False)
    image = db.Column(db.String)

    def get_images(self):
        """Return the stored image paths as a list."""
        if not self.image:
            return []

        try:
            parsed = json.loads(self.image)
            if isinstance(parsed, list):
                return parsed
        except (TypeError, ValueError, json.JSONDecodeError):
            pass

        return [self.image]

    def set_images(self, images):
        """Persist image paths as a JSON array string."""
        self.image = json.dumps(images or [])
    
    def to_dict(self):
        images = self.get_images()
        return {
            'item_id': self.item_id,
            'class_name': self.class_name,
            'count': self.count,
            'image': self.image,
            'images': images
        }
    
    def __repr__(self):
        return f'<UnknownItem {self.class_name}>'


class Inventory(db.Model):
    """
    Inventory Model - Inventory/Store information
    Maps to: inventory table
    One-to-One: Each owner can have only ONE inventory
    """
    __tablename__ = 'inventory'
    
    inventory_id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String, db.ForeignKey('user_details.username'), unique=True, nullable=False)
    inventory_name = db.Column(db.String, nullable=False)
    
    # Relationship (one-to-one)
    user = db.relationship('UserDetail', backref=db.backref('inventory', uselist=False, lazy=True))
    
    def to_dict(self):
        return {
            'inventory_id': self.inventory_id,
            'username': self.username,
            'inventory_name': self.inventory_name
        }
    
    def __repr__(self):
        return f'<Inventory {self.inventory_name}>'


class Product(db.Model):
    """
    Product Model - Product details in inventory
    Maps to: products table
    """
    __tablename__ = 'products'
    
    product_id = db.Column(db.Integer, primary_key=True)
    inventory_id = db.Column(db.Integer, db.ForeignKey('inventory.inventory_id'))
    class_name = db.Column(db.String, db.ForeignKey('listed_products.class_name'))
    product_name = db.Column(db.String, nullable=False)
    unit_price = db.Column(db.Integer, nullable=False)
    brand = db.Column(db.String)
    stock = db.Column(db.Integer, nullable=False)
    
    # Relationships
    inventory = db.relationship('Inventory', backref=db.backref('products', lazy=True))
    listed_product = db.relationship('ListedProduct', backref=db.backref('products', lazy=True))
    
    def to_dict(self):
        return {
            'product_id': self.product_id,
            'inventory_id': self.inventory_id,
            'class_name': self.class_name,
            'product_name': self.product_name,
            'unit_price': self.unit_price,
            'brand': self.brand,
            'stock': self.stock
        }
    
    def __repr__(self):
        return f'<Product {self.product_name}>'


class Bill(db.Model):
    """
    Bill Model - Individual line items in bills
    Maps to: bills table
    Note: Multiple Bill records share the same bill_id (one per product)
          Composite Primary Key: (bill_id, product_name)
    """
    __tablename__ = 'bills'
    
    bill_id = db.Column(db.Integer, primary_key=True)
    product_name = db.Column(db.String, primary_key=True)
    units = db.Column(db.Integer)
    unit_price = db.Column(db.Integer)
    product_id = db.Column(db.Integer, db.ForeignKey('products.product_id'), nullable=True)
    
    # Relationship
    product = db.relationship('Product', backref=db.backref('bills', lazy=True))
    
    def to_dict(self):
        return {
            'bill_id': self.bill_id,
            'product_name': self.product_name,
            'units': self.units,
            'unit_price': self.unit_price,
            'product_id': self.product_id
        }
    
    def __repr__(self):
        return f'<Bill {self.bill_id} - {self.product_name}>'


from datetime import date

class Sale(db.Model):
    """
    Sales Model - Sales/Order transactions
    Maps to: sales table
    Note: One Sale record per transaction, references a bill_id.
          Multiple Bill records share that bill_id for itemized details.
    """
    __tablename__ = 'sales'
    
    sale_id = db.Column(db.Integer, primary_key=True)
    bill_id = db.Column(db.Integer, nullable=False)
    owner_username = db.Column(db.String, db.ForeignKey('user_details.username'), nullable=True)

    customer_name = db.Column(db.String, nullable=False, default='Walk-in Customer')
    customer_phone = db.Column(db.String)

    total_cost = db.Column(db.Integer, nullable=False)

    #  NEW FIELDS
    amount_paid = db.Column(db.Integer, default=0)
    amount_remaining = db.Column(db.Integer, default=0)

    credit = db.Column(db.Boolean, default=False)
    due_date = db.Column(db.Date)
    date_of_purchase = db.Column(db.Date, default=date.today)
    payment_method = db.Column(db.String, default='cash')
    
    def get_bill_items(self):
        """Get all bill items for this sale by bill_id"""
        return Bill.query.filter_by(bill_id=self.bill_id).all()

    def update_payment_fields(self):
        """
        Update remaining amount and credit status.
        Call this before saving to DB.
        """
        self.amount_remaining = self.total_cost - self.amount_paid
        self.credit = self.amount_remaining > 0
    
    def to_dict(self):
        return {
            'sale_id': self.sale_id,
            'bill_id': self.bill_id,
            'owner_username': self.owner_username,
            'customer_name': self.customer_name,
            'customer_phone': self.customer_phone,
            'total_cost': self.total_cost,
            'amount_paid': self.amount_paid,
            'amount_remaining': self.amount_remaining,
            'credit': self.credit,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'date_of_purchase': self.date_of_purchase.isoformat() if self.date_of_purchase else None,
            'payment_method': self.payment_method,
            'items': [item.to_dict() for item in self.get_bill_items()]
        }
    
    def __repr__(self):
        return f'<Sale {self.sale_id}>'

class Cashier(db.Model):
    """
    Cashier Model - Tracks cashiers and the owner who added them
    Maps to: cashiers table
    """
    __tablename__ = 'cashiers'
    
    cashier_id = db.Column(db.Integer, primary_key=True)
    cashier_username = db.Column(db.String, db.ForeignKey('user_details.username'), nullable=False)
    added_by_owner = db.Column(db.String, db.ForeignKey('user_details.username'), nullable=False)
    date_added = db.Column(db.Date, default=date.today)
    
    # Relationships
    cashier_user = db.relationship('UserDetail', foreign_keys=[cashier_username], backref=db.backref('cashier_profile', lazy=True))
    owner_user = db.relationship('UserDetail', foreign_keys=[added_by_owner], backref=db.backref('added_cashiers', lazy=True))
    
    def to_dict(self):
        return {
            'cashier_id': self.cashier_id,
            'cashier_username': self.cashier_username,
            'added_by_owner': self.added_by_owner,
            'date_added': self.date_added.isoformat() if self.date_added else None
        }
    
    def __repr__(self):
        return f'<Cashier {self.cashier_username} added by {self.added_by_owner}>'


class Todo(db.Model):
    """
    Todo Model - Tasks and todos for owners
    Maps to: todos table
    """
    __tablename__ = 'todos'
    
    todo_id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String, db.ForeignKey('user_details.username'), nullable=False)
    title = db.Column(db.String, nullable=False)
    description = db.Column(db.Text)
    date = db.Column(db.Date, nullable=False)
    time = db.Column(db.String)
    priority = db.Column(db.String, nullable=False, default='medium')  # low, medium, high
    category = db.Column(db.String, nullable=False, default='Work')  # Work, Personal, Shopping, Health & Fitness, etc.
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    user = db.relationship('UserDetail', backref=db.backref('todos', lazy=True))
    
    def to_dict(self):
        return {
            'todo_id': self.todo_id,
            'username': self.username,
            'title': self.title,
            'description': self.description,
            'date': self.date.isoformat() if self.date else None,
            'time': self.time,
            'priority': self.priority,
            'category': self.category,
            'completed': self.completed,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<Todo {self.todo_id}: {self.title}>'


class Note(db.Model):
    """
    Note Model - Notes for owners and users
    Maps to: notes table
    """
    __tablename__ = 'notes'
    
    note_id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String, db.ForeignKey('user_details.username'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationship
    user = db.relationship('UserDetail', backref=db.backref('notes', lazy=True))
    
    def to_dict(self):
        return {
            'note_id': self.note_id,
            'username': self.username,
            'text': self.text,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<Note {self.note_id}>'


class Notification(db.Model):
    """In-app notification model for user notification center."""

    __tablename__ = 'notifications'

    notification_id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String, db.ForeignKey('user_details.username'), nullable=False, index=True)
    event_type = db.Column(db.String, nullable=False, default='general')
    title = db.Column(db.String, nullable=False)
    message = db.Column(db.Text, nullable=False)
    payload = db.Column(db.Text, nullable=True)
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    is_dismissed = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    read_at = db.Column(db.DateTime, nullable=True)
    dismissed_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship('UserDetail', backref=db.backref('notifications', lazy=True))

    def to_dict(self):
        parsed_payload = None
        if self.payload:
            try:
                parsed_payload = json.loads(self.payload)
            except (TypeError, ValueError, json.JSONDecodeError):
                parsed_payload = None

        return {
            'notification_id': self.notification_id,
            'username': self.username,
            'event_type': self.event_type,
            'title': self.title,
            'message': self.message,
            'payload': parsed_payload,
            'is_read': bool(self.is_read),
            'is_dismissed': bool(self.is_dismissed),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'dismissed_at': self.dismissed_at.isoformat() if self.dismissed_at else None,
        }

    def __repr__(self):
        return f'<Notification {self.notification_id} for {self.username}>'
