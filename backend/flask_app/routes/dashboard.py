from flask import Blueprint, render_template, session, redirect, url_for, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models.models import db, Sale, Bill, Product, Inventory, UserDetail
from sqlalchemy import func, desc
from datetime import datetime, timedelta, date
import calendar
from flask_app.extensions import cache
from flask_app.utils.cache_utils import global_cache_key, owner_cache_key

# Create Blueprint
dashboard_bp = Blueprint(
    "dashboard_bp", 
    __name__,
    url_prefix="/api/dashboard"
)

# Dashboard Statistics API
@dashboard_bp.route("/stats", methods=["GET"])
@jwt_required()
@cache.cached(timeout=120, key_prefix=owner_cache_key)
def get_dashboard_stats():
    """
    Get comprehensive dashboard statistics for the logged-in owner
    """
    try:
        current_user = get_jwt_identity()
        
        # Get user's inventory
        inventory = Inventory.query.filter_by(username=current_user).first()
        if not inventory:
            return jsonify({"success": False, "message": "Inventory not found"}), 404
        
        inventory_id = inventory.inventory_id
        
        # Get current month and previous month dates
        today = date.today()
        first_day_current_month = today.replace(day=1)
        last_month = first_day_current_month - timedelta(days=1)
        first_day_last_month = last_month.replace(day=1)
        
        # Get all sales for this inventory through products
        product_ids = [p.product_id for p in Product.query.filter_by(inventory_id=inventory_id).all()]
        
        # Calculate metrics for current month
        current_month_sales = db.session.query(Sale).join(
            Bill, Sale.bill_id == Bill.bill_id
        ).filter(
            Bill.product_id.in_(product_ids),
            Sale.date_of_purchase >= first_day_current_month
        ).all()
        
        # Calculate metrics for previous month
        previous_month_sales = db.session.query(Sale).join(
            Bill, Sale.bill_id == Bill.bill_id
        ).filter(
            Bill.product_id.in_(product_ids),
            Sale.date_of_purchase >= first_day_last_month,
            Sale.date_of_purchase < first_day_current_month
        ).all()
        
        # Calculate totals
        total_sales_current = sum(sale.total_cost for sale in current_month_sales)
        
        # Calculate average transaction value
        num_transactions_current = len(current_month_sales)
        avg_transaction_value_current = total_sales_current / num_transactions_current if num_transactions_current > 0 else 0
        
        # Calculate total units sold from bills
        total_units_sold_current = db.session.query(func.sum(Bill.units)).join(
            Sale, Bill.bill_id == Sale.bill_id
        ).filter(
            Bill.product_id.in_(product_ids),
            Sale.date_of_purchase >= first_day_current_month
        ).scalar() or 0
        
        # Get unique customers count
        unique_customers_current = len(set(sale.customer_phone for sale in current_month_sales if sale.customer_phone))
        
        # Previous month totals
        total_sales_previous = sum(sale.total_cost for sale in previous_month_sales)
        num_transactions_previous = len(previous_month_sales)
        avg_transaction_value_previous = total_sales_previous / num_transactions_previous if num_transactions_previous > 0 else 0
        
        # Calculate total units sold for previous month
        total_units_sold_previous = db.session.query(func.sum(Bill.units)).join(
            Sale, Bill.bill_id == Sale.bill_id
        ).filter(
            Bill.product_id.in_(product_ids),
            Sale.date_of_purchase >= first_day_last_month,
            Sale.date_of_purchase < first_day_current_month
        ).scalar() or 0
        
        unique_customers_previous = len(set(sale.customer_phone for sale in previous_month_sales if sale.customer_phone))
        
        # Calculate growth percentages
        sales_growth = ((total_sales_current - total_sales_previous) / total_sales_previous * 100) if total_sales_previous > 0 else 0
        avg_transaction_growth = ((avg_transaction_value_current - avg_transaction_value_previous) / avg_transaction_value_previous * 100) if avg_transaction_value_previous > 0 else 0
        units_sold_growth = ((total_units_sold_current - total_units_sold_previous) / total_units_sold_previous * 100) if total_units_sold_previous > 0 else 0
        customers_growth = ((unique_customers_current - unique_customers_previous) / unique_customers_previous * 100) if unique_customers_previous > 0 else 0
        
        # Payment methods breakdown
        payment_methods = {}
        for sale in current_month_sales:
            method = sale.payment_method or 'cash'
            payment_methods[method] = payment_methods.get(method, 0) + sale.total_cost
        
        payment_methods_list = [
            {"name": method.capitalize(), "value": value}
            for method, value in payment_methods.items()
        ]
        
        # Revenue overview for past 12 months
        revenue_data = []
        for i in range(11, -1, -1):
            month_date = today - timedelta(days=30*i)
            first_day = month_date.replace(day=1)
            
            if i == 0:
                last_day = today
            else:
                next_month = first_day + timedelta(days=32)
                last_day = next_month.replace(day=1) - timedelta(days=1)
            
            month_sales = db.session.query(Sale).join(
                Bill, Sale.bill_id == Bill.bill_id
            ).filter(
                Bill.product_id.in_(product_ids),
                Sale.date_of_purchase >= first_day,
                Sale.date_of_purchase <= last_day
            ).all()
            
            month_revenue = sum(sale.total_cost for sale in month_sales)
            month_sales_count = len(month_sales)
            
            revenue_data.append({
                "month": calendar.month_abbr[first_day.month],
                "revenue": month_revenue,
                "sales": month_sales_count
            })
        
        # Recent transactions (last 5 from current month)
        recent_sales = db.session.query(Sale).join(
            Bill, Sale.bill_id == Bill.bill_id
        ).filter(
            Bill.product_id.in_(product_ids),
            Sale.date_of_purchase >= first_day_current_month
        ).order_by(desc(Sale.date_of_purchase)).limit(5).all()
        
        recent_transactions = [
            {
                "id": f"#{sale.bill_id}",
                "customer": sale.customer_name or "Walk-in Customer",
                "amount": sale.total_cost,
                "date": sale.date_of_purchase.isoformat(),
                "status": "completed" if not sale.credit else "pending"
            }
            for sale in recent_sales
        ]
        
        # Top 5 products by sales amount
        top_products_query = db.session.query(
            Bill.product_name,
            func.sum(Bill.units).label('total_quantity'),
            func.sum(Bill.units * Bill.unit_price).label('total_sales')
        ).join(
            Sale, Bill.bill_id == Sale.bill_id
        ).filter(
            Bill.product_id.in_(product_ids),
            Sale.date_of_purchase >= first_day_current_month
        ).group_by(
            Bill.product_name
        ).order_by(
            desc('total_sales')
        ).limit(5).all()
        
        top_products = [
            {
                "name": product.product_name,
                "quantity": int(product.total_quantity),
                "sales": int(product.total_sales)
            }
            for product in top_products_query
        ]
        
        # Prepare response
        response = {
            "success": True,
            "data": {
                "totalSales": total_sales_current,
                "avgTransactionValue": round(avg_transaction_value_current, 2),
                "totalUnitsSold": int(total_units_sold_current),
                "customers": unique_customers_current,
                "salesGrowth": round(sales_growth, 1),
                "avgTransactionGrowth": round(avg_transaction_growth, 1),
                "unitsSoldGrowth": round(units_sold_growth, 1),
                "customersGrowth": round(customers_growth, 1),
                "paymentMethods": payment_methods_list,
                "revenueData": revenue_data,
                "recentTransactions": recent_transactions,
                "topProducts": top_products
            }
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        print(f"Error fetching dashboard stats: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500


@dashboard_bp.route("/admin-stats", methods=["GET"])
@jwt_required()
@cache.cached(timeout=180, key_prefix=global_cache_key)
def get_admin_stats():
    """
    Admin-level analytics across the entire platform
    """
    try:
        current_user = get_jwt_identity()
        user = UserDetail.query.get(current_user)

        # 🔐 Ensure only admin can access
        if not user or user.role != "admin":
            return jsonify({"success": False, "message": "Unauthorized"}), 403

        # =========================
        # 👥 USER ANALYTICS
        # =========================
        total_users = UserDetail.query.count()
        total_owners = UserDetail.query.filter(UserDetail.role.in_(["owner", "user"])).count()
        total_cashiers = UserDetail.query.filter_by(role="cashier").count()

        # =========================
        # 🏪 INVENTORY ANALYTICS
        # =========================
        total_inventories = Inventory.query.count()
        total_products = Product.query.count()

        # =========================
        # 💰 SALES ANALYTICS
        # =========================
        total_sales = db.session.query(func.sum(Sale.total_cost)).scalar() or 0
        total_transactions = Sale.query.count()

        # =========================
        # 📅 MONTHLY SALES (last 6 months)
        # =========================
        today = date.today()
        monthly_data = []

        for i in range(5, -1, -1):
            month_date = today - timedelta(days=30*i)
            first_day = month_date.replace(day=1)

            next_month = first_day + timedelta(days=32)
            last_day = next_month.replace(day=1) - timedelta(days=1)

            sales = db.session.query(func.sum(Sale.total_cost)).filter(
                Sale.date_of_purchase >= first_day,
                Sale.date_of_purchase <= last_day
            ).scalar() or 0

            monthly_data.append({
                "month": calendar.month_abbr[first_day.month],
                "sales": int(sales)
            })

        # =========================
        # 👥 USER GROUPING
        # =========================

        owners = UserDetail.query.filter(UserDetail.role.in_(["owner", "user"])).all()
        cashiers = UserDetail.query.filter_by(role="cashier").all()
        admins = UserDetail.query.filter_by(role="admin").all()

        def format_user(user):
            return {
                "username": user.username,
                "name": user.full_name,
                "email": user.email,
                "role": user.role
            }

        owners_list = [format_user(u) for u in owners]
        cashiers_list = [format_user(u) for u in cashiers]
        # admins_list = [format_user(u) for u in admins]

        # =========================
        # 🧑‍💻 TOP OWNERS
        # =========================
        top_owners_query = db.session.query(
            Sale.owner_username,
            func.sum(Sale.total_cost).label("total_sales")
        ).group_by(Sale.owner_username).order_by(desc("total_sales")).limit(5).all()

        top_owners = [
            {
                "owner": owner.owner_username,
                "sales": int(owner.total_sales)
            }
            for owner in top_owners_query
        ]

        return jsonify({
            "success": True,
            "data": {
                "totalUsers": total_users,
                "totalOwners": total_owners,
                "totalCashiers": total_cashiers,
                "totalInventories": total_inventories,
                "totalProducts": total_products,
                "totalSales": int(total_sales),
                "totalTransactions": total_transactions,
                "monthlySales": monthly_data,
                "topOwners": top_owners,
                "owners": owners_list,
                "cashiers": cashiers_list
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

