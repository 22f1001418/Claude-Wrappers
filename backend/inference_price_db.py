"""
Smart Cart Inference with Database Integration
YOLO-based product detection with real-time billing using database prices
"""

import cv2
import sys
import os
from ultralytics import YOLO
from collections import Counter

# Add the flask_app directory to the path
sys.path.insert(0, os.path.dirname(__file__))

# Import Flask app and models
from flask_app import create_app
from flask_app.models.models import Product, Sale, Bill, db
from flask_app.models.models import Inventory
from flask_app.tasks.low_stock_notifications import send_low_stock_notifications_for_owner
from flask_app.utils.cache_utils import bump_owner_cache_version
from datetime import datetime, date

# Initialize Flask app
app = create_app()

def get_product_prices():
    """
    Fetch all products from database and create a price dictionary
    Returns: dict mapping class_name to (price, product_name, stock)
    """
    with app.app_context():
        products = Product.query.all()
        price_dict = {}
        for product in products:
            price_dict[product.class_name] = {
                'price': product.unit_price,
                'name': product.product_name,
                'brand': product.brand,
                'stock': product.stock,
                'product_id': product.product_id
            }
        return price_dict


def save_transaction(detected_items, product_catalog, inventory_id=1):
    """
    Save transaction to database using Bill and Sale tables
    Args:
        detected_items: Counter object with detected class_names and quantities
        product_catalog: Dictionary of product information
        inventory_id: ID of the inventory (default: 1)
    Returns:
        sale_id if successful, None otherwise
    """
    with app.app_context():
        try:
            total_amount = 0
            total_items = 0
            bill_items = []
            
            # Prepare bill items
            for class_name, quantity in detected_items.items():
                if class_name in product_catalog:
                    product_info = product_catalog[class_name]
                    product_id = product_info['product_id']
                    unit_price = product_info['price']
                    product_name = product_info['name']
                    stock = product_info['stock']
                    
                    # Limit quantity to available stock
                    available_qty = min(quantity, stock)
                    subtotal = unit_price * available_qty
                    
                    total_amount += subtotal
                    total_items += available_qty
                    
                    bill_items.append({
                        'product_id': product_id,
                        'product_name': product_name,
                        'units': available_qty,
                        'unit_price': unit_price
                    })
            
            if total_items == 0:
                print("⚠ No valid items to save!")
                return None
            
            # Get next bill_id (find max bill_id and add 1)
            max_bill = db.session.query(db.func.max(Bill.bill_id)).scalar()
            bill_id = (max_bill or 0) + 1
            
            # Create Bill records (multiple records with same bill_id)
            for item_data in bill_items:
                bill = Bill(
                    bill_id=bill_id,
                    product_name=item_data['product_name'],
                    units=item_data['units'],
                    unit_price=item_data['unit_price'],
                    product_id=item_data['product_id']
                )
                db.session.add(bill)
                
                # Update product stock
                product = Product.query.get(item_data['product_id'])
                if product:
                    product.stock -= item_data['units']
            
            # Create Sale record that references the bill_id
            sale = Sale(
                bill_id=bill_id,
                customer_name='Smart Cart Customer',
                total_cost=total_amount,
                date_of_purchase=date.today(),
                payment_method='cash',
                credit=False
            )
            db.session.add(sale)
            db.session.flush()  # Get sale_id
            
            db.session.commit()

            owner_username = None
            inventory = Inventory.query.filter_by(inventory_id=inventory_id).first()
            if inventory:
                owner_username = inventory.username
            if owner_username:
                bump_owner_cache_version(owner_username)
                send_low_stock_notifications_for_owner.delay(owner_username)
            
            print(f"\n✓ Sale saved successfully! ID: {sale.sale_id}, Bill ID: {bill_id}")
            print(f"  Total Amount: ₹{total_amount}")
            print(f"  Total Items: {total_items}")
            print(f"  Line Items: {len(bill_items)}")
            
            return sale.sale_id
            
        except Exception as e:
            db.session.rollback()
            print(f"\n✗ Error saving sale: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

def main():
    """
    Main function to run YOLO inference with database integration
    """
    # Load the trained model
    model = YOLO('best.pt')
    
    # Get product prices from database
    print("Loading product prices from database...")
    product_catalog = get_product_prices()
    
    if not product_catalog:
        print("Error: No products found in database!")
        print("Please run the Flask app first to initialize the database.")
        return
    
    print(f"Loaded {len(product_catalog)} products from database")
    print("Products available:")
    for class_name, info in product_catalog.items():
        print(f"  - {info['name']} ({class_name}): ₹{info['price']} [Stock: {info['stock']}]")
    
    # Open the webcam
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open video capture.")
        return
    
    print("\n" + "="*50)
    print("Smart Cart System - Database Connected")
    print("="*50)
    print("Press 'q' to quit")
    print("Press 's' to save current bill")
    print("Press 'r' to reload product catalog")
    print("="*50 + "\n")
    
    current_bill = Counter()  # Track current bill
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to capture frame.")
            break
        
        # Run YOLOv8 inference
        results = model(frame, conf=0.7, verbose=False)
        
        # Analyze detections
        detected_classes = []
        
        # Loop through detections in the first result
        for result in results:
            boxes = result.boxes
            for box in boxes:
                # Get class ID
                cls_id = int(box.cls[0])
                # Get class name using the model's names dictionary
                class_name = model.names[cls_id]
                detected_classes.append(class_name)
        
        # Count quantities of each detected class
        counts = Counter(detected_classes)
        current_bill = counts  # Update current bill
        
        # Calculate total price
        total_price = 0
        bill_summary = []
        out_of_stock_items = []
        
        # Print header to console
        print("\n" * 20)  # 'Clear' console for readability
        print("="*60)
        print(" "*20 + "BILLING SUMMARY")
        print("="*60)
        
        for item, quantity in counts.items():
            if item in product_catalog:
                product_info = product_catalog[item]
                price = product_info['price']
                product_name = product_info['name']
                stock = product_info['stock']
                
                # Check if sufficient stock is available
                if quantity > stock:
                    out_of_stock_items.append(f"{product_name} (Requested: {quantity}, Available: {stock})")
                    available_qty = stock
                else:
                    available_qty = quantity
                
                item_total = price * available_qty
                total_price += item_total
                
                line = f"{product_name} ({product_info['brand']})"
                line += f"\n  {available_qty} x ₹{price} = ₹{item_total}"
                if quantity > stock:
                    line += f" ⚠ Only {stock} available!"
                
                bill_summary.append(line)
                print(line)
            else:
                line = f"⚠ Unknown Item: {item} (Not in database)"
                bill_summary.append(line)
                print(line)
        
        print("-"*60)
        print(f"TOTAL: ₹{total_price}")
        print("="*60)
        
        if out_of_stock_items:
            print("\n⚠ STOCK WARNINGS:")
            for warning in out_of_stock_items:
                print(f"  - {warning}")
        
        # Visualize the results on the frame (bounding boxes)
        annotated_frame = results[0].plot()
        
        # Draw the bill summary on the frame
        y_offset = 30
        cv2.putText(annotated_frame, "--- BILLING SUMMARY ---", (10, y_offset), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        
        y_offset += 30
        for item, quantity in counts.items():
            if item in product_catalog:
                product_info = product_catalog[item]
                price = product_info['price']
                available_qty = min(quantity, product_info['stock'])
                item_total = price * available_qty
                
                line = f"{product_info['name']}: {available_qty} x Rs{price} = Rs{item_total}"
                cv2.putText(annotated_frame, line, (10, y_offset), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                y_offset += 25
        
        # Draw Total Price
        y_offset += 20
        cv2.putText(annotated_frame, f"TOTAL: Rs {total_price}", (10, y_offset), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        
        # Display the resulting frame
        cv2.imshow('Smart Cart - Database Connected', annotated_frame)
        
        # Exit on 'q'
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('s'):
            # Save the current bill
            if current_bill:
                print("\n💾 Saving sale...")
                sale_id = save_transaction(current_bill, product_catalog)
                if sale_id:
                    print(f"✓ Sale #{sale_id} saved successfully!")
                    # Reload product catalog to get updated stock
                    product_catalog = get_product_prices()
                else:
                    print("✗ Failed to save sale")
            else:
                print("\n⚠ No items detected. Nothing to save.")
        elif key == ord('r'):
            # Reload product catalog
            print("\n🔄 Reloading product catalog...")
            product_catalog = get_product_prices()
            print("✓ Product catalog reloaded")
    
    cap.release()
    cv2.destroyAllWindows()
    print("\nSystem closed.")

if __name__ == '__main__':
    main()
