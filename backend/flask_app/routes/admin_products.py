from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models.models import db, UserDetail, ListedProduct  # ✅ FIXED IMPORT
from flask_app.utils.notification_utils import create_notifications_for_users

admin_products_bp = Blueprint(
    "admin_products_bp",
    __name__,
    url_prefix="/api/admin-products"
)


def _require_admin(username):
    user = UserDetail.query.get(username)
    if not user or user.role != "admin":
        return None
    return user

@admin_products_bp.route("/", methods=["GET"])
@jwt_required()
def get_all_products():
    try:
        current_user = get_jwt_identity()
        user = _require_admin(current_user)

        if not user:
            return jsonify({
                "success": False,
                "message": "Unauthorized"
            }), 403

        products = ListedProduct.query.all()

        product_list = [
            {
                "id": p.item_id,
                "name": p.class_name
            }
            for p in products
        ]

        return jsonify({
            "success": True,
            "data": {
                "products": product_list,
                "total": len(product_list)
            }
        }), 200

    except Exception as e:
        print("ERROR (admin-products):", str(e))
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500


@admin_products_bp.route("/", methods=["POST"])
@jwt_required()
def create_product_listing():
    try:
        current_user = get_jwt_identity()
        user = _require_admin(current_user)

        if not user:
            return jsonify({
                "success": False,
                "message": "Unauthorized"
            }), 403

        data = request.get_json() or {}
        class_name = str(data.get("class_name", "")).strip()

        if not class_name:
            return jsonify({
                "success": False,
                "message": "class_name is required"
            }), 400

        existing = ListedProduct.query.filter_by(class_name=class_name).first()
        if existing:
            return jsonify({
                "success": False,
                "message": "This class_name already exists in listed products"
            }), 409

        new_product = ListedProduct(class_name=class_name)
        db.session.add(new_product)
        db.session.commit()

        recipients = [u.username for u in UserDetail.query.filter(UserDetail.username != current_user).all()]
        create_notifications_for_users(
            recipients,
            event_type="listed_product_added",
            title="New listed product available",
            message=f"{class_name} was added to listed products by admin {current_user}.",
            payload={"class_name": class_name, "added_by": current_user},
        )

        return jsonify({
            "success": True,
            "message": "Listed product created successfully",
            "data": {
                "id": new_product.item_id,
                "name": new_product.class_name
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        print("ERROR (admin-products create):", str(e))
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500