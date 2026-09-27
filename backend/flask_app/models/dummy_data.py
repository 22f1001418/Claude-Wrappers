from datetime import date, timedelta

from flask_app.models.models import (
    db,
    UserDetail,
    UnknownItem,
    Inventory,
    Product,
    Bill,
    Sale,
    Cashier,
    Todo
)


def load_dummy_data():
    """Load dummy data into the database. Must be called within an app context."""

    print("🔄 Loading dummy data...")

    # Check if sales data already exists (more specific check)
    existing_sales = Sale.query.first()
    if existing_sales:
        print("✓ Found existing sales data. Skipping to avoid duplicates.")
        print(f"✓ Database already has {Sale.query.count()} sales and {Bill.query.count()} bill items.")
        print("💡 To reload data, delete the database file and run again.")
        return

    # Create tables if not present
    db.create_all()
    
    # Check if users exist
    existing_user = UserDetail.query.filter_by(username="rahul_store").first()

    # ==================== USERS ====================
    print("📝 Creating users...")
    
    # Only create users if they don't exist
    if not existing_user:
        owner = UserDetail(
            username="rahul_store",
            email="rahul@grocery.com",
            role="owner",
            full_name="Rahul Kumar"
        )
        owner.set_password("Rahul@123")
        db.session.add(owner)

        cashier1 = UserDetail(
            username="amit_cashier",
            email="amit@cashier.com",
            role="cashier",
            full_name="Amit Sharma"
        )
        cashier1.set_password("Amit@123")
        db.session.add(cashier1)

        cashier2 = UserDetail(
            username="sneha_cashier",
            email="sneha@cashier.com",
            role="cashier",
            full_name="Sneha Patil"
        )
        cashier2.set_password("Sneha@123")
        db.session.add(cashier2)

        db.session.commit()
        print(f"✅ Created 3 users (1 owner, 2 cashiers)")
    else:
        print(f"✅ Users already exist, skipping user creation")

    # ==================== INVENTORY ====================
    # NOTE: Each owner can have ONLY ONE inventory (enforced by unique constraint)
    print("📝 Creating inventory...")
    inventory = Inventory.query.filter_by(username="rahul_store").first()
    
    if not inventory:
        inventory = Inventory(
            username="rahul_store",
            inventory_name="Rahul Grocery Main Store"
        )
        db.session.add(inventory)
        db.session.commit()
        print(f"✅ Created inventory: {inventory.inventory_name}")
    else:
        print(f"✅ Using existing inventory: {inventory.inventory_name}")

    # ==================== PRODUCTS ====================
    print("📝 Creating products...")
    
    # Check if products already exist
    existing_products = Product.query.filter_by(inventory_id=inventory.inventory_id).all()
    
    if len(existing_products) >= 24:
        print(f"✅ Using {len(existing_products)} existing products")
        product_objects = existing_products
    else:
        # Create all YOLO-detectable products
        products_data = [
            {'class_name': 'biscuit_5050', 'product_name': '50-50 Biscuit', 'unit_price': 10, 'brand': 'Britannia', 'stock': 150},
            {'class_name': 'biscuit_goodDay', 'product_name': 'Good Day Biscuit', 'unit_price': 20, 'brand': 'Britannia', 'stock': 120},
            {'class_name': 'biscuit_goodDay_butter', 'product_name': 'Good Day Butter Biscuit', 'unit_price': 25, 'brand': 'Britannia', 'stock': 100},
            {'class_name': 'biscuit_krackJack', 'product_name': 'Krackjack Biscuit', 'unit_price': 15, 'brand': 'Parle', 'stock': 180},
            {'class_name': 'biscuit_parleg', 'product_name': 'Parle-G Biscuit', 'unit_price': 5, 'brand': 'Parle', 'stock': 35},  # High sales velocity - Restock only
            {'class_name': 'boroline_box', 'product_name': 'Boroline Cream Box', 'unit_price': 40, 'brand': 'Boroline', 'stock': 80},
            {'class_name': 'boroline_tube', 'product_name': 'Boroline Antiseptic Cream Tube', 'unit_price': 20, 'brand': 'Boroline', 'stock': 100},
            {'class_name': 'boroplus_lotion', 'product_name': 'Boroplus Antiseptic Lotion', 'unit_price': 85, 'brand': 'Boroplus', 'stock': 60},
            {'class_name': 'boroplus_tube', 'product_name': 'Boroplus Antiseptic Cream', 'unit_price': 45, 'brand': 'Boroplus', 'stock': 90},
            {'class_name': 'boroplus_vasocare', 'product_name': 'Boroplus Vasocare', 'unit_price': 50, 'brand': 'Boroplus', 'stock': 70},
            {'class_name': 'chips_lays', 'product_name': 'Lays Chips', 'unit_price': 10, 'brand': 'Lays', 'stock': 200},
            {'class_name': 'chocolate_dairyMilk', 'product_name': 'Dairy Milk Chocolate', 'unit_price': 20, 'brand': 'Cadbury', 'stock': 150},
            {'class_name': 'cracker_bisk_farm', 'product_name': 'Bisk Farm Cracker', 'unit_price': 30, 'brand': 'Bisk Farm', 'stock': 110},
            {'class_name': 'dabur_gulabari', 'product_name': 'Dabur Gulabari Rose Water', 'unit_price': 45, 'brand': 'Dabur', 'stock': 75},
            {'class_name': 'dabur_honey', 'product_name': 'Dabur Honey', 'unit_price': 120, 'brand': 'Dabur', 'stock': 50},
            {'class_name': 'jam_kissan', 'product_name': 'Kissan Mixed Fruit Jam', 'unit_price': 90, 'brand': 'Kissan', 'stock': 60},
            {'class_name': 'maggi_small', 'product_name': 'Maggi Noodles Small', 'unit_price': 14, 'brand': 'Maggi', 'stock': 180},
            {'class_name': 'maggi_special_masala', 'product_name': 'Maggi Special Masala', 'unit_price': 25, 'brand': 'Maggi', 'stock': 140},
            {'class_name': 'milky_bar', 'product_name': 'Milky Bar White Chocolate', 'unit_price': 10, 'brand': 'Nestle', 'stock': 130},
            {'class_name': 'nescafe_coffee', 'product_name': 'Nescafe Coffee', 'unit_price': 250, 'brand': 'Nescafe', 'stock': 8},  # Low stock, no sales - Low Stock Alert only
            {'class_name': 'nivea_cream', 'product_name': 'Nivea Cream', 'unit_price': 150, 'brand': 'Nivea', 'stock': 20},
            {'class_name': 'oats_saffola', 'product_name': 'Saffola Oats', 'unit_price': 180, 'brand': 'Saffola', 'stock': 45},
            {'class_name': 'rice_daawat', 'product_name': 'Daawat Basmati Rice', 'unit_price': 110, 'brand': 'Daawat', 'stock': 70},
            {'class_name': 'surf_excel_bar', 'product_name': 'Surf Excel Detergent Bar', 'unit_price': 35, 'brand': 'Surf Excel', 'stock': 6},  # Low stock with sales - BOTH lists
        ]

        product_objects = []
        for prod_data in products_data:
            # Check if this specific product already exists
            existing = Product.query.filter_by(
                inventory_id=inventory.inventory_id,
                product_name=prod_data["product_name"]
            ).first()
            
            if existing:
                product_objects.append(existing)
            else:
                product = Product(
                    inventory_id=inventory.inventory_id,
                    class_name=prod_data["class_name"],
                    product_name=prod_data["product_name"],
                    unit_price=prod_data["unit_price"],
                    brand=prod_data["brand"],
                    stock=prod_data["stock"]
                )
                db.session.add(product)
                product_objects.append(product)
        
        db.session.commit()
        print(f"✅ Created/verified {len(product_objects)} products")

    # ==================== SALES & BILLS ====================
    print("📝 Creating sales transactions...")

    from datetime import timedelta, date

    def create_sale(bill_id, items, customer_name, customer_phone,
                    purchase_date, payment_method,
                    amount_paid=None, due_date=None, owner_username="rahul_store"):

        total_cost = 0

        for item in items:
            bill = Bill(
                bill_id=bill_id,
                product_name=item["product"].product_name,
                units=item["units"],
                unit_price=item["product"].unit_price,
                product_id=item["product"].product_id
            )
            db.session.add(bill)
            total_cost += item["units"] * item["product"].unit_price

        # If amount_paid not given → assume fully paid
        if amount_paid is None:
            amount_paid = total_cost

        sale = Sale(
            bill_id=bill_id,
            owner_username=owner_username,
            customer_name=customer_name,
            customer_phone=customer_phone,
            total_cost=total_cost,
            amount_paid=amount_paid,
            due_date=due_date,
            date_of_purchase=purchase_date,
            payment_method=payment_method
        )

        sale.update_payment_fields()  # auto compute remaining
        db.session.add(sale)


    # ==================== ORIGINAL SALES ====================

    create_sale(
        1,
        [{"product": product_objects[0], "units": 3}],
        "Suresh Kumar",
        "9876543210",
        date.today() - timedelta(days=5),
        "cash"
    )

    create_sale(
        2,
        [{"product": product_objects[1], "units": 2}],
        "Anjali Sharma",
        "9123456780",
        date.today() - timedelta(days=10),
        "credit",
        amount_paid=50,
        due_date=date.today() + timedelta(days=20)
    )

    create_sale(
        3,
        [{"product": product_objects[2], "units": 4}],
        "Vijay Singh",
        "9765432109",
        date.today() - timedelta(days=40),
        "credit",
        amount_paid=0,
        due_date=date.today() - timedelta(days=5)
    )

    create_sale(
        4,
        [{"product": product_objects[3], "units": 2}],
        "Rajesh Patel",
        "9988776655",
        date.today() - timedelta(days=3),
        "upi"
    )

    create_sale(
        5,
        [{"product": product_objects[4], "units": 3}],
        "Amit Verma",
        "9876501234",
        date.today() - timedelta(days=2),
        "credit",
        amount_paid=30,
        due_date=date.today() + timedelta(days=15)
    )

    create_sale(
        6,
        [{"product": product_objects[5], "units": 5}],
        "Pooja Nair",
        "9988112233",
        date.today() - timedelta(days=1),
        "credit",
        amount_paid=0,
        due_date=date.today() + timedelta(days=25)
    )

    create_sale(
        7,
        [{"product": product_objects[6], "units": 2}],
        "Meena Desai",
        "9871234567",
        date.today(),
        "cash"
    )

    create_sale(
        8,
        [{"product": product_objects[7], "units": 4}],
        "Ramesh Gupta",
        "9123456789",
        date.today() - timedelta(days=8),
        "credit",
        amount_paid=20,
        due_date=date.today() + timedelta(days=10)
    )

    create_sale(
        9,
        [{"product": product_objects[8], "units": 3}],
        "Kavita Joshi",
        "9771234567",
        date.today() - timedelta(days=12),
        "credit",
        amount_paid=0,
        due_date=date.today() - timedelta(days=2)
    )

    create_sale(
        10,
        [{"product": product_objects[9], "units": 1}],
        "Walk-in Customer",
        None,
        date.today() - timedelta(days=1),
        "cash"
    )

    # ==================== 8 NEW DUE / OVERDUE CUSTOMERS ====================

    create_sale(
        11,
        [{"product": product_objects[0], "units": 6}],
        "Deepak Mishra",
        "9898989898",
        date.today() - timedelta(days=50),
        "credit",
        amount_paid=100,
        due_date=date.today() - timedelta(days=20)
    )

    create_sale(
        12,
        [{"product": product_objects[1], "units": 5}],
        "Neha Kapoor",
        "9788888888",
        date.today() - timedelta(days=65),
        "credit",
        amount_paid=0,
        due_date=date.today() - timedelta(days=30)
    )

    create_sale(
        13,
        [{"product": product_objects[2], "units": 7}],
        "Harish Reddy",
        "9677777777",
        date.today() - timedelta(days=80),
        "credit",
        amount_paid=50,
        due_date=date.today() - timedelta(days=45)
    )

    create_sale(
        14,
        [{"product": product_objects[3], "units": 9}],
        "Lakshmi Priya",
        "9566666666",
        date.today() - timedelta(days=70),
        "credit",
        amount_paid=0,
        due_date=date.today() - timedelta(days=40)
    )

    create_sale(
        15,
        [{"product": product_objects[4], "units": 4}],
        "Rohit Mehta",
        "9455555555",
        date.today() - timedelta(days=35),
        "credit",
        amount_paid=20,
        due_date=date.today() - timedelta(days=10)
    )

    create_sale(
        16,
        [{"product": product_objects[5], "units": 8}],
        "Priya Nair",
        "9344444444",
        date.today() - timedelta(days=55),
        "credit",
        amount_paid=0,
        due_date=date.today() - timedelta(days=25)
    )

    create_sale(
        17,
        [{"product": product_objects[6], "units": 3}],
        "Sanjay Verma",
        "9233333333",
        date.today() - timedelta(days=45),
        "credit",
        amount_paid=10,
        due_date=date.today() - timedelta(days=15)
    )

    create_sale(
        18,
        [{"product": product_objects[7], "units": 10}],
        "Kiran Das",
        "9122222222",
        date.today() - timedelta(days=90),
        "credit",
        amount_paid=0,
        due_date=date.today() - timedelta(days=60)
    )

    # ==================== EXTRA INVENTORY TEST ITEMS ====================

    create_sale(
        19,
        [{"product": product_objects[20], "units": 100}],
        "Restock Customer",
        "9000000001",
        date.today() - timedelta(days=12),
        "cash"
    )

    create_sale(
        20,
        [{"product": product_objects[23], "units": 30}],
        "Both Section Customer",
        "9000000002",
        date.today() - timedelta(days=6),
        "upi"
    )

    db.session.commit()

    print("✅ Created sales with fully paid, partial, and multiple overdue credits")
    print("✅ Added inventory test items for low stock, restock, and both sections")

    # ==================== UNKNOWN ITEMS ====================
    print("📝 Creating unknown items...")
    unknown_items_data = [
        {"class_name": "unknown_snack_1", "count": 3, "image": "/images/unknown1.jpg"},
        {"class_name": "unknown_beverage_1", "count": 2, "image": "/images/unknown2.jpg"},
    ]
        
    for item_data in unknown_items_data:
        unknown = UnknownItem(
            class_name=item_data["class_name"],
            count=item_data["count"],
            image=item_data["image"]
        )
        db.session.add(unknown)
        
    db.session.commit()
    print(f"✅ Created {len(unknown_items_data)} unknown items")

    # ==================== CASHIERS ====================
    print("📝 Creating cashier records...")
        
    # Check if cashier records already exist
    existing_cashiers = Cashier.query.count()
        
    if existing_cashiers == 0:
        # Add cashiers linked to the owner
        cashier_entry1 = Cashier(
            cashier_username="amit_cashier",
            added_by_owner="rahul_store",
            date_added=date.today() - timedelta(days=30)
        )
        db.session.add(cashier_entry1)
            
        cashier_entry2 = Cashier(
            cashier_username="sneha_cashier",
            added_by_owner="rahul_store",
            date_added=date.today() - timedelta(days=15)
        )
        db.session.add(cashier_entry2)
            
        db.session.commit()
        print(f"✅ Created 2 cashier records")
    else:
        print(f"✅ Cashier records already exist ({existing_cashiers} records)")

    # ==================== TODOS ====================
    print("📝 Creating todo tasks...")
        
    # Check if todos already exist
    existing_todos = Todo.query.filter_by(username="rahul_store").count()
        
    if existing_todos == 0:
        todos_data = [
            # Today's tasks
            {
                "title": "Review dashboard design mockups",
                "description": "Check the new dashboard mockups from the design team",
                "date": date.today(),
                "time": "10:00 AM",
                "priority": "high",
                "category": "Work",
                "completed": False
            },
            {
                "title": "Buy groceries for the week",
                "description": "Milk, bread, eggs, vegetables",
                "date": date.today(),
                "time": "",
                "priority": "low",
                "category": "Shopping",
                "completed": False
            },
            {
                "title": "Gym workout - Leg day",
                "description": "Focus on squats and leg press",
                "date": date.today(),
                "time": "6:00 PM",
                "priority": "medium",
                "category": "Health & Fitness",
                "completed": False
            },
            {
                "title": "Team standup meeting",
                "description": "Daily team sync with the staff",
                "date": date.today(),
                "time": "10:00 AM",
                "priority": "medium",
                "category": "Work",
                "completed": False
            },
                
            # Upcoming tasks
            {
                "title": "Restock low inventory items",
                "description": "Order more bathing soap and other low stock items",
                "date": date.today() + timedelta(days=1),
                "time": "9:00 AM",
                "priority": "high",
                "category": "Work",
                "completed": False
            },
            {
                "title": "Review monthly sales report",
                "description": "Analyze February sales data and prepare report",
                "date": date.today() + timedelta(days=2),
                "time": "2:00 PM",
                "priority": "high",
                "category": "Work",
                "completed": False
            },
            {
                "title": "Call supplier for bulk order",
                "description": "Negotiate prices for next month's bulk order",
                "date": date.today() + timedelta(days=3),
                "time": "11:00 AM",
                "priority": "medium",
                "category": "Work",
                "completed": False
            },
            {
                "title": "Plan weekend family trip",
                "description": "Book hotel and plan itinerary",
                "date": date.today() + timedelta(days=5),
                "time": "",
                "priority": "low",
                "category": "Personal",
                "completed": False
            },
            {
                "title": "Update product prices",
                "description": "Update prices for 5 products based on new costs",
                "date": date.today() + timedelta(days=7),
                "time": "3:00 PM",
                "priority": "medium",
                "category": "Work",
                "completed": False
            },
            {
                "title": "Interview new cashier candidate",
                "description": "Meet with potential cashier for evening shift",
                "date": date.today() + timedelta(days=10),
                "time": "4:00 PM",
                "priority": "high",
                "category": "Work",
                "completed": False
            },
                
            # Completed tasks
            {
                "title": "Check overdue credit payments",
                "description": "Follow up with Vijay Singh about overdue payment",
                "date": date.today() - timedelta(days=1),
                "time": "11:00 AM",
                "priority": "high",
                "category": "Work",
                "completed": True
            },
            {
                "title": "Morning yoga session",
                "description": "30 minutes of yoga and stretching",
                "date": date.today() - timedelta(days=1),
                "time": "6:00 AM",
                "priority": "low",
                "category": "Health & Fitness",
                "completed": True
            },
            {
                "title": "Prepare weekly inventory report",
                "description": "Document current stock levels and low inventory items",
                "date": date.today() - timedelta(days=2),
                "time": "5:00 PM",
                "priority": "medium",
                "category": "Work",
                "completed": True
            },
            {
                "title": "Pay electricity bill",
                "description": "Monthly electricity bill payment",
                "date": date.today() - timedelta(days=3),
                "time": "",
                "priority": "high",
                "category": "Personal",
                "completed": True
            },
            {
                "title": "Train new cashier on POS system",
                "description": "Complete orientation and system training for Sneha",
                "date": date.today() - timedelta(days=5),
                "time": "10:00 AM",
                "priority": "high",
                "category": "Work",
                "completed": True
            }
        ]
            
        for todo_data in todos_data:
            todo = Todo(
                username="rahul_store",
                **todo_data
            )
            db.session.add(todo)
            
        db.session.commit()
        print(f"✅ Created {len(todos_data)} todo tasks (4 today, 6 upcoming, 5 completed)")
    else:
        print(f"✅ Todo tasks already exist ({existing_todos} tasks)")

    # ==================== SUMMARY ====================
    print("\n" + "=" * 60)
    print("✅ DUMMY DATA LOADED SUCCESSFULLY!")
    print("=" * 60)
    print(f"👤 Users: 3 (1 owner, 2 cashiers)")
    print(f"📦 Products: {len(product_objects)} YOLO-detectable items in inventory")
    print(f"💰 Sales: 20 transactions (18 original + 2 inventory test sales)")
    print(f"📝 Bills: 60+ line items")
    print(f"💳 Payment methods: cash, credit, upi, card")
    print(f"📅 Date range: Last 35 days to today")
    print(f"⚠️  Low Stock Items:")
    print(f"    - Nescafe Coffee (8 units) - No sales [Low Stock Alert ONLY]")
    print(f"    - Nivea Cream (20 units) - 100 units sold in 30 days [Restock ONLY]")
    print(f"🔄 Restock Recommendations:")
    print(f"    - Surf Excel Bar (6 units, ~1.0/day, 6.0 days left) [BOTH Lists]")
    print(f"🔴 Overdue credit: 1 customer (Vijay Singh)")
    pending_sales = Sale.query.filter(
    Sale.credit == True,
    Sale.amount_remaining > 0
    ).all()
    total_pending = sum(sale.amount_remaining for sale in pending_sales)
    print(f"🟡 Pending credit: {len(pending_sales)} customers (₹{total_pending})")
    print(f"👥 Walk-in sales: 2 transactions")
    print(f"👨‍💼 Cashiers: 2 (added by rahul_store)")
    print(f"✅ Todos: 15 tasks (4 today, 6 upcoming, 5 completed)")
    print("\n🔑 Login Credentials:")
    print("   Owner     - Username: rahul_store     | Password: Rahul@123")
    print("   Cashier 1 - Username: amit_cashier    | Password: Amit@123")
    print("   Cashier 2 - Username: sneha_cashier   | Password: Sneha@123")
    print("=" * 60)


if __name__ == "__main__":
    load_dummy_data()