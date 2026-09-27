"""
Test Database Integration for Smart Cart System
Tests product fetching and transaction recording without camera
"""

import sys
import os
from collections import Counter

# Add the flask_app directory to the path
sys.path.insert(0, os.path.dirname(__file__))

# Import Flask app and models
from flask_app import create_app
from flask_app.models.models import Product, Sale, Bill, ListedProduct, db
from datetime import datetime, date


def test_database_setup():
    """Test if database is properly set up"""
    print("="*60)
    print("Testing Database Setup")
    print("="*60)
    
    app = create_app()
    
    with app.app_context():
        # Test ListedProducts
        listed_count = ListedProduct.query.count()
        print(f"\n✓ Listed Products: {listed_count}")
        
        if listed_count > 0:
            print("\nSample Listed Products:")
            for product in ListedProduct.query.limit(5).all():
                print(f"  - {product.class_name}")
        
        # Test Products
        product_count = Product.query.count()
        print(f"\n✓ Products in Inventory: {product_count}")
        
        if product_count > 0:
            print("\nAll Products:")
            for product in Product.query.all():
                print(f"  - {product.product_name} ({product.class_name})")
                print(f"    Price: ₹{product.unit_price} | Stock: {product.stock} | Brand: {product.brand}")
        
        # Test Sales
        sale_count = Sale.query.count()
        print(f"\n✓ Sales Recorded: {sale_count}")
        
        if sale_count > 0:
            print("\nRecent Sales:")
            for sale in Sale.query.order_by(Sale.date_of_purchase.desc()).limit(5).all():
                print(f"  - Sale #{sale.sale_id} (Bill #{sale.bill_id})")
                print(f"    Date: {sale.date_of_purchase}")
                print(f"    Customer: {sale.customer_name}")
                print(f"    Total: ₹{sale.total_cost}")
                print(f"    Line Items:")
                bill_items = sale.get_bill_items()
                for bill in bill_items:
                    print(f"      * {bill.product_name}: {bill.units} x ₹{bill.unit_price} = ₹{bill.units * bill.unit_price}")


def test_simulated_transaction():
    """Test creating a simulated sale transaction"""
    print("\n" + "="*60)
    print("Testing Simulated Sale Transaction")
    print("="*60)
    
    app = create_app()
    
    with app.app_context():
        # Get some products
        products = Product.query.limit(3).all()
        
        if len(products) == 0:
            print("\n✗ No products found in database!")
            return
        
        print(f"\nSimulating purchase of {len(products)} different products...")
        
        # Create simulated detection
        total_amount = 0
        total_items = 0
        
        for i, product in enumerate(products):
            quantity = (i + 1)  # 1, 2, 3, ...
            print(f"  - {product.product_name}: {quantity} units x ₹{product.unit_price}")
        
        # Create Sale transaction
        try:
            # Calculate totals
            for i, product in enumerate(products):
                quantity = i + 1
                total_amount += product.unit_price * quantity
                total_items += quantity
            
            # Get next bill_id
            max_bill = db.session.query(db.func.max(Bill.bill_id)).scalar()
            bill_id = (max_bill or 0) + 1
            
            # Create Bill records (multiple with same bill_id)
            for i, product in enumerate(products):
                quantity = i + 1
                
                bill = Bill(
                    bill_id=bill_id,
                    product_name=product.product_name,
                    units=quantity,
                    unit_price=product.unit_price,
                    product_id=product.product_id
                )
                db.session.add(bill)
                
                # Update stock
                product.stock -= quantity
            
            # Create Sale record that references the bill_id
            sale = Sale(
                bill_id=bill_id,
                customer_name='Test Customer',
                total_cost=total_amount,
                date_of_purchase=date.today(),
                payment_method='cash',
                credit=False
            )
            db.session.add(sale)
            db.session.flush()
            
            db.session.commit()
            
            print(f"\n✓ Sale #{sale.sale_id} created successfully! (Bill #{bill_id})")
            print(f"  Total Amount: ₹{total_amount}")
            print(f"  Total Items: {total_items}")
            print(f"  Line Items: {len(products)}")
            print(f"  Stock updated for {len(products)} products")
            
        except Exception as e:
            db.session.rollback()
            print(f"\n✗ Error creating sale: {str(e)}")
            import traceback
            traceback.print_exc()


def test_product_lookup():
    """Test looking up products by YOLO class names"""
    print("\n" + "="*60)
    print("Testing Product Lookup by YOLO Class Names")
    print("="*60)
    
    app = create_app()
    
    # Test class names from YOLO
    test_class_names = [
        'chocolate_dairyMilk',
        'biscuit_parleg',
        'chips_lays',
        'maggi_small',
        'nivea_cream',
        'unknown_product'  # This should not exist
    ]
    
    with app.app_context():
        for class_name in test_class_names:
            product = Product.query.filter_by(class_name=class_name).first()
            if product:
                print(f"\n✓ Found: {class_name}")
                print(f"  Product: {product.product_name}")
                print(f"  Price: ₹{product.unit_price}")
                print(f"  Stock: {product.stock}")
                print(f"  Brand: {product.brand}")
            else:
                print(f"\n✗ Not found: {class_name}")


def main():
    """Run all tests"""
    print("\n" + "="*70)
    print(" "*15 + "SMART CART DATABASE TEST SUITE")
    print("="*70 + "\n")
    
    try:
        # Test 1: Database Setup
        test_database_setup()
        
        # Test 2: Product Lookup
        test_product_lookup()
        
        # Test 3: Simulated Sale Transaction
        response = input("\n\nDo you want to create a simulated sale transaction? (y/n): ")
        if response.lower() == 'y':
            test_simulated_transaction()
            
            # Show updated state
            print("\n" + "="*60)
            print("Updated Database State")
            print("="*60)
            test_database_setup()
        
        print("\n" + "="*70)
        print("All tests completed!")
        print("="*70 + "\n")
        
    except Exception as e:
        print(f"\n✗ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
