from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models.models import db, Note
from datetime import datetime

# Create Blueprint
notes_bp = Blueprint(
    "notes_bp",
    __name__,
    url_prefix="/api/notes"
)

@notes_bp.route("", methods=["GET"])
@jwt_required()
def get_notes():
    """Get all notes for the logged-in user"""
    try:
        current_user = get_jwt_identity()
        notes = Note.query.filter_by(username=current_user).order_by(Note.created_at.desc()).all()
        
        return jsonify({
            "success": True,
            "notes": [note.to_dict() for note in notes]
        }), 200
    except Exception as e:
        print(f"Error fetching notes: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500


@notes_bp.route("", methods=["POST"])
@jwt_required()
def create_note():
    """Create a new note"""
    try:
        current_user = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        if not data.get("text"):
            return jsonify({"success": False, "message": "Note text is required"}), 400
        
        # Create note
        note = Note(
            username=current_user,
            text=data["text"],
            created_at=datetime.utcnow()
        )
        
        db.session.add(note)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Note created successfully",
            "note": note.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error creating note: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500


@notes_bp.route("/<int:note_id>", methods=["DELETE"])
@jwt_required()
def delete_note(note_id):
    """Delete a note"""
    try:
        current_user = get_jwt_identity()
        
        # Find the note
        note = Note.query.filter_by(note_id=note_id, username=current_user).first()
        
        if not note:
            return jsonify({"success": False, "message": "Note not found"}), 404
        
        db.session.delete(note)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Note deleted successfully"
        }), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting note: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500
