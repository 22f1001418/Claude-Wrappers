"""
Routes for owner unknown-item batch uploads.
"""

import json
import os
from io import BytesIO
from zipfile import ZipFile, ZIP_DEFLATED

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from ..models.models import db, UserDetail, UnknownItem

unknown_items_bp = Blueprint(
    "unknown_items_bp",
    __name__,
    url_prefix="/api/unknown-items"
)

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _project_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _uploads_root():
    return os.path.join(_project_root(), "uploads", "unknown_items")


def _is_allowed_image(filename, mimetype):
    _, extension = os.path.splitext(filename.lower())
    if extension in ALLOWED_IMAGE_EXTENSIONS:
        return True
    return bool(mimetype and mimetype.startswith("image/"))


def _is_admin(username):
    user = UserDetail.query.get(username)
    return bool(user and user.role == "admin")


@unknown_items_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_unknown_item_batch():
    try:
        current_username = get_jwt_identity()
        user = UserDetail.query.get(current_username)

        if not user or user.role not in {"owner", "user"}:
            return jsonify({"success": False, "message": "Unauthorized"}), 403

        images = request.files.getlist("images")
        if not images:
            return jsonify({"success": False, "message": "Please upload at least 10 images."}), 400

        if len(images) < 10:
            return jsonify({"success": False, "message": "At least 10 images are required for each batch."}), 400

        invalid_files = []
        for upload_file in images:
            filename = upload_file.filename or ""
            if not filename or not _is_allowed_image(filename, upload_file.mimetype):
                invalid_files.append(filename or "unnamed file")

        if invalid_files:
            return jsonify({
                "success": False,
                "message": f"Only image files are allowed. Invalid files: {', '.join(invalid_files)}"
            }), 400

        os.makedirs(_uploads_root(), exist_ok=True)

        unknown_item = UnknownItem(class_name=None, count=len(images), image=json.dumps([]))
        db.session.add(unknown_item)
        db.session.flush()

        batch_name = f"unknown_item_{unknown_item.item_id}"
        batch_dir = os.path.join(_uploads_root(), batch_name)
        os.makedirs(batch_dir, exist_ok=True)

        saved_paths = []

        try:
            for index, upload_file in enumerate(images, start=1):
                original_name = secure_filename(upload_file.filename or f"image_{index}.jpg")
                if not original_name:
                    original_name = f"image_{index}.jpg"

                stored_name = f"{index:02d}_{original_name}"
                full_path = os.path.join(batch_dir, stored_name)
                upload_file.save(full_path)

                relative_path = os.path.relpath(full_path, _project_root()).replace(os.sep, "/")
                saved_paths.append(relative_path)

            unknown_item.class_name = batch_name
            unknown_item.count = len(saved_paths)
            unknown_item.set_images(saved_paths)
            db.session.commit()

            return jsonify({
                "success": True,
                "message": "Unknown item batch uploaded successfully.",
                "data": unknown_item.to_dict()
            }), 201

        except Exception as upload_error:
            db.session.rollback()

            for saved_path in saved_paths:
                try:
                    absolute_path = os.path.join(_project_root(), saved_path.replace("/", os.sep))
                    if os.path.exists(absolute_path):
                        os.remove(absolute_path)
                except Exception:
                    pass

            try:
                if os.path.isdir(batch_dir) and not os.listdir(batch_dir):
                    os.rmdir(batch_dir)
            except Exception:
                pass

            return jsonify({
                "success": False,
                "message": f"Failed to save uploaded images: {str(upload_error)}"
            }), 500

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@unknown_items_bp.route("/", methods=["GET"])
@jwt_required()
def get_unknown_item_batches():
    try:
        current_username = get_jwt_identity()
        if not _is_admin(current_username):
            return jsonify({"success": False, "message": "Unauthorized"}), 403

        items = UnknownItem.query.order_by(UnknownItem.item_id.desc()).all()
        payload = []

        for item in items:
            images = item.get_images()
            payload.append({
                "item_id": item.item_id,
                "class_name": item.class_name,
                "count": item.count,
                "images_count": len(images),
                "sample_image": images[0] if images else None
            })

        return jsonify({
            "success": True,
            "data": {
                "batches": payload,
                "total": len(payload)
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@unknown_items_bp.route("/<int:item_id>/download", methods=["GET"])
@jwt_required()
def download_unknown_item_batch(item_id):
    try:
        current_username = get_jwt_identity()
        if not _is_admin(current_username):
            return jsonify({"success": False, "message": "Unauthorized"}), 403

        item = UnknownItem.query.get(item_id)
        if not item:
            return jsonify({"success": False, "message": "Unknown item batch not found"}), 404

        images = item.get_images()
        if not images:
            return jsonify({"success": False, "message": "No images found for this batch"}), 404

        zip_buffer = BytesIO()
        files_added = 0

        with ZipFile(zip_buffer, "w", ZIP_DEFLATED) as zip_file:
            for image_path in images:
                absolute_path = os.path.join(_project_root(), image_path.replace("/", os.sep))
                if not os.path.exists(absolute_path):
                    continue
                arcname = os.path.basename(absolute_path)
                zip_file.write(absolute_path, arcname=arcname)
                files_added += 1

        if files_added == 0:
            return jsonify({"success": False, "message": "Batch images are missing on server"}), 404

        zip_buffer.seek(0)
        download_name = f"{item.class_name or f'unknown_item_{item.item_id}'}.zip"

        return send_file(
            zip_buffer,
            mimetype="application/zip",
            as_attachment=True,
            download_name=download_name
        )

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500