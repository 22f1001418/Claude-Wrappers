"""
VyaपारAI Personalized Owner Chatbot
Intelligent chatbot that queries database for sales, inventory, and business insights
"""

import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
from typing import Dict, List, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_app.models.models import (
    db,
    UserDetail,
    Inventory,
    Product,
    Bill,
    Sale,
    ListedProduct,
    UnknownItem
)

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

# Get the base directory (backend folder)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Load .env from project root
load_dotenv(dotenv_path=os.path.join(BASE_DIR, "..", ".env"))

# ==============================
# LLM SETUP
# ==============================

llm = ChatOpenAI(
    model="meta-llama/llama-3.1-8b-instruct",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0.2
)

# ==============================
# DATABASE QUERY FUNCTIONS
# ==============================

class OwnerDataFetcher:
    """
    Handles all database queries for owner analytics
    """
    
    def __init__(self, db_session: Session, username: str):
        """
        Initialize with database session and username
        
        Args:
            db_session: SQLAlchemy database session
            username: Owner's username
        """
        self.db = db_session
        self.username = username
        
        # Get owner's inventory_ids and product_ids upfront for filtering
        self.inventory_ids = self._get_inventory_ids()
        self.product_ids = self._get_product_ids()
    
    def _get_inventory_ids(self) -> List[int]:
        """Get all inventory IDs for this owner"""
        inventories = self.db.query(Inventory).filter(
            Inventory.username == self.username
        ).all()
        return [inv.inventory_id for inv in inventories]
    
    def _get_product_ids(self) -> List[int]:
        """Get all product IDs for this owner's inventories"""
        if not self.inventory_ids:
            return []
        products = self.db.query(Product).filter(
            Product.inventory_id.in_(self.inventory_ids)
        ).all()
        return [p.product_id for p in products]
    
    def get_total_sales(self, days: Optional[int] = None) -> Dict[str, Any]:
        """
        Get total sales information for this owner's products
        
        Args:
            days: Number of days to look back (None defaults to current month like dashboard)
            
        Returns:
            Dict with total sales count, total revenue, and average transaction
        """
        if not self.product_ids:
            return {
                'total_sales_count': 0,
                'total_revenue': 0,
                'average_transaction': 0,
                'period': 'current month'
            }
        
        # Filter sales by owner's products through Bills table
        query = self.db.query(Sale).join(
            Bill, Sale.bill_id == Bill.bill_id
        ).filter(
            Bill.product_id.in_(self.product_ids)
        )
        
        # Default to current month if no days specified (matching dashboard behavior)
        if days is None:
            today = datetime.now().date()
            first_day_current_month = today.replace(day=1)
            query = query.filter(Sale.date_of_purchase >= first_day_current_month)
            period = 'current month'
        elif days:
            cutoff_date = datetime.now().date() - timedelta(days=days)
            query = query.filter(Sale.date_of_purchase >= cutoff_date)
            period = f'last {days} days'
        else:
            period = 'all time'
        
        sales = query.all()
        
        total_count = len(sales)
        total_revenue = sum(sale.total_cost for sale in sales)
        avg_transaction = total_revenue / total_count if total_count > 0 else 0
        
        return {
            'total_sales_count': total_count,
            'total_revenue': total_revenue,
            'average_transaction': avg_transaction,
            'period': period
        }
    
    def get_inventory_summary(self) -> Dict[str, Any]:
        """
        Get inventory summary for owner's stores
        
        Returns:
            Dict with inventory details
        """
        # Get user's inventories
        inventories = self.db.query(Inventory).filter(
            Inventory.username == self.username
        ).all()
        
        if not inventories:
            return {
                'inventory_count': 0,
                'total_products': 0,
                'total_stock_value': 0,
                'inventories': []
            }
        
        inventory_data = []
        total_products = 0
        total_stock_value = 0
        
        for inv in inventories:
            products = self.db.query(Product).filter(
                Product.inventory_id == inv.inventory_id
            ).all()
            
            inv_products_count = len(products)
            inv_stock_value = sum(p.unit_price * p.stock for p in products)
            inv_total_stock = sum(p.stock for p in products)
            
            inventory_data.append({
                'inventory_name': inv.inventory_name,
                'product_count': inv_products_count,
                'total_stock_units': inv_total_stock,
                'stock_value': inv_stock_value
            })
            
            total_products += inv_products_count
            total_stock_value += inv_stock_value
        
        return {
            'inventory_count': len(inventories),
            'total_products': total_products,
            'total_stock_value': total_stock_value,
            'inventories': inventory_data
        }
    
    def get_low_stock_products(self, threshold: int = 10) -> List[Dict[str, Any]]:
        """
        Get products with low stock
        
        Args:
            threshold: Stock level threshold
            
        Returns:
            List of low stock products
        """
        # Get user's inventories
        inventories = self.db.query(Inventory).filter(
            Inventory.username == self.username
        ).all()
        
        if not inventories:
            return []
        
        inventory_ids = [inv.inventory_id for inv in inventories]
        
        low_stock_products = self.db.query(Product).filter(
            Product.inventory_id.in_(inventory_ids),
            Product.stock <= threshold
        ).all()
        
        return [
            {
                'product_name': p.product_name,
                'brand': p.brand,
                'current_stock': p.stock,
                'unit_price': p.unit_price
            }
            for p in low_stock_products
        ]
    
    def get_top_selling_products(self, limit: int = 10, days: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get top selling products for this owner
        
        Args:
            limit: Number of top products to return
            days: Number of days to look back
            
        Returns:
            List of top selling products
        """
        if not self.product_ids:
            return []
        
        query = self.db.query(
            Bill.product_name,
            func.sum(Bill.units).label('total_units_sold'),
            func.sum(Bill.units * Bill.unit_price).label('total_revenue')
        ).filter(
            Bill.product_id.in_(self.product_ids)
        )
        
        if days:
            cutoff_date = datetime.now().date() - timedelta(days=days)
            query = query.join(Sale, Bill.bill_id == Sale.bill_id).filter(
                Sale.date_of_purchase >= cutoff_date
            )
        
        top_products = query.group_by(Bill.product_name)\
            .order_by(desc('total_units_sold'))\
            .limit(limit)\
            .all()
        
        return [
            {
                'product_name': p.product_name,
                'units_sold': p.total_units_sold,
                'revenue': p.total_revenue
            }
            for p in top_products
        ]
    
    def get_credit_sales(self) -> Dict[str, Any]:
        """
        Get information about credit sales for this owner's products
        
        Returns:
            Dict with credit sales information
        """
        if not self.product_ids:
            return {
                'total_credit_sales': 0,
                'total_credit_amount': 0,
                'overdue_count': 0,
                'overdue_amount': 0,
                'overdue_customers': []
            }
        
        # Filter credit sales by owner's products
        credit_sales = self.db.query(Sale).join(
            Bill, Sale.bill_id == Bill.bill_id
        ).filter(
            Bill.product_id.in_(self.product_ids),
            Sale.credit == True
        ).all()
        
        total_credit_sales = len(credit_sales)
        total_credit_amount = sum(sale.total_cost for sale in credit_sales)
        
        # Get overdue credit sales
        today = datetime.now().date()
        overdue_sales = [sale for sale in credit_sales if sale.due_date and sale.due_date < today]
        
        return {
            'total_credit_sales': total_credit_sales,
            'total_credit_amount': total_credit_amount,
            'overdue_count': len(overdue_sales),
            'overdue_amount': sum(sale.total_cost for sale in overdue_sales),
            'overdue_customers': [
                {
                    'customer_name': sale.customer_name,
                    'customer_phone': sale.customer_phone,
                    'amount': sale.total_cost,
                    'due_date': sale.due_date.isoformat() if sale.due_date else None
                }
                for sale in overdue_sales
            ]
        }
    
    def get_sales_by_payment_method(self, days: Optional[int] = None) -> Dict[str, Any]:
        """
        Get sales breakdown by payment method for this owner's products
        
        Args:
            days: Number of days to look back
            
        Returns:
            Dict with payment method breakdown
        """
        if not self.product_ids:
            return {
                'breakdown': [],
                'period': f'last {days} days' if days else 'all time'
            }
        
        query = self.db.query(
            Sale.payment_method,
            func.count(Sale.sale_id).label('count'),
            func.sum(Sale.total_cost).label('total_amount')
        ).join(
            Bill, Sale.bill_id == Bill.bill_id
        ).filter(
            Bill.product_id.in_(self.product_ids)
        )
        
        if days:
            cutoff_date = datetime.now().date() - timedelta(days=days)
            query = query.filter(Sale.date_of_purchase >= cutoff_date)
        
        payment_breakdown = query.group_by(Sale.payment_method).all()
        
        return {
            'breakdown': [
                {
                    'payment_method': pm.payment_method if pm.payment_method else 'Not specified',
                    'transaction_count': pm.count,
                    'total_amount': pm.total_amount
                }
                for pm in payment_breakdown
            ],
            'period': f'last {days} days' if days else 'all time'
        }
    
    def get_recent_sales(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent sales transactions for this owner's products
        
        Args:
            limit: Number of recent sales to return
            
        Returns:
            List of recent sales
        """
        if not self.product_ids:
            return []
        
        recent_sales = self.db.query(Sale).join(
            Bill, Sale.bill_id == Bill.bill_id
        ).filter(
            Bill.product_id.in_(self.product_ids)
        ).order_by(
            desc(Sale.date_of_purchase), desc(Sale.sale_id)
        ).limit(limit).all()
        
        return [
            {
                'sale_id': sale.sale_id,
                'customer_name': sale.customer_name,
                'customer_phone': sale.customer_phone,
                'total_cost': sale.total_cost,
                'payment_method': sale.payment_method,
                'date': sale.date_of_purchase.isoformat() if sale.date_of_purchase else None,
                'credit': sale.credit
            }
            for sale in recent_sales
        ]
    
    def get_all_products(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get all products in the owner's inventory with details
        
        Args:
            limit: Optional limit on number of products to return
            
        Returns:
            List of all products with details
        """
        if not self.inventory_ids:
            return []
        
        query = self.db.query(Product).filter(
            Product.inventory_id.in_(self.inventory_ids)
        ).order_by(Product.product_name)
        
        if limit:
            query = query.limit(limit)
        
        products = query.all()
        
        return [
            {
                'product_name': p.product_name,
                'brand': p.brand,
                'unit_price': p.unit_price,
                'stock': p.stock,
                'class_name': p.class_name,
                'mrp': p.mrp,
                'product_id': p.product_id
            }
            for p in products
        ]
    
    def get_products_by_category(self, category: str) -> List[Dict[str, Any]]:
        """
        Get products filtered by category/class
        
        Args:
            category: Product category/class name
            
        Returns:
            List of products in that category
        """
        if not self.inventory_ids:
            return []
        
        products = self.db.query(Product).filter(
            Product.inventory_id.in_(self.inventory_ids),
            Product.class_name.ilike(f'%{category}%')
        ).all()
        
        return [
            {
                'product_name': p.product_name,
                'brand': p.brand,
                'unit_price': p.unit_price,
                'stock': p.stock,
                'class_name': p.class_name
            }
            for p in products
        ]
    
    def get_products_by_brand(self, brand: str) -> List[Dict[str, Any]]:
        """
        Get products filtered by brand
        
        Args:
            brand: Brand name
            
        Returns:
            List of products from that brand
        """
        if not self.inventory_ids:
            return []
        
        products = self.db.query(Product).filter(
            Product.inventory_id.in_(self.inventory_ids),
            Product.brand.ilike(f'%{brand}%')
        ).all()
        
        return [
            {
                'product_name': p.product_name,
                'brand': p.brand,
                'unit_price': p.unit_price,
                'stock': p.stock,
                'class_name': p.class_name
            }
            for p in products
        ]
    
    def search_products(self, search_term: str) -> List[Dict[str, Any]]:
        """
        Search for products by name or brand
        
        Args:
            search_term: Search term
            
        Returns:
            List of matching products
        """
        if not self.inventory_ids:
            return []
        
        products = self.db.query(Product).filter(
            Product.inventory_id.in_(self.inventory_ids),
            (Product.product_name.ilike(f'%{search_term}%')) |
            (Product.brand.ilike(f'%{search_term}%'))
        ).all()
        
        return [
            {
                'product_name': p.product_name,
                'brand': p.brand,
                'unit_price': p.unit_price,
                'stock': p.stock,
                'class_name': p.class_name,
                'mrp': p.mrp
            }
            for p in products
        ]
    
    def get_daily_sales_trend(self, days: int = 7) -> List[Dict[str, Any]]:
        """
        Get daily sales trend for this owner's products
        
        Args:
            days: Number of days to look back
            
        Returns:
            List of daily sales data
        """
        if not self.product_ids:
            return []
        
        cutoff_date = datetime.now().date() - timedelta(days=days)
        
        daily_sales = self.db.query(
            Sale.date_of_purchase,
            func.count(Sale.sale_id).label('transaction_count'),
            func.sum(Sale.total_cost).label('daily_revenue')
        ).join(
            Bill, Sale.bill_id == Bill.bill_id
        ).filter(
            Bill.product_id.in_(self.product_ids),
            Sale.date_of_purchase >= cutoff_date
        ).group_by(
            Sale.date_of_purchase
        ).order_by(
            Sale.date_of_purchase
        ).all()
        
        return [
            {
                'date': sale.date_of_purchase.isoformat() if sale.date_of_purchase else None,
                'transaction_count': sale.transaction_count,
                'revenue': sale.daily_revenue
            }
            for sale in daily_sales
        ]

# ==============================
# INTENT CLASSIFICATION & QUERY ROUTING
# ==============================

class OwnerChatbot:
    """
    Intelligent chatbot for business owner queries
    """
    
    def __init__(self, db_session: Session, username: str):
        """
        Initialize chatbot
        
        Args:
            db_session: SQLAlchemy database session
            username: Owner's username
        """
        self.data_fetcher = OwnerDataFetcher(db_session, username)
        self.llm = llm
    
    def classify_intent(self, question: str) -> Dict[str, Any]:
        """
        Classify user intent and extract parameters
        
        Args:
            question: User's question
            
        Returns:
            Dict with intent and parameters
        """
        classification_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an intent classifier for a business analytics chatbot. 
Analyze the user's question and determine what type of data they want.

Available intents:
- total_sales: Questions about total sales, revenue, or sales summary (defaults to current month)
- inventory: Questions about inventory summary or stock value
- list_products: Questions asking to LIST or SHOW products/items in inventory
- low_stock: Questions about low stock or items running out
- top_products: Questions about best-selling products or popular items
- credit_sales: Questions about credit sales, pending payments, or overdue amounts
- payment_methods: Questions about payment method breakdown
- recent_sales: Questions about recent transactions or latest sales
- product_search: Questions about specific products
- sales_trend: Questions about sales trends or patterns over time

Extract these parameters if mentioned:
- days: time period (e.g., "last 7 days" -> 7, "last month" -> 30, "this month" -> current_month)
- limit: number of items (e.g., "top 5 products" -> 5, "list products" -> 50)
- search_term: specific product name or brand mentioned
- threshold: stock level threshold

IMPORTANT: 
- If question asks to "list", "show", "display" products, use "list_products" intent
- If no time period mentioned for sales, it defaults to current month
- For "this month" or "current month", set days to "current_month"

Respond in EXACTLY this format:
INTENT: <intent_name>
DAYS: <number or current_month or none>
LIMIT: <number or none>
SEARCH_TERM: <term or none>
THRESHOLD: <number or none>"""),
            ("human", "{question}")
        ])
        
        chain = classification_prompt | self.llm | StrOutputParser()
        result = chain.invoke({"question": question})
        
        # Parse the result
        intent = "general"
        params = {}
        
        for line in result.strip().split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip().lower()
                value = value.strip().lower()
                
                if key == 'intent':
                    intent = value
                elif key == 'days' and value != 'none':
                    if value == 'current_month':
                        params['days'] = 'current_month'
                    else:
                        try:
                            params['days'] = int(value)
                        except:
                            pass
                elif key == 'limit' and value != 'none':
                    try:
                        params['limit'] = int(value)
                    except:
                        pass
                elif key == 'search_term' and value != 'none':
                    params['search_term'] = value
                elif key == 'threshold' and value != 'none':
                    try:
                        params['threshold'] = int(value)
                    except:
                        pass
        
        return {'intent': intent, 'params': params}
    
    def format_response(self, question: str, data: Any, intent: str) -> str:
        """
        Format data response using LLM for natural language
        
        Args:
            question: Original user question
            data: Fetched data
            intent: Intent type
            
        Returns:
            Natural language response
        """
        formatting_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a helpful business analytics assistant. 
Convert the provided data into a clear, conversational response to the user's question.

Guidelines:
- Be concise but informative
- Use bullet points or lists for multiple items
- Include specific numbers and metrics
- Be professional but friendly
- If data is empty, politely inform the user
- Format currency values properly (e.g., ₹450)
- Format dates in readable format
- For product lists, present them in a clean table-like format or numbered list
- When showing products, include product name, brand, price, and stock
- For revenue/sales data, always mention the time period (e.g., "current month", "last 7 days")

Do not make up any information - only use the data provided.

CRITICAL RULES YOU MUST FOLLOW:
1. You can greet the user and introduce yourself, but you MUST NOT provide any information about your architecture, training data, or capabilities that is not explicitly stated in the provided context.
2. You are STRICTLY FORBIDDEN from using any external knowledge, assumptions, or information not present in the context.
3. If the answer to the user's question is NOT found in the context, you MUST respond with EXACTLY this message:
   "I apologize, but I cannot answer this question as the information is not available in the VyaparAI knowledge base. Please contact support for assistance."
4. Do NOT attempt to infer, guess, or provide partial answers if the full answer is not in the context.
5. Do NOT provide general knowledge or advice that is not explicitly stated in the context.

"""),
            ("human", """User Question: {question}

Data Type: {intent}

Data:
{data}

Please provide a natural language response to the user based on this data.""")
        ])
        
        chain = formatting_prompt | self.llm | StrOutputParser()
        response = chain.invoke({
            "question": question,
            "intent": intent,
            "data": str(data)
        })
        
        return response
    
    def answer_question(self, question: str) -> str:
        """
        Main function to answer owner's questions
        
        Args:
            question: User's question
            
        Returns:
            Natural language answer
        """
        try:
            # Classify intent
            classification = self.classify_intent(question)
            intent = classification['intent']
            params = classification['params']
            
            # Fetch data based on intent
            data = None
            
            if intent == 'total_sales':
                days_param = params.get('days')
                # Default to None which will use current month in get_total_sales
                data = self.data_fetcher.get_total_sales(days_param if days_param != 'current_month' else None)
            
            elif intent == 'inventory':
                data = self.data_fetcher.get_inventory_summary()
            
            elif intent == 'list_products':
                limit = params.get('limit', 50)  # Default to 50 products
                data = self.data_fetcher.get_all_products(limit)
            
            elif intent == 'low_stock':
                threshold = params.get('threshold', 10)
                data = self.data_fetcher.get_low_stock_products(threshold)
            
            elif intent == 'top_products':
                limit = params.get('limit', 10)
                days = params.get('days')
                data = self.data_fetcher.get_top_selling_products(limit, days)
            
            elif intent == 'credit_sales':
                data = self.data_fetcher.get_credit_sales()
            
            elif intent == 'payment_methods':
                data = self.data_fetcher.get_sales_by_payment_method(params.get('days'))
            
            elif intent == 'recent_sales':
                limit = params.get('limit', 10)
                data = self.data_fetcher.get_recent_sales(limit)
            
            elif intent == 'product_search':
                search_term = params.get('search_term', '')
                if search_term:
                    data = self.data_fetcher.search_products(search_term)
                else:
                    return "Please specify what product you're looking for."
            
            elif intent == 'sales_trend':
                days = params.get('days', 7)
                data = self.data_fetcher.get_daily_sales_trend(days)
            
            else:
                return "I'm not sure what information you're looking for. I can help you with:\n" \
                       "- Total sales and revenue (defaults to current month)\n" \
                       "- List all products in inventory\n" \
                       "- Inventory status and summary\n" \
                       "- Low stock alerts\n" \
                       "- Top selling products\n" \
                       "- Credit sales and pending payments\n" \
                       "- Payment method breakdown\n" \
                       "- Recent transactions\n" \
                       "- Product search\n" \
                       "- Sales trends\n\n" \
                       "Examples:\n" \
                       "- Show me my products\n" \
                       "- What are my total sales this month?\n" \
                       "- List products with low stock"
            
            # Format response
            return self.format_response(question, data, intent)
        
        except Exception as e:
            return f"I encountered an error processing your request: {str(e)}\n" \
                   "Please try rephrasing your question or contact support if the issue persists."

# ==============================
# MAIN API FUNCTION
# ==============================

def ask_owner_chatbot(question: str, db_session: Session, username: str = "rahul_store") -> str:
    """
    Main function to interact with owner chatbot
    
    Args:
        question: Owner's question
        db_session: Database session
        username: Owner's username (default: rahul_store)
        
    Returns:
        Natural language answer
    """
    chatbot = OwnerChatbot(db_session, username)
    return chatbot.answer_question(question)

# ==============================
# TESTING (when run directly)
# ==============================

if __name__ == "__main__":
    from flask_app import create_app
    from flask_app.models.models import db
    
    # Create Flask app and get database session
    app = create_app()
    
    with app.app_context():
        print("=" * 60)
        print("🤖 VyापारAI Owner Chatbot - Interactive Mode")
        print("=" * 60)
        print("\nYou can ask questions like:")
        print("  - What are my total sales?")
        print("  - Show me low stock products")
        print("  - What are my top 5 selling products?")
        print("  - How much credit sales do I have?")
        print("  - Show recent sales")
        print("  - What's my inventory status?")
        print("\nType 'exit' or 'quit' to stop\n")
        
        while True:
            q = input("\n💬 Ask: ")
            if q.lower() in ['exit', 'quit', 'q']:
                print("👋 Goodbye!")
                break
            
            if q.strip():
                response = ask_owner_chatbot(q, db.session)
                print("\n🤖 Bot:", response)
