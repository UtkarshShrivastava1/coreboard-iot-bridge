import os
import sys
import time
import json
import random
import logging
import signal
from dotenv import load_dotenv
from awscrt import mqtt
from awsiot import mqtt_connection_builder

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("Simulator")

# Load environment variables (resolved relative to this file)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(SCRIPT_DIR, "../.env"))

AWS_ENDPOINT = os.getenv("AWS_ENDPOINT")
MQTT_TOPIC = os.getenv("MQTT_TOPIC")

# In AWS IoT Core multi-tenant policies, the Client ID MUST match the registered Thing Name (Device ID) exactly.
# Otherwise, AWS IoT Core will reject the mutual TLS (mTLS) connection immediately.
CLIENT_ID = os.getenv("CLIENT_ID", "PUMP-1")
DEVICE_TYPE = os.getenv("DEVICE_TYPE", "pump").lower()

# Paths to mTLS credentials (resolved relative to root directory)
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
CERT_PATH = os.getenv("CERT_PATH", "backend/certs/Device_certificate.crt")
KEY_PATH = os.getenv("KEY_PATH", "backend/certs/Private_key.key")
CA_PATH = os.getenv("CA_PATH", "backend/certs/AmazonRootCA1.pem")

if CERT_PATH and not os.path.isabs(CERT_PATH):
    CERT_PATH = os.path.abspath(os.path.join(ROOT_DIR, CERT_PATH))
if KEY_PATH and not os.path.isabs(KEY_PATH):
    KEY_PATH = os.path.abspath(os.path.join(ROOT_DIR, KEY_PATH))
if CA_PATH and not os.path.isabs(CA_PATH):
    CA_PATH = os.path.abspath(os.path.join(ROOT_DIR, CA_PATH))

# Flag to control the infinite telemetry loop
running = True

def handle_shutdown(signum, frame):
    """Gracefully handles shutdown signals (SIGINT/SIGTERM)."""
    global running
    logger.info(f"Signal received. Initiating graceful shutdown...")
    running = False

# Register signals
signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)

def validate_setup():
    """Validates that all necessary configuration and credential files are present."""
    if not AWS_ENDPOINT:
        logger.error("AWS_ENDPOINT is not set in the environment or .env file.")
        logger.error("Please configure your AWS IoT Endpoint in the .env file. E.g.:")
        logger.error("AWS_ENDPOINT=your-endpoint-ats.iot.us-east-1.amazonaws.com")
        sys.exit(1)

    if not MQTT_TOPIC:
        logger.error("MQTT_TOPIC is not set in the environment or .env file.")
        logger.error("Please configure your MQTT_TOPIC in the .env file. E.g.:")
        logger.error("MQTT_TOPIC=tenants/vdfsd/devices/PUMP-1/pub")
        sys.exit(1)

    # Verify certs exist
    files_to_check = [
        ("Device Certificate", CERT_PATH),
        ("Private Key", KEY_PATH),
        ("Root CA Certificate", CA_PATH)
    ]
    
    missing_file = False
    for label, path in files_to_check:
        if not os.path.exists(path):
            logger.error(f"{label} not found at: {path}")
            missing_file = True
            
    if missing_file:
        logger.error("Please place the required mTLS certificate files in the 'certs/' directory.")
        sys.exit(1)

def generate_telemetry(device_id, device_type):
    """Generates realistic telemetry payload based on the hardware classification."""
    data = {"status": "optimal"}
    
    if device_type == "pump":
        data.update({
            "flow_rate": round(random.uniform(22.0, 27.0), 1),
            "temperature": round(random.uniform(30.0, 35.0), 1)
        })
        # Occasional warning trigger
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
        # Occasional critical trigger
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
        # Generic payload fallback
        data.update({
            "metric_a": round(random.uniform(10, 100), 2),
            "metric_b": round(random.uniform(100, 1000), 2)
        })
        
    return {
        "device_id": device_id,
        "device_type": device_type,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **data
    }

def main():
    validate_setup()

    logger.info(f"Initializing connection to AWS IoT Core...")
    logger.info(f"Endpoint: {AWS_ENDPOINT}")
    logger.info(f"Client ID (Thing Name): {CLIENT_ID}")
    logger.info(f"Device Profile Type: {DEVICE_TYPE.upper()}")
    logger.info(f"Publish Target Topic: {MQTT_TOPIC}")

    try:
        # Build connection using the required mTLS parameters
        mqtt_connection = mqtt_connection_builder.mtls_from_path(
            endpoint=AWS_ENDPOINT,
            cert_filepath=CERT_PATH,
            pri_key_filepath=KEY_PATH,
            ca_filepath=CA_PATH,
            client_id=CLIENT_ID,
            clean_session=False,
            keep_alive_secs=30
        )
        
        # Connect
        logger.info("Connecting...")
        connect_future = mqtt_connection.connect()
        connect_future.result()
        logger.info("Connected to AWS IoT Core successfully.")
        
    except Exception as e:
        logger.error(f"Failed to establish connection to AWS IoT Core: {e}")
        logger.error("TIP: Ensure your CLIENT_ID in the .env matches the registered Thing Name exactly.")
        sys.exit(1)

    try:
        while running:
            # Generate payload matching the specific device and profile
            payload = generate_telemetry(CLIENT_ID, DEVICE_TYPE)
            payload_json = json.dumps(payload)
            logger.info(f"Publishing: {payload_json}")
            
            try:
                publish_future, packet_id = mqtt_connection.publish(
                    topic=MQTT_TOPIC,
                    payload=payload_json,
                    qos=mqtt.QoS.AT_LEAST_ONCE
                )
                # Wait for QoS 1 PUBACK
                publish_future.result()
                print(f"[PUBLISHED] Telemetry message successfully sent.", flush=True)
            except Exception as publish_error:
                logger.error(f"Failed to publish message: {publish_error}")
                
            # Sleep in 0.5-second chunks to ensure fast responsiveness to shutdown signals
            for _ in range(10):
                if not running:
                    break
                time.sleep(0.5)
                
    except Exception as run_error:
        logger.error(f"An unexpected error occurred during execution: {run_error}")
    finally:
        logger.info("Disconnecting from AWS IoT Core...")
        try:
            disconnect_future = mqtt_connection.disconnect()
            disconnect_future.result()
            logger.info("Disconnected successfully.")
        except Exception as disconnect_error:
            logger.error(f"Error during disconnect: {disconnect_error}")

if __name__ == "__main__":
    main()
