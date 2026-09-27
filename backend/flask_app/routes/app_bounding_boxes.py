"""
YOLO Detection Routes with Bounding Box Visualization via SocketIO
Optimized real-time product detection with persistent bill
TEST MODE: Reads products from DB but doesn't save sales/bills
"""

from flask import Blueprint, jsonify, request, Response
from flask import stream_with_context
import cv2
from ultralytics import YOLO
from collections import Counter, deque
import threading
import os
import sys
import time
import random

# Add parent directory to path for model imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from flask_app.models.models import Product

yolo_bp = Blueprint('yolo', __name__, url_prefix='/api/yolo')

# Global variables
model = None
cap = None
camera_lock = threading.Lock()
is_running = False
current_thread = None
bill_frozen = False
current_counts = Counter()
persistent_bill = Counter()  # Accumulates items, never decreases
finalized_bill = Counter()
final_total = 0
product_catalog = {}
socketio = None  # Will be set from main app

# Detection stability buffers
DETECTION_HISTORY_SECONDS = 2.0  # Time an item must be present to count
detection_buffer = None          # Will be initialized based on FPS

# Shared latest frame — written by frame_grabber, read by MJPEG stream and inference loop
latest_frame = None
frame_lock = threading.Lock()
grabber_thread = None

# Inference settings
frame_skip_count = 0
FRAME_SKIP = 3          # Run YOLO every Nth frame; lower = more accurate, higher = faster
INFERENCE_SIZE = (480, 320)  # YOLO input size — smaller is faster
INFERENCE_FPS = 10      # Max rate for YOLO inference loop

# MJPEG stream settings — edit these to trade off quality vs bandwidth
MJPEG_SIZE = (1280, 720)  # HD Resolution
MJPEG_QUALITY = 85        # Higher JPEG quality

# Per-class box colours (consistent across sessions)
class_colors = {}


def init_socketio(sio):
    """Initialize SocketIO instance from main app and register event handlers"""
    global socketio
    socketio = sio
    
    # Register SocketIO event handlers
    @socketio.on('connect')
    def handle_connect():
        print('Client connected to SocketIO')
    
    @socketio.on('disconnect')
    def handle_disconnect():
        print('Client disconnected from SocketIO')
    
    @socketio.on('ping')
    def handle_ping():
        socketio.emit('pong')


def startup_preload(app):
    """Pre-load model at server startup in a background thread.
    Keep camera lazy-initialized to avoid device lock/contention on Windows."""
    def _preload():
        print("[Startup] Pre-loading YOLO model...")
        # Model init accesses the DB so it needs an app context
        with app.app_context():
            initialize_model()
        print("[Startup] Model pre-loading complete.")
    
    t = threading.Thread(target=_preload, daemon=True)
    t.start()


def get_product_catalog():
    """Fetch product prices and info from database"""
    global product_catalog
    try:
        products = Product.query.all()
        product_catalog = {}
        for product in products:
            product_catalog[product.class_name] = {
                'price': product.unit_price,
                'name': product.product_name,
                'brand': product.brand,
                'stock': product.stock,
                'product_id': product.product_id
            }
        return product_catalog
    except Exception as e:
        print(f"Error fetching product catalog: {str(e)}")
        return {}


def get_class_color(class_name):
    """Get or generate a consistent RGB colour for a product class."""
    if class_name not in class_colors:
        random.seed(hash(class_name) % 2147483647)
        class_colors[class_name] = (
            random.randint(80, 255),
            random.randint(80, 255),
            random.randint(80, 255),
        )
    return class_colors[class_name]


def get_class_color_hex(class_name):
    """Return the class colour as a CSS hex string for the frontend canvas."""
    r, g, b = get_class_color(class_name)
    return f'#{r:02x}{g:02x}{b:02x}'


def initialize_camera():
    """Initialize camera if not already initialized."""
    global cap

    def _try_open_camera(device_index, backend):
        backend_name = {
            cv2.CAP_DSHOW: 'CAP_DSHOW',
            cv2.CAP_MSMF: 'CAP_MSMF',
            cv2.CAP_ANY: 'CAP_ANY',
        }.get(backend, str(backend))

        opened_cap = cv2.VideoCapture(device_index, backend)
        if not opened_cap.isOpened():
            opened_cap.release()
            return None

        opened_cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        opened_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        opened_cap.set(cv2.CAP_PROP_FPS, 30)
        opened_cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Keep buffer small for low latency

        # Warm up and validate that frames are actually readable.
        for _ in range(10):
            ok, _ = opened_cap.read()
            if ok:
                print(f"[Camera] Initialized with backend {backend_name}")
                return opened_cap
            time.sleep(0.05)

        opened_cap.release()
        print(f"[Camera] Backend {backend_name} opened but could not read frames")
        return None

    with camera_lock:
        if cap is None or not cap.isOpened():
            backends = [cv2.CAP_ANY]
            if os.name == 'nt':
                # DirectShow is typically more stable than MSMF for USB webcams on Windows.
                backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]

            cap = None
            for backend in backends:
                cap = _try_open_camera(0, backend)
                if cap is not None:
                    break

        return cap


def frame_grabber():
    """Continuously reads frames from the camera into latest_frame.
    Single reader thread eliminates lock contention between MJPEG and inference."""
    global latest_frame, cap, is_running
    while is_running:
        with camera_lock:
            if cap is None or not cap.isOpened():
                break
            ret, frame = cap.read()
        if ret:
            with frame_lock:
                latest_frame = frame
        else:
            time.sleep(0.01)


def generate_mjpeg():
    """Generator that yields raw camera frames as an MJPEG stream.
    Runs independently of YOLO inference — full camera FPS, no bounding boxes."""
    global latest_frame
    while True:
        with frame_lock:
            frame = latest_frame.copy() if latest_frame is not None else None
        if frame is None:
            time.sleep(0.033)
            continue
        resized = cv2.resize(frame, MJPEG_SIZE)  # See MJPEG_SIZE constant above
        _, buf = cv2.imencode('.jpg', resized, [cv2.IMWRITE_JPEG_QUALITY, MJPEG_QUALITY])
        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n'
            + buf.tobytes()
            + b'\r\n'
        )


@yolo_bp.route('/video_feed')
def video_feed():
    """MJPEG endpoint consumed directly by the <img> tag on the frontend."""
    return Response(
        stream_with_context(generate_mjpeg()),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


@yolo_bp.route('/clear_bill', methods=['POST'])
def clear_bill():
    """Manually clear the persistent bill."""
    global persistent_bill, current_counts, detection_buffer
    try:
        persistent_bill.clear()
        current_counts.clear()
        if detection_buffer:
            detection_buffer.clear()
        
        return jsonify({
            'success': True,
            'message': 'Bill cleared successfully'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def initialize_model():
    """Initialize YOLO model with GPU acceleration if available"""
    global model, product_catalog
    try:
        # Use best.pt from backend directory
        model_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'best.pt'
        )
        
        if os.path.exists(model_path):
            print(f"Found model at: {model_path}")
            
            # Initialize model with GPU support if available
            model = YOLO(model_path)
            
            # Check if CUDA is available and use it
            import torch
            if torch.cuda.is_available():
                model.to('cuda')
                print("GPU acceleration enabled (CUDA)")
            else:
                print("Using CPU (CUDA not available)")
            
            # Load product catalog from database
            print("Loading product catalog from database...")
            get_product_catalog()
            print(f"Loaded {len(product_catalog)} products from database")
            
            return True
        else:
            print(f"Model file not found at: {model_path}")
            return False
    except Exception as e:
        print(f"Error loading model: {e}")
        return False

def detection_loop():
    """YOLO inference loop with temporal smoothing (debouncing).
    Requires items to be detected consistently over a time window before adding to bill."""
    global is_running, current_counts, bill_frozen, persistent_bill, product_catalog, socketio, detection_buffer

    frame_interval = 1.0 / INFERENCE_FPS
    
    # Initialize deque for sliding window of detections
    # Buffer size = FPS * Seconds
    buffer_maxlen = int(INFERENCE_FPS * DETECTION_HISTORY_SECONDS)
    detection_buffer = deque(maxlen=buffer_maxlen)
    
    # Threshold: Item must verify its quantity in X% of frames in buffer
    # This prevents flickering or transient false positives
    CONFIDENCE_THRESHOLD = 0.6  # 60% of frames in window must agree

    while is_running:
        start_time = time.time()
        try:
            with frame_lock:
                frame = latest_frame.copy() if latest_frame is not None else None

            if frame is None:
                time.sleep(0.05)
                continue

            if not product_catalog:
                get_product_catalog()

            if not bill_frozen and model:
                # 1. Run Inference
                inference_frame = cv2.resize(frame, INFERENCE_SIZE)
                results = model(inference_frame, conf=0.7, verbose=False, imgsz=320)

                detected_classes = []
                normalised_boxes = []

                # extract results
                for result in results:
                    if result.boxes is None:
                        continue
                    for box in result.boxes:
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        cls_id = int(box.cls[0])
                        class_name = model.names[cls_id]
                        detected_classes.append(class_name)

                        label = class_name
                        if class_name in product_catalog:
                            label = f"{product_catalog[class_name]['name']} \u20b9{product_catalog[class_name]['price']}"

                        # Normalise coords for frontend canvas
                        normalised_boxes.append({
                            'x1': float(x1) / INFERENCE_SIZE[0],
                            'y1': float(y1) / INFERENCE_SIZE[1],
                            'x2': float(x2) / INFERENCE_SIZE[0],
                            'y2': float(y2) / INFERENCE_SIZE[1],
                            'label': label,
                            'color': get_class_color_hex(class_name),
                        })

                # 2. Add current frame counts to buffer
                current_frame_counts = Counter(detected_classes)
                detection_buffer.append(current_frame_counts)

                # 3. Calculate "Stable" Counts
                # Only update persistent bill if buffer is full enough 
                if len(detection_buffer) >= (buffer_maxlen * 0.5):
                    # For each item class seen in buffer
                    all_seen_items = set()
                    for c in detection_buffer:
                        all_seen_items.update(c.keys())
                    
                    for item in all_seen_items:
                        # Get quantity detected in each frame of buffer
                        # If item missing in a frame, count is 0
                        quantities = [d[item] for d in detection_buffer]
                        
                        # Find the quantity that appears in at least CONFIDENCE_THRESHOLD of frames
                        # Sort quantities to find the stable value
                        # Logic: If we want to accept quantity Q, then count(frames where qty >= Q) must be >= threshold
                        # This is equivalent to taking the percentile value
                        quantities.sort()
                        stable_index = int(len(quantities) * (1 - CONFIDENCE_THRESHOLD))
                        stable_qty = quantities[stable_index]
                        
                        # Update persistent bill only if stable quantity increases
                        if stable_qty > persistent_bill[item]:
                            persistent_bill[item] = stable_qty

                # 4. Prepare bill data for frontend
                bill_data = []
                total_price = 0
                for item, qty in persistent_bill.items():
                    if item in product_catalog:
                        info = product_catalog[item]
                        item_total = info['price'] * qty
                        total_price += item_total
                        bill_data.append({
                            'item': info['name'],
                            'class_name': item,
                            'quantity': qty,
                            'price': info['price'],
                            'total': item_total,
                            'brand': info['brand'],
                        })

                if socketio:
                    socketio.emit('detection_update', {
                        'boxes': normalised_boxes,
                        'bill_data': bill_data,
                        'total_price': total_price,
                        'is_frozen': bill_frozen,
                    })

            elapsed = time.time() - start_time
            sleep_time = frame_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

        except Exception as e:
            print(f"Error in detection loop: {e}")
            import traceback
            traceback.print_exc()
            break


@yolo_bp.route('/start_camera', methods=['POST'])
def start_camera():
    """Start frame grabber + inference loop. Model and camera pre-loaded at startup."""
    global cap, is_running, current_thread, grabber_thread

    try:
        if not model:
            if not initialize_model():
                return jsonify({'error': 'Failed to load YOLO model'}), 500

        if cap is None or not cap.isOpened():
            initialize_camera()
            if cap is None or not cap.isOpened():
                return jsonify({'error': 'Could not open camera'}), 500

        if not is_running:
            is_running = True
            # Frame grabber feeds latest_frame for both MJPEG and inference
            grabber_thread = threading.Thread(target=frame_grabber, daemon=True)
            grabber_thread.start()
            # Inference loop reads from latest_frame, emits boxes + bill via SocketIO
            current_thread = threading.Thread(target=detection_loop, daemon=True)
            current_thread.start()

        return jsonify({'success': True, 'message': 'Detection started'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@yolo_bp.route('/stop_camera', methods=['POST'])
def stop_camera():
    """Stop all detection threads and release the camera."""
    global cap, is_running, current_thread, grabber_thread

    try:
        is_running = False

        for t in (current_thread, grabber_thread):
            if t and t.is_alive():
                t.join(timeout=2)

        with camera_lock:
            if cap:
                cap.release()
                cap = None

        return jsonify({'success': True, 'message': 'Camera stopped successfully'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@yolo_bp.route('/sales', methods=['POST'])
def create_sale():
    """
    TEST MODE: Calculate totals from persistent bill but don't save to DB
    Clears the persistent bill after checkout
    """
    global persistent_bill
    
    try:
        # Calculate total from persistent bill
        total_amount = 0
        total_items = 0
        
        for item, quantity in persistent_bill.items():
            if item in product_catalog:
                product_info = product_catalog[item]
                price = product_info['price']
                item_total = price * quantity
                total_amount += item_total
                total_items += quantity
        
        if total_items == 0:
            return jsonify({
                'success': False,
                'error': 'No items in cart'
            }), 400
        
        # TEST MODE: Clear persistent bill without saving to DB
        persistent_bill.clear()
        
        print(f"TEST MODE: Checkout completed - ₹{total_amount} ({total_items} items) - NOT saved to DB")
        
        return jsonify({
            'success': True,
            'total_amount': total_amount,
            'total_items': total_items,
            'message': f'TEST MODE: Checkout successful ₹{total_amount} (not saved to database)'
        })
        
    except Exception as e:
        print(f"Error in checkout: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@yolo_bp.route('/freeze_bill', methods=['POST'])
def freeze_bill():
    """Freeze the current bill (stop detection updates)"""
    global bill_frozen, finalized_bill, final_total, persistent_bill
    
    try:
        bill_frozen = True
        finalized_bill = persistent_bill.copy()
        
        # Calculate final total
        final_total = 0
        for item, quantity in finalized_bill.items():
            if item in product_catalog:
                price = product_catalog[item]['price']
                final_total += price * quantity
        
        return jsonify({
            'message': 'Bill frozen successfully',
            'final_total': final_total
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@yolo_bp.route('/remove_item', methods=['POST'])
def remove_item():
    """Remove a specific item from the persistent bill by class_name"""
    global persistent_bill
    try:
        data = request.get_json()
        class_name = data.get('class_name')
        if not class_name:
            return jsonify({'success': False, 'error': 'class_name is required'}), 400
        if class_name in persistent_bill:
            del persistent_bill[class_name]
            return jsonify({'success': True, 'message': f'Removed {class_name} from bill'})
        return jsonify({'success': False, 'error': 'Item not found in bill'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@yolo_bp.route('/reset_bill', methods=['POST'])
def reset_bill():
    """Reset bill for next customer (clear persistent bill)"""
    global bill_frozen, current_counts, finalized_bill, final_total, persistent_bill
    
    try:
        bill_frozen = False
        current_counts.clear()
        finalized_bill.clear()
        persistent_bill.clear()
        final_total = 0
        
        return jsonify({'success': True, 'message': 'Bill reset successfully'})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@yolo_bp.route('/catalog/refresh', methods=['POST'])
def refresh_catalog():
    """Refresh the product catalog from database"""
    try:
        catalog = get_product_catalog()
        return jsonify({
            'success': True,
            'products_count': len(catalog),
            'message': 'Product catalog refreshed'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@yolo_bp.route('/status')
def get_status():
    """Get system status - returns camera and model initialization status"""
    return jsonify({
        'success': True,
        'camera_initialized': cap is not None and cap.isOpened(),
        'model_loaded': model is not None,
        'is_running': is_running,
        'products_loaded': len(product_catalog),
        'current_items': len(persistent_bill),
        'test_mode': True
    })


# Cleanup function to be called on app shutdown
def cleanup_camera():
    """Release camera resources"""
    global cap, is_running
    is_running = False
    with camera_lock:
        if cap is not None:
            cap.release()
            cap = None