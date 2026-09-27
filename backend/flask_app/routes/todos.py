from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models.models import db, Todo
from datetime import datetime, date

# Create Blueprint
todos_bp = Blueprint(
    "todos_bp",
    __name__,
    url_prefix="/api/todos"
)

@todos_bp.route("", methods=["GET"])
@jwt_required()
def get_todos():
    """Get all todos for the logged-in user"""
    try:
        current_user = get_jwt_identity()
        todos = Todo.query.filter_by(username=current_user).order_by(Todo.date.asc(), Todo.created_at.desc()).all()
        
        return jsonify({
            "success": True,
            "todos": [todo.to_dict() for todo in todos]
        }), 200
    except Exception as e:
        print(f"Error fetching todos: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500


@todos_bp.route("", methods=["POST"])
@jwt_required()
def create_todo():
    """Create a new todo"""
    try:
        current_user = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        if not data.get("title"):
            return jsonify({"success": False, "message": "Title is required"}), 400
        if not data.get("date"):
            return jsonify({"success": False, "message": "Date is required"}), 400
        
        # Parse date
        try:
            todo_date = datetime.strptime(data["date"], "%Y-%m-%d").date()
        except:
            return jsonify({"success": False, "message": "Invalid date format. Use YYYY-MM-DD"}), 400
        
        # Create todo
        todo = Todo(
            username=current_user,
            title=data["title"],
            description=data.get("description", ""),
            date=todo_date,
            time=data.get("time", ""),
            priority=data.get("priority", "medium"),
            category=data.get("category", "Work"),
            completed=data.get("completed", False)
        )
        
        db.session.add(todo)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Todo created successfully",
            "todo": todo.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error creating todo: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500


@todos_bp.route("/<int:todo_id>", methods=["PUT"])
@jwt_required()
def update_todo(todo_id):
    """Update an existing todo"""
    try:
        current_user = get_jwt_identity()
        todo = Todo.query.filter_by(todo_id=todo_id, username=current_user).first()
        
        if not todo:
            return jsonify({"success": False, "message": "Todo not found"}), 404
        
        data = request.get_json()
        
        # Update fields
        if "title" in data:
            todo.title = data["title"]
        if "description" in data:
            todo.description = data["description"]
        if "date" in data:
            try:
                todo.date = datetime.strptime(data["date"], "%Y-%m-%d").date()
            except:
                return jsonify({"success": False, "message": "Invalid date format. Use YYYY-MM-DD"}), 400
        if "time" in data:
            todo.time = data["time"]
        if "priority" in data:
            todo.priority = data["priority"]
        if "category" in data:
            todo.category = data["category"]
        if "completed" in data:
            todo.completed = data["completed"]
        
        todo.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Todo updated successfully",
            "todo": todo.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error updating todo: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500


@todos_bp.route("/<int:todo_id>", methods=["DELETE"])
@jwt_required()
def delete_todo(todo_id):
    """Delete a todo"""
    try:
        current_user = get_jwt_identity()
        todo = Todo.query.filter_by(todo_id=todo_id, username=current_user).first()
        
        if not todo:
            return jsonify({"success": False, "message": "Todo not found"}), 404
        
        db.session.delete(todo)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Todo deleted successfully"
        }), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting todo: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500


@todos_bp.route("/<int:todo_id>/toggle", methods=["PATCH"])
@jwt_required()
def toggle_todo(todo_id):
    """Toggle todo completion status"""
    try:
        current_user = get_jwt_identity()
        todo = Todo.query.filter_by(todo_id=todo_id, username=current_user).first()
        
        if not todo:
            return jsonify({"success": False, "message": "Todo not found"}), 404
        
        todo.completed = not todo.completed
        todo.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Todo status updated",
            "todo": todo.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error toggling todo: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500
