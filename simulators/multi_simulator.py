import os
import sys
import time
import json
import random
import logging
import signal
import threading
from dotenv import load_dotenv
from awscrt import mqtt
from awsiot import mqtt_connection_builder

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (%(threadName)s) %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("MultiSimulator")

# Load environment variables (resolved relative to this file)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(SCRIPT_DIR, "../.env"))

AWS_ENDPOINT = os.getenv("AWS_ENDPOINT")
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "tenants/default-tenant/devices/unknown/pub")
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
CA_PATH = os.getenv("CA_PATH", "backend/certs/AmazonRootCA1.pem")
if CA_PATH and not os.path.isabs(CA_PATH):
    CA_PATH = os.path.abspath(os.path.join(ROOT_DIR, CA_PATH))

# Resolve Tenant ID from the env topic structure
TENANT_ID = "default-tenant"
if MQTT_TOPIC and MQTT_TOPIC.startswith("tenants/"):
    parts = MQTT_TOPIC.split('/')
    if len(parts) > 1:
        TENANT_ID = parts[1]

# Flag to control infinite loop
running = True

def handle_shutdown(signum, frame):
    """Gracefully handles shutdown signals."""
    global running
    logger.info("Shutdown signal received. Stopping all device threads...")
    running = False

signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)

def detect_device_type(device_id):
    """Heuristic to detect device type based on the name of the certificate file."""
    name_lower = device_id.lower()
    
    # Check if this is the default name from env
    if name_lower == "device_certificate":
        return os.getenv("DEVICE_TYPE", "pump").lower()
        
    if "pump" in name_lower:
        return "pump"
    if "temp" in name_lower or "hum" in name_lower or "weather" in name_lower:
        return "temp_sensor"
    if "press" in name_lower or "gauge" in name_lower:
        return "pressure_sensor"
    if "power" in name_lower or "pwr" in name_lower or "meter" in name_lower:
        return "power_meter"
        
    return "custom_sensor"

def generate_telemetry(device_id, device_type):
    """Generates telemetry data based on device type."""
    data = {"status": "optimal"}
    
    if device_type == "pump":
        data.update({
            "flow_rate": round(random.uniform(22.0, 27.0), 1),
            "temperature": round(random.uniform(30.0, 35.0), 1)
        })
        if random.random() < 0.05:
            data["temperature"] = round(random.uniform(62.0, 68.0), 1)
            data["status"] = "warning"
    elif device_type == "temp_sensor":
        data.update({
            "temperature": round(random.uniform(21.0, 26.0), 1),
            "humidity": round(random.uniform(45.0, 65.0), 1)
        })
    elif device_type == "pressure_sensor":
        data.update({
            "pressure": round(random.uniform(3.5, 4.3), 2)
        })
        if random.random() < 0.05:
            data["pressure"] = round(random.uniform(5.1, 5.5), 2)
            data["status"] = "high"
    elif device_type == "power_meter":
        voltage = round(random.uniform(228.0, 232.0), 1)
        current = round(random.uniform(4.0, 5.5), 2)
        power = round((voltage * current) / 1000.0, 3) # kW
        data.update({
            "voltage": voltage,
            "current": current,
            "power": power
        })
    else:
        data.update({
            "metric_x": round(random.uniform(10, 100), 2)
        })
        
    return {
        "device_id": device_id,
        "device_type": device_type,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **data
    }

def discover_devices():
    """Scans the certs/ directory to find valid certificate/key credential pairs."""
    certs_dir = os.path.join(SCRIPT_DIR, "../backend/certs")
    if not os.path.exists(certs_dir):
        logger.error(f"'{certs_dir}/' directory not found.")
        return []

    discovered = []
    
    # List files in certs/
    files = os.listdir(certs_dir)
    for f in files:
        if f.endswith(".crt") and f != "AmazonRootCA1.pem":
            base_name = f[:-4]  # strip .crt extension
            key_file = f"{base_name}.key"
            
            if key_file in files:
                # Determine Thing Name / Client ID
                # If the file is named Device_certificate, we read CLIENT_ID from env
                thing_name = os.getenv("CLIENT_ID", "Temprature_Humidity") if base_name == "Device_certificate" else base_name
                
                device_type = detect_device_type(base_name)
                
                discovered.append({
                    "device_id": thing_name,
                    "device_type": device_type,
                    "cert_path": os.path.join(certs_dir, f),
                    "key_path": os.path.join(certs_dir, key_file)
                })
                
    return discovered

def device_simulation_thread(device_config):
    """Thread target that handles the connection and simulation loop for a single device."""
    device_id = device_config["device_id"]
    device_type = device_config["device_type"]
    cert_path = device_config["cert_path"]
    key_path = device_config["key_path"]
    
    # Topic for this device
    topic = f"tenants/{TENANT_ID}/devices/{device_id}/pub"
    
    logger.info(f"Initializing mTLS connection for device: {device_id} ({device_type})")
    logger.info(f"Target topic: {topic}")
    
    try:
        mqtt_connection = mqtt_connection_builder.mtls_from_path(
            endpoint=AWS_ENDPOINT,
            cert_filepath=cert_path,
            pri_key_filepath=key_path,
            ca_filepath=CA_PATH,
            client_id=device_id,
            clean_session=False,
            keep_alive_secs=30
        )
        
        connect_future = mqtt_connection.connect()
        connect_future.result()
        logger.info(f"Successfully connected to AWS IoT Core!")
        
    except Exception as e:
        logger.error(f"Failed to connect: {e}")
        return

    try:
        while running:
            payload = generate_telemetry(device_id, device_type)
            payload_json = json.dumps(payload)
            
            try:
                publish_future, packet_id = mqtt_connection.publish(
                    topic=topic,
                    payload=payload_json,
                    qos=mqtt.QoS.AT_LEAST_ONCE
                )
                publish_future.result()
                logger.info(f"Data Published: {payload_json}")
            except Exception as pe:
                logger.error(f"Publish failed: {pe}")
                
            # Sleep in increments to remain responsive to shutdown signal
            for _ in range(10):
                if not running:
                    break
                time.sleep(1.0)
                
    finally:
        logger.info(f"Disconnecting connection...")
        try:
            disconnect_future = mqtt_connection.disconnect()
            disconnect_future.result()
            logger.info(f"Disconnected.")
        except Exception as de:
            logger.error(f"Error during disconnect: {de}")

def main():
    if not AWS_ENDPOINT:
        logger.error("AWS_ENDPOINT is not set in the environment or .env file.")
        sys.exit(1)
        
    if not os.path.exists(CA_PATH):
        logger.error(f"Root CA file not found at: {CA_PATH}")
        sys.exit(1)

    devices = discover_devices()
    
    if not devices:
        logger.error("No valid device certificate/key pairs found in the 'certs/' directory.")
        logger.error("Please place your downloaded certificate and key files there (e.g. PUMP-1.crt + PUMP-1.key).")
        sys.exit(1)

    logger.info(f"=== Multi-Device Simulator Initiated ===")
    logger.info(f"AWS Endpoint: {AWS_ENDPOINT}")
    logger.info(f"Tenant ID: {TENANT_ID}")
    logger.info(f"Discovered {len(devices)} device credential pairs:")
    for d in devices:
        logger.info(f" - Device ID: {d['device_id']} | Profile: {d['device_type'].upper()}")
    logger.info("========================================")

    threads = []
    for device_config in devices:
        thread_name = f"Thread-{device_config['device_id']}"
        t = threading.Thread(
            target=device_simulation_thread, 
            args=(device_config,), 
            name=thread_name
        )
        t.start()
        threads.append(t)

    # Wait for all threads to terminate (graceful shutdown)
    for t in threads:
        t.join()
        
    logger.info("All device simulation threads stopped. Exit.")

if __name__ == "__main__":
    main()
