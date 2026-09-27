"""
Inventory Management Routes
Handles product inventory, statistics, and analytics
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import date, timedelta
from sqlalchemy import func, and_, or_
from flask_app.extensions import cache
from flask_app.utils.cache_utils import owner_cache_key
from flask_app.utils.notification_utils import create_notification

from flask_app.models.models import (
    db,
    UserDetail,
    Inventory,
    ListedProduct,
    Product,
    Sale,
    Bill,
    Cashier
)

inventory_bp = Blueprint('inventory', __name__)


def get_user_inventory_id(username):
    """
    Get inventory_id for the given user (owner or cashier)
    - If owner: return their inventory
    - If cashier: return their owner's inventory
    """
    user = UserDetail.query.filter_by(username=username).first()
    
    if not user:
        return None
    
    if user.role == "owner":
        # Get owner's inventory
        inventory = Inventory.query.filter_by(username=username).first()
        return inventory.inventory_id if inventory else None
    
    elif user.role == "cashier":
        # Get the owner who added this cashier
        cashier_record = Cashier.query.filter_by(cashier_username=username).first()
        if not cashier_record:
            return None
        
        # Get the owner's inventory
        inventory = Inventory.query.filter_by(username=cashier_record.added_by_owner).first()
        return inventory.inventory_id if inventory else None
    
    elif user.role == "user":
        # Regular employee - might not have inventory access
        # For now, return None or handle based on requirements
        return None
    
    return None


@inventory_bp.route('/api/inventory/products', methods=['GET'])
@jwt_required()
@cache.cached(timeout=90, key_prefix=owner_cache_key)
def get_products():
    """
    Get all products for the logged-in user's inventory
    """
    try:
        current_user = get_jwt_identity()
        inventory_id = get_user_inventory_id(current_user)
        
        if not inventory_id:
            return jsonify({
                'success': False,
                'message': 'No inventory found for this user'
            }), 404
        
        # Get all products in this inventory
        products = Product.query.filter_by(inventory_id=inventory_id).all()
        
        return jsonify({
            'success': True,
            'products': [product.to_dict() for product in products]
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error fetching products: {str(e)}'
        }), 500


@inventory_bp.route('/api/inventory/low-stock', methods=['GET'])
@jwt_required()
@cache.cached(timeout=60, key_prefix=owner_cache_key)
def get_low_stock():
    """
    Get low stock items using the owner's configured threshold.
    """
    try:
        current_user = get_jwt_identity()
        inventory_id = get_user_inventory_id(current_user)
        
        if not inventory_id:
            return jsonify({
                'success': False,
                'message': 'No inventory found for this user'
            }), 404
        
        inventory = Inventory.query.filter_by(inventory_id=inventory_id).first()
        owner_username = inventory.username if inventory else current_user
        owner = UserDetail.query.filter_by(username=owner_username).first()
        low_stock_threshold = int(getattr(owner, "low_stock_threshold", 10) or 10)

        # Get products with low stock
        low_stock_products = Product.query.filter(
            and_(
                Product.inventory_id == inventory_id,
                Product.stock <= low_stock_threshold
            )
        ).all()
        
        return jsonify({
            'success': True,
            'low_stock_threshold': low_stock_threshold,
            'low_stock_items': [
                {
                    'product_name': product.product_name,
                    'stock': product.stock,
                    'product_id': product.product_id
                }
                for product in low_stock_products
            ]
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error fetching low stock items: {str(e)}'
        }), 500


@inventory_bp.route('/api/inventory/stats', methods=['GET'])
@jwt_required()
@cache.cached(timeout=120, key_prefix=owner_cache_key)
def get_inventory_stats():
    """
    Get inventory statistics for dashboard cards:
    1. Most sold product today
    2. Most sold product this week
    3. Products not sold in 15 days
    4. Product with highest revenue
    """
    try:
        current_user = get_jwt_identity()
        inventory_id = get_user_inventory_id(current_user)
        
        if not inventory_id:
            return jsonify({
                'success': False,
                'message': 'No inventory found for this user'
            }), 404
        
        # Date ranges
        today = date.today()
        week_ago = today - timedelta(days=7)
        fifteen_days_ago = today - timedelta(days=15)
        
        # 1. Most sold product TODAY
        most_sold_today = db.session.query(
            Bill.product_name,
            func.sum(Bill.units).label('total_units')
        ).join(
            Sale, Sale.bill_id == Bill.bill_id
        ).join(
            Product, Product.product_id == Bill.product_id
        ).filter(
            and_(
                Product.inventory_id == inventory_id,
                Sale.date_of_purchase == today
            )
        ).group_by(
            Bill.product_name
        ).order_by(
            func.sum(Bill.units).desc()
        ).first()
        
        most_sold_today_data = {
            'product': most_sold_today[0] if most_sold_today else 'No sales today',
            'units': int(most_sold_today[1]) if most_sold_today else 0
        }
        
        # 2. Most sold product THIS WEEK
        most_sold_week = db.session.query(
            Bill.product_name,
            func.sum(Bill.units).label('total_units')
        ).join(
            Sale, Sale.bill_id == Bill.bill_id
        ).join(
            Product, Product.product_id == Bill.product_id
        ).filter(
            and_(
                Product.inventory_id == inventory_id,
                Sale.date_of_purchase >= week_ago
            )
        ).group_by(
            Bill.product_name
        ).order_by(
            func.sum(Bill.units).desc()
        ).first()
        
        most_sold_week_data = {
            'product': most_sold_week[0] if most_sold_week else 'No sales this week',
            'units': int(most_sold_week[1]) if most_sold_week else 0
        }
        
        # 3. Products NOT sold in last 15 days
        # Get all products in inventory
        all_products = db.session.query(Product.product_id).filter(
            Product.inventory_id == inventory_id
        ).all()
        all_product_ids = [p[0] for p in all_products]
        
        # Get products sold in last 15 days
        sold_products = db.session.query(Bill.product_id).join(
            Sale, Sale.bill_id == Bill.bill_id
        ).filter(
            and_(
                Bill.product_id.in_(all_product_ids),
                Sale.date_of_purchase >= fifteen_days_ago
            )
        ).distinct().all()
        sold_product_ids = [p[0] for p in sold_products]
        
        # Products not sold = all products - sold products
        not_sold_count = len(all_product_ids) - len(sold_product_ids)
        
        not_sold_data = {
            'count': not_sold_count
        }
        
        # 4. Product with HIGHEST REVENUE (all time)
        highest_revenue = db.session.query(
            Bill.product_name,
            func.sum(Bill.units * Bill.unit_price).label('total_revenue')
        ).join(
            Product, Product.product_id == Bill.product_id
        ).filter(
            Product.inventory_id == inventory_id
        ).group_by(
            Bill.product_name
        ).order_by(
            func.sum(Bill.units * Bill.unit_price).desc()
        ).first()
        
        highest_revenue_data = {
            'product': highest_revenue[0] if highest_revenue else 'No sales yet',
            'revenue': int(highest_revenue[1]) if highest_revenue else 0
        }
        
        return jsonify({
            'success': True,
            'stats': {
                'mostSoldToday': most_sold_today_data,
                'mostSoldWeek': most_sold_week_data,
                'notSold15Days': not_sold_data,
                'highestRevenue': highest_revenue_data
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error fetching stats: {str(e)}'
        }), 500


@inventory_bp.route('/api/inventory/restock-recommendations', methods=['GET'])
@jwt_required()
@cache.cached(timeout=300, key_prefix=owner_cache_key)
def get_restock_recommendations():
    """
    Get restock recommendations for products that need reordering
    Calculates based on:
    - Average daily sales over last 30 days
    - Days of stock left
    - Priority level (high/medium/low)
    """
    try:
        current_user = get_jwt_identity()
        inventory_id = get_user_inventory_id(current_user)
        
        if not inventory_id:
            return jsonify({
                'success': False,
                'message': 'No inventory found for this user'
            }), 404
        
        # Configuration
        DAYS_THRESHOLD = 7  # Alert if days_left < 7
        TARGET_DAYS = 30    # Target stock for 30 days
        ANALYSIS_PERIOD = 30  # Analyze last 30 days of sales
        
        today = date.today()
        analysis_start = today - timedelta(days=ANALYSIS_PERIOD)
        
        # Get all products in inventory
        products = Product.query.filter_by(inventory_id=inventory_id).all()
        
        recommendations = []
        
        for product in products:
            # Calculate total units sold in the analysis period
            total_sold = db.session.query(
                func.sum(Bill.units).label('total_units')
            ).join(
                Sale, Sale.bill_id == Bill.bill_id
            ).filter(
                and_(
                    Bill.product_id == product.product_id,
                    Sale.date_of_purchase >= analysis_start,
                    Sale.date_of_purchase <= today
                )
            ).scalar()
            
            total_sold = total_sold or 0
            
            # Calculate average daily sales
            avg_daily_sales = total_sold / ANALYSIS_PERIOD
            
            # Calculate days of stock left
            if avg_daily_sales > 0:
                days_left = product.stock / avg_daily_sales
            else:
                # If no sales, set days_left to infinity (well-stocked)
                days_left = float('inf')
            
            # Only recommend if days_left < threshold or stock is very low
            if days_left < DAYS_THRESHOLD or product.stock <= 5:
                # Calculate recommended reorder quantity
                target_stock = TARGET_DAYS * avg_daily_sales
                recommended_qty = max(0, int(target_stock - product.stock))
                
                # Determine priority
                if days_left < 2 or product.stock <= 5:
                    priority = 'high priority'
                elif days_left < 4:
                    priority = 'medium priority'
                else:
                    priority = 'low priority'
                
                recommendations.append({
                    'product_id': product.product_id,
                    'product_name': product.product_name,
                    'brand': product.brand,
                    'current_stock': product.stock,
                    'avg_daily_sales': round(avg_daily_sales, 2),
                    'days_left': round(days_left, 1) if days_left != float('inf') else 'No sales',
                    'recommended_qty': recommended_qty,
                    'priority': priority,
                    'unit_price': product.unit_price
                })
        
        # Sort by priority (high -> medium -> low) and then by days_left
        priority_order = {'high priority': 0, 'medium priority': 1, 'low priority': 2}
        recommendations.sort(key=lambda x: (
            priority_order[x['priority']],
            x['days_left'] if isinstance(x['days_left'], (int, float)) else float('inf')
        ))
        
        return jsonify({
            'success': True,
            'recommendations': recommendations
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error fetching restock recommendations: {str(e)}'
        }), 500


@inventory_bp.route('/api/inventory/available-products', methods=['GET'])
@jwt_required()
def get_available_products():
    try:
        current_user = get_jwt_identity()
        inventory_id = get_user_inventory_id(current_user)

        if not inventory_id:
            return jsonify({
                "success": False,
                "message": "No inventory found for this user"
            }), 404

        # Get products already in inventory
        existing_products = db.session.query(Product.class_name).filter_by(
            inventory_id=inventory_id
        ).all()

        existing_class_names = [p[0] for p in existing_products]

        # Get products NOT in inventory
        available_products = ListedProduct.query.filter(
            ~ListedProduct.class_name.in_(existing_class_names)
        ).all()

        return jsonify({
            "success": True,
            "products": [p.to_dict() for p in available_products]
        }), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    


@inventory_bp.route('/api/inventory/add-product', methods=['POST'])
@jwt_required()
def add_product():
    try:
        data = request.get_json() or {}
        current_user = get_jwt_identity()
        inventory_id = get_user_inventory_id(current_user)

        required_fields = ['class_name', 'product_name', 'brand', 'unit_price', 'stock']
        missing_fields = [field for field in required_fields if not str(data.get(field, '')).strip()]

        if missing_fields:
            return jsonify({
                "success": False,
                "message": f"Missing required fields: {', '.join(missing_fields)}"
            }), 400

        if not inventory_id:
            return jsonify({"success": False, "message": "No inventory found for this user"}), 404

        new_product = Product(
            inventory_id=inventory_id,
            class_name=str(data['class_name']).strip(),
            product_name=str(data['product_name']).strip(),
            brand=str(data['brand']).strip(),
            unit_price=int(data['unit_price']),
            stock=int(data['stock'])
        )

        db.session.add(new_product)
        db.session.commit()

        create_notification(
            current_user,
            event_type='inventory_product_added',
            title='Product added to inventory',
            message=f"{new_product.product_name} was added with stock {new_product.stock}.",
            payload={
                'product_id': new_product.product_id,
                'product_name': new_product.product_name,
                'stock': new_product.stock,
            },
        )

        return jsonify({"success": True, "message": "Product added"}), 201

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    

@inventory_bp.route('/api/inventory/update-product/<int:product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    try:
        data = request.get_json() or {}

        product = Product.query.get(product_id)
        if not product:
            return jsonify({"success": False, "message": "Product not found"}), 404

        required_fields = ['unit_price', 'stock']
        missing_fields = [field for field in required_fields if not str(data.get(field, '')).strip()]

        if missing_fields:
            return jsonify({
                "success": False,
                "message": f"Missing required fields: {', '.join(missing_fields)}"
            }), 400

        product.unit_price = int(data['unit_price'])
        product.stock = int(data['stock'])

        db.session.commit()

        return jsonify({"success": True, "message": "Updated successfully"}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    

@inventory_bp.route('/api/inventory/delete-product/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    try:
        product = Product.query.get(product_id)

        if not product:
            return jsonify({"success": False, "message": "Product not found"}), 404

        db.session.delete(product)
        db.session.commit()

        return jsonify({"success": True, "message": "Deleted successfully"}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500