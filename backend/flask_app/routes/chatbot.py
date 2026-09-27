"""
Chatbot Routes for VyaपारAI
Handles AI chatbot interactions using RAG system
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import sys
import os

# Add parent directory to path for chatbot imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from chatbot.rag_system import ask_vyaparai
from chatbot.user_chatbot import ask_owner_chatbot
from flask_app.models.models import db

chatbot_bp = Blueprint('chatbot', __name__, url_prefix='/api/chatbot')


@chatbot_bp.route('/chat', methods=['POST'])
def chat():
    """
    Process a chat message and return AI response
    
    Expected JSON body:
    {
        "question": "string"
    }
    
    Returns:
    {
        "answer": "string"
    }
    
    Note: This endpoint is public and does not require authentication
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        question = data.get('question', '').strip()
        
        if not question:
            return jsonify({'error': 'Question is required'}), 400
        
        # Get AI response using RAG system
        answer = ask_vyaparai(question)
        
        return jsonify({
            'answer': answer,
            'question': question
        }), 200
        
    except Exception as e:
        print(f"Error processing chat: {e}")
        return jsonify({'error': f'Failed to process chat: {str(e)}'}), 500


@chatbot_bp.route('/user-chat', methods=['POST'])
@jwt_required()
def user_chat():
    """
    Process a user/owner chatbot message with database queries
    **Requires JWT authentication**
    
    Expected JSON body:
    {
        "question": "string"
    }
    
    Returns:
    {
        "answer": "string"
    }
    
    Note: This endpoint provides personalized business analytics responses
          using the authenticated user's username from JWT token
    """
    try:
        # Get authenticated user's username from JWT token
        current_user = get_jwt_identity()
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        question = data.get('question', '').strip()
        
        if not question:
            return jsonify({'error': 'Question is required'}), 400
        
        # Get AI response using owner chatbot with database queries
        # Username is automatically taken from authenticated user
        answer = ask_owner_chatbot(question, db.session, current_user)
        
        return jsonify({
            'answer': answer,
            'question': question
        }), 200
        
    except Exception as e:
        print(f"Error processing user chat: {e}")
        return jsonify({'error': f'Failed to process chat: {str(e)}'}), 500


@chatbot_bp.route('/health', methods=['GET'])
def health():
    """
    Health check endpoint for chatbot service
    """
    return jsonify({
        'status': 'healthy',
        'service': 'chatbot'
    }), 200


@chatbot_bp.route('/history', methods=['GET'])
def get_history():
    """
    Get chat history (placeholder for future implementation)
    
    Note: This endpoint is public. In production, you may want to add authentication.
    """
    try:
        # TODO: Implement chat history storage and retrieval
        return jsonify({
            'message': 'Chat history feature coming soon',
            'history': []
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch history: {str(e)}'}), 500
