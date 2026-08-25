"""
Industrial IoT Dashboard — PySide6
5-Room Temperature & Humidity Monitoring
AWS IoT Core + DynamoDB
"""

import sys
import json
import random
import ssl
import csv
import os
import threading
from decimal import Decimal
from datetime import datetime, timedelta
from collections import deque

# ── PySide6 ──────────────────────────────────────────────────────────────────
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QGridLayout, QLabel, QPushButton, QComboBox, QTabWidget,
    QTableWidget, QTableWidgetItem, QHeaderView, QFrame,
    QSplitter, QScrollArea, QStatusBar, QSizePolicy, QSpacerItem,
    QCheckBox, QGroupBox
)
from PySide6.QtCore import (
    Qt, QTimer, Signal, QObject, QThread, QSize, QPropertyAnimation,
    QEasingCurve, QRectF
)
from PySide6.QtGui import (
    QPainter, QColor, QPen, QBrush, QFont, QFontMetrics,
    QLinearGradient, QPainterPath, QPolygonF, QPixmap
)
from PySide6.QtCharts import (
    QChart, QChartView, QLineSeries, QValueAxis, QDateTimeAxis,
    QSplineSeries, QLegend
)

# ── AWS ───────────────────────────────────────────────────────────────────────
try:
    import paho.mqtt.client as mqtt
    MQTT_OK = True
except ImportError:
    MQTT_OK = False

try:
    import boto3
    from boto3.dynamodb.conditions import Key
    BOTO3_OK = True
except ImportError:
    BOTO3_OK = False

# ════════════════════════════════════════════════════════════════════════════
#  CONFIGURATION
# ════════════════════════════════════════════════════════════════════════════
AWS_ENDPOINT   = "a3jn1jb4u5t66x-ats.iot.ap-south-1.amazonaws.com"
CA_CERT        = "AmazonRootCA1.pem"
DEVICE_CERT    = "Device_certificate.crt"
PRIVATE_KEY    = "Private_key.key"
PORT           = 8883
TOPIC_PUB      = "esp32/pub"
TOPIC_SUB      = "esp32/sub"

DYNAMO_TABLE   = "ESP32_IoT_Data"
DYNAMO_REGION  = "ap-south-1"
AWS_ACCESS_KEY = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")

ROOMS = ["Room 1", "Room 2", "Room 3", "Room 4", "Room 5"]
ROOM_IDS = ["ROOM_1", "ROOM_2", "ROOM_3", "ROOM_4", "ROOM_5"]

# ════════════════════════════════════════════════════════════════════════════
#  DESIGN TOKENS
# ════════════════════════════════════════════════════════════════════════════
C = {
    "bg":        "#0d0d1a",
    "surface":   "#12122a",
    "card":      "#1a1a35",
    "border":    "#2a2a50",
    "accent":    "#6c63ff",
    "accent2":   "#00d4ff",
    "accent3":   "#ff6b6b",
    "success":   "#00e676",
    "warning":   "#ffab40",
    "danger":    "#ff5252",
    "text":      "#e8e8ff",
    "muted":     "#8888aa",
    "room1":     "#6c63ff",
    "room2":     "#00d4ff",
    "room3":     "#00e676",
    "room4":     "#ffab40",
    "room5":     "#ff6b6b",
}
ROOM_COLORS = [C["room1"], C["room2"], C["room3"], C["room4"], C["room5"]]

STYLESHEET = f"""
QMainWindow, QWidget {{
    background-color: {C['bg']};
    color: {C['text']};
    font-family: 'Segoe UI';
    font-size: 13px;
}}
QTabWidget::pane {{
    border: 1px solid {C['border']};
    background: {C['surface']};
    border-radius: 8px;
}}
QTabBar::tab {{
    background: {C['card']};
    color: {C['muted']};
    padding: 10px 24px;
    border: none;
    font-weight: bold;
    font-size: 12px;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    margin-right: 2px;
}}
QTabBar::tab:selected {{
    background: {C['accent']};
    color: white;
}}
QTabBar::tab:hover:!selected {{
    background: {C['border']};
    color: {C['text']};
}}
QPushButton {{
    background: {C['card']};
    color: {C['text']};
    border: 1px solid {C['border']};
    border-radius: 6px;
    padding: 8px 18px;
    font-weight: bold;
}}
QPushButton:hover {{ background: {C['border']}; }}
QPushButton:pressed {{ background: {C['accent']}; color: white; }}
QPushButton.accent {{
    background: {C['accent']};
    color: white;
    border: none;
}}
QPushButton.accent:hover {{ background: #7c74ff; }}
QPushButton.success {{
    background: {C['success']};
    color: #001a00;
    border: none;
}}
QPushButton.danger {{
    background: {C['danger']};
    color: white;
    border: none;
}}
QComboBox {{
    background: {C['card']};
    color: {C['text']};
    border: 1px solid {C['border']};
    border-radius: 6px;
    padding: 6px 12px;
    min-width: 140px;
}}
QComboBox::drop-down {{ border: none; }}
QComboBox QAbstractItemView {{
    background: {C['card']};
    color: {C['text']};
    border: 1px solid {C['border']};
    selection-background-color: {C['accent']};
}}
QTableWidget {{
    background: {C['surface']};
    color: {C['text']};
    gridline-color: {C['border']};
    border: none;
    border-radius: 8px;
}}
QTableWidget::item {{ padding: 6px 10px; }}
QTableWidget::item:selected {{ background: {C['accent']}; color: white; }}
QHeaderView::section {{
    background: {C['card']};
    color: {C['accent2']};
    border: none;
    border-bottom: 2px solid {C['border']};
    padding: 8px 10px;
    font-weight: bold;
    font-size: 11px;
}}
QScrollBar:vertical {{
    background: {C['surface']};
    width: 8px;
    border-radius: 4px;
}}
QScrollBar::handle:vertical {{
    background: {C['border']};
    border-radius: 4px;
    min-height: 30px;
}}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}
QLabel {{ color: {C['text']}; }}
QFrame {{ color: {C['border']}; }}
QStatusBar {{
    background: {C['surface']};
    color: {C['muted']};
    border-top: 1px solid {C['border']};
}}
QGroupBox {{
    border: 1px solid {C['border']};
    border-radius: 8px;
    margin-top: 12px;
    padding-top: 8px;
    font-weight: bold;
    color: {C['muted']};
}}
QGroupBox::title {{
    subcontrol-origin: margin;
    left: 12px;
    padding: 0 6px;
}}
QCheckBox {{ color: {C['text']}; spacing: 8px; }}
QCheckBox::indicator {{
    width: 16px; height: 16px;
    border: 2px solid {C['border']};
    border-radius: 4px;
    background: {C['card']};
}}
QCheckBox::indicator:checked {{
    background: {C['accent']};
    border-color: {C['accent']};
}}
"""

# ════════════════════════════════════════════════════════════════════════════
#  MQTT SIGNALS BRIDGE
# ════════════════════════════════════════════════════════════════════════════
class MQTTSignals(QObject):
    message   = Signal(dict)
    status    = Signal(str, str)   # state, message

class AWSIoTClient:
    def __init__(self, signals: MQTTSignals):
        self.signals   = signals
        self.client    = None
        self.connected = False

    def connect_aws(self):
        if not MQTT_OK:
            self.signals.status.emit("error", "paho-mqtt not installed")
            return
        try:
            # Use CallbackAPIVersion to suppress deprecation warning
            try:
                self.client = mqtt.Client(
                    mqtt.CallbackAPIVersion.VERSION1,
                    client_id="ESP32_TEST",
                    protocol=mqtt.MQTTv311
                )
            except AttributeError:
                self.client = mqtt.Client(client_id="ESP32_TEST", protocol=mqtt.MQTTv311)

            # Build absolute paths for certs (same folder as script)
            base = os.path.dirname(os.path.abspath(__file__))
            
            # Check candidate directories for certificate files:
            # 1. Same directory as the script
            # 2. 'certs' subfolder
            # 3. Parent directory 'certs' folder
            candidates = [
                base,
                os.path.join(base, "certs"),
                os.path.join(os.path.dirname(base), "certs")
            ]
            
            certs_dir = base
            for path in candidates:
                if os.path.exists(os.path.join(path, CA_CERT)):
                    certs_dir = path
                    break
            
            ca   = os.path.join(certs_dir, CA_CERT)
            cert = os.path.join(certs_dir, DEVICE_CERT)
            key  = os.path.join(certs_dir, PRIVATE_KEY)

            self.client.tls_set(ca_certs=ca, certfile=cert,
                                keyfile=key, tls_version=ssl.PROTOCOL_TLSv1_2)
            self.client.on_connect    = self._on_connect
            self.client.on_disconnect = self._on_disconnect
            self.client.on_message    = self._on_message
            self.signals.status.emit("connecting", f"Connecting to {AWS_ENDPOINT}…")
            self.client.connect(AWS_ENDPOINT, PORT, keepalive=60)
            self.client.loop_start()
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.signals.status.emit("error", f"MQTT Error: {e}")

    def disconnect_aws(self):
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()

    def publish(self, payload: dict) -> bool:
        if not self.connected:
            return False
        r = self.client.publish(TOPIC_PUB, json.dumps(payload), qos=1)
        return r.rc == mqtt.MQTT_ERR_SUCCESS

    def _on_connect(self, client, ud, flags, rc):
        if rc == 0:
            self.connected = True
            client.subscribe(TOPIC_SUB, qos=1)
            self.signals.status.emit("connected", "Connected to AWS IoT Core")
        else:
            codes = {
                1: "Wrong protocol version",
                2: "Client ID rejected — check policy allows ESP32_TEST",
                3: "Server unavailable",
                4: "Bad credentials — check cert files",
                5: "Not authorised — check IoT policy",
            }
            msg = codes.get(rc, f"Unknown error rc={rc}")
            self.signals.status.emit("error", f"Connect failed: {msg}")

    def _on_disconnect(self, client, ud, rc):
        self.connected = False
        self.signals.status.emit("disconnected", "Disconnected")

    def _on_message(self, client, ud, msg):
        raw = msg.payload.decode("utf-8", errors="replace")
        try:
            p = json.loads(raw)
            if not isinstance(p, dict):
                p = {"message": p}
        except Exception:
            p = {"message": raw}
        self.signals.message.emit(p)


# ════════════════════════════════════════════════════════════════════════════
#  DECIMAL-SAFE JSON
# ════════════════════════════════════════════════════════════════════════════
class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)

def to_float(v, default="--"):
    if v is None or v == "--":
        return default
    try:
        return round(float(v), 1)
    except Exception:
        return default


# ════════════════════════════════════════════════════════════════════════════
#  DYNAMO FETCHER
# ════════════════════════════════════════════════════════════════════════════
class DynamoFetcher:
    def __init__(self):
        if BOTO3_OK:
            self.db    = boto3.resource("dynamodb", region_name=DYNAMO_REGION,
                                        aws_access_key_id=AWS_ACCESS_KEY,
                                        aws_secret_access_key=AWS_SECRET_KEY)
            self.table = self.db.Table(DYNAMO_TABLE)

    def fetch(self, device_id=None):
        if not BOTO3_OK:
            return None, "boto3 not installed"
        try:
            if device_id and device_id != "ALL":
                resp = self.table.query(
                    KeyConditionExpression=Key("device_id").eq(device_id),
                    ScanIndexForward=False, Limit=500)
            else:
                resp = self.table.scan(Limit=1000)
            items = resp.get("Items", [])
            # unwrap nested payload if needed
            result = []
            for item in items:
                if "payload" in item and isinstance(item["payload"], dict):
                    merged = {**item["payload"], **{k: v for k, v in item.items() if k != "payload"}}
                    result.append(merged)
                else:
                    result.append(item)
            result.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            return result, None
        except Exception as e:
            return None, str(e)


# ════════════════════════════════════════════════════════════════════════════
#  GAUGE WIDGET
# ════════════════════════════════════════════════════════════════════════════
class GaugeWidget(QWidget):
    def __init__(self, label="", unit="", color="#6c63ff", min_val=0, max_val=100):
        super().__init__()
        self.label   = label
        self.unit    = unit
        self.color   = QColor(color)
        self.min_val = min_val
        self.max_val = max_val
        self.value   = 0.0
        self.setMinimumSize(130, 130)
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

    def set_value(self, v):
        self.value = float(v)
        self.update()

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        w, h   = self.width(), self.height()
        size   = min(w, h) - 16
        cx, cy = w // 2, h // 2
        r      = size // 2

        # background arc
        pen = QPen(QColor(C["border"]), 8, Qt.SolidLine, Qt.RoundCap)
        p.setPen(pen)
        p.drawArc(int(cx-r), int(cy-r), size, size, 225*16, -270*16)

        # value arc
        pct  = max(0, min(1, (self.value - self.min_val) / (self.max_val - self.min_val)))
        span = int(-270 * 16 * pct)
        gpen = QPen(self.color, 8, Qt.SolidLine, Qt.RoundCap)
        p.setPen(gpen)
        p.drawArc(int(cx-r), int(cy-r), size, size, 225*16, span)

        # center value
        p.setPen(QPen(QColor(C["text"])))
        vf = QFont("Segoe UI", int(size * 0.18), QFont.Bold)
        p.setFont(vf)
        p.drawText(QRectF(cx-r, cy-r*0.6, size, size*0.5),
                   Qt.AlignCenter, f"{self.value:.1f}")

        # unit
        p.setPen(QPen(self.color))
        uf = QFont("Segoe UI", int(size * 0.1))
        p.setFont(uf)
        p.drawText(QRectF(cx-r, cy+r*0.1, size, size*0.3),
                   Qt.AlignCenter, self.unit)

        # label
        p.setPen(QPen(QColor(C["muted"])))
        lf = QFont("Segoe UI", int(size * 0.09))
        p.setFont(lf)
        p.drawText(QRectF(cx-r, cy+r*0.4, size, size*0.3),
                   Qt.AlignCenter, self.label)


# ════════════════════════════════════════════════════════════════════════════
#  ROOM CARD
# ════════════════════════════════════════════════════════════════════════════
class RoomCard(QFrame):
    send_requested = Signal(str)   # room_id

    def __init__(self, room_name, room_id, color):
        super().__init__()
        self.room_id   = room_id
        self.color     = color
        self.setFrameShape(QFrame.StyledPanel)
        self.setStyleSheet(f"""
            RoomCard {{
                background: {C['card']};
                border: 1px solid {color}44;
                border-radius: 12px;
                border-left: 4px solid {color};
            }}
        """)
        self.setMinimumHeight(220)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(14, 12, 14, 12)
        lay.setSpacing(6)

        # header
        hdr = QHBoxLayout()
        dot = QLabel("●")
        dot.setStyleSheet(f"color: {color}; font-size: 10px;")
        title = QLabel(room_name)
        title.setStyleSheet(f"color: {color}; font-size: 14px; font-weight: bold;")
        self.status_dot = QLabel("○")
        self.status_dot.setStyleSheet(f"color: {C['muted']}; font-size: 10px;")
        hdr.addWidget(dot)
        hdr.addWidget(title)
        hdr.addStretch()
        hdr.addWidget(self.status_dot)
        lay.addLayout(hdr)

        sep = QFrame(); sep.setFrameShape(QFrame.HLine)
        sep.setStyleSheet(f"color: {color}22;")
        lay.addWidget(sep)

        # gauges
        gauge_row = QHBoxLayout()
        self.temp_gauge = GaugeWidget("TEMP", "°C", color,    0, 60)
        self.hum_gauge  = GaugeWidget("HUM",  "%",  C["accent2"], 0, 100)
        gauge_row.addWidget(self.temp_gauge)
        gauge_row.addWidget(self.hum_gauge)
        lay.addLayout(gauge_row)

        # last updated
        self.ts_lbl = QLabel("No data yet")
        self.ts_lbl.setStyleSheet(f"color: {C['muted']}; font-size: 10px;")
        self.ts_lbl.setAlignment(Qt.AlignCenter)
        lay.addWidget(self.ts_lbl)

        # send button
        self.send_btn = QPushButton(f"📤  Send Random Data")
        self.send_btn.setStyleSheet(f"""
            QPushButton {{
                background: {color}22;
                color: {color};
                border: 1px solid {color}55;
                border-radius: 6px;
                padding: 6px;
                font-size: 11px;
                font-weight: bold;
            }}
            QPushButton:hover {{ background: {color}44; }}
            QPushButton:pressed {{ background: {color}66; }}
        """)
        self.send_btn.clicked.connect(lambda: self.send_requested.emit(self.room_id))
        lay.addWidget(self.send_btn)

    def update_data(self, temp, hum, ts):
        self.temp_gauge.set_value(temp)
        self.hum_gauge.set_value(hum)
        self.ts_lbl.setText(f"Updated: {ts[-8:] if len(ts) > 8 else ts} UTC")
        self.status_dot.setStyleSheet(f"color: {C['success']}; font-size: 10px;")


# ════════════════════════════════════════════════════════════════════════════
#  TREND CHART
# ════════════════════════════════════════════════════════════════════════════
class TrendChart(QWidget):
    def __init__(self, title="Trend"):
        super().__init__()
        self.read_count  = 0          # global x counter
        self.data_map    = {rid: deque(maxlen=60) for rid in ROOM_IDS}
        self.series_map  = {}         # room_id → (temp_series, hum_series)
        self.current_filter = "ALL"

        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        # ── chart ──────────────────────────────────────────────────────
        self.chart = QChart()
        self.chart.setTitle(title)
        self.chart.setBackgroundBrush(QBrush(QColor(C["card"])))
        self.chart.setTitleBrush(QBrush(QColor(C["text"])))
        self.chart.setTitleFont(QFont("Segoe UI", 11, QFont.Bold))
        self.chart.setAnimationOptions(QChart.NoAnimation)  # faster updates
        self.chart.legend().setVisible(True)
        self.chart.legend().setAlignment(Qt.AlignBottom)
        self.chart.legend().setLabelColor(QColor(C["muted"]))
        self.chart.legend().setBackgroundVisible(False)

        # ── axes ───────────────────────────────────────────────────────
        self.axis_x = QValueAxis()
        self.axis_x.setTitleText("Reading #")
        self.axis_x.setLabelFormat("%d")
        self.axis_x.setLabelsColor(QColor(C["muted"]))
        self.axis_x.setTitleBrush(QBrush(QColor(C["muted"])))
        self.axis_x.setGridLineColor(QColor(C["border"]))
        self.axis_x.setTickCount(7)
        self.axis_x.setRange(0, 20)

        self.axis_y_temp = QValueAxis()
        self.axis_y_temp.setTitleText("Temperature (°C)")
        self.axis_y_temp.setLabelFormat("%.1f")
        self.axis_y_temp.setLabelsColor(QColor(C["warning"]))
        self.axis_y_temp.setTitleBrush(QBrush(QColor(C["warning"])))
        self.axis_y_temp.setGridLineColor(QColor(C["border"]))
        self.axis_y_temp.setRange(0, 60)
        self.axis_y_temp.setTickCount(7)

        self.axis_y_hum = QValueAxis()
        self.axis_y_hum.setTitleText("Humidity (%)")
        self.axis_y_hum.setLabelFormat("%.1f")
        self.axis_y_hum.setLabelsColor(QColor(C["accent2"]))
        self.axis_y_hum.setTitleBrush(QBrush(QColor(C["accent2"])))
        self.axis_y_hum.setGridLineColor(QColor(C["border"]))
        self.axis_y_hum.setRange(0, 100)
        self.axis_y_hum.setTickCount(6)

        self.chart.addAxis(self.axis_x,      Qt.AlignBottom)
        self.chart.addAxis(self.axis_y_temp, Qt.AlignLeft)
        self.chart.addAxis(self.axis_y_hum,  Qt.AlignRight)

        # ── series — one pair per room ─────────────────────────────────
        for rid, rname, color in zip(ROOM_IDS, ROOMS, ROOM_COLORS):
            t_series = QLineSeries()
            t_series.setName(f"{rname} °C")
            t_pen = QPen(QColor(color), 2, Qt.SolidLine)
            t_series.setPen(t_pen)

            h_series = QLineSeries()
            h_series.setName(f"{rname} %")
            h_pen = QPen(QColor(color), 1.5, Qt.DashLine)
            h_series.setPen(h_pen)

            self.chart.addSeries(t_series)
            self.chart.addSeries(h_series)

            # attach to axes
            t_series.attachAxis(self.axis_x)
            t_series.attachAxis(self.axis_y_temp)
            h_series.attachAxis(self.axis_x)
            h_series.attachAxis(self.axis_y_hum)

            self.series_map[rid] = (t_series, h_series)

        # ── chart view ─────────────────────────────────────────────────
        self.view = QChartView(self.chart)
        self.view.setRenderHint(QPainter.Antialiasing)
        self.view.setStyleSheet(f"background: {C['card']}; border-radius: 10px;")
        lay.addWidget(self.view)

        # ── no-data label (hidden once data arrives) ───────────────────
        self.no_data_lbl = QLabel("📡  No data yet — click Send Random Data to start")
        self.no_data_lbl.setAlignment(Qt.AlignCenter)
        self.no_data_lbl.setStyleSheet(
            f"color: {C['muted']}; font-size: 13px; background: transparent;")
        # overlay on chart
        self.no_data_lbl.setParent(self.view)
        self.no_data_lbl.setGeometry(0, 0, 600, 400)
        self.no_data_lbl.raise_()

    def resizeEvent(self, event):
        super().resizeEvent(event)
        if hasattr(self, "no_data_lbl"):
            self.no_data_lbl.setGeometry(0, 0,
                self.view.width(), self.view.height())

    def add_point(self, room_id, temp, hum):
        """Called from main window every time a room sends data."""
        if room_id not in self.series_map:
            return

        # hide no-data label
        self.no_data_lbl.hide()

        dq = self.data_map[room_id]
        dq.append((self.read_count, temp, hum))
        self.read_count += 1

        t_s, h_s = self.series_map[room_id]

        # rebuild series from deque
        t_s.clear()
        h_s.clear()
        for x, t, h in dq:
            t_s.append(float(x), float(t))
            h_s.append(float(x), float(h))

        # update x axis to scroll
        if self.read_count > 20:
            self.axis_x.setRange(
                float(self.read_count - 20),
                float(self.read_count))
        else:
            self.axis_x.setRange(0, 20)

        # auto-scale temp axis
        all_temps = [t for dq2 in self.data_map.values() for _, t, _ in dq2]
        if all_temps:
            lo = max(0, min(all_temps) - 5)
            hi = max(all_temps) + 5
            self.axis_y_temp.setRange(lo, hi)

        # apply current room filter visibility
        self._apply_filter()

    def filter_room(self, room_id):
        self.current_filter = room_id
        self._apply_filter()

    def _apply_filter(self):
        for rid, (t_s, h_s) in self.series_map.items():
            show = (self.current_filter == "ALL" or rid == self.current_filter)
            t_s.setVisible(show)
            h_s.setVisible(show)



# ════════════════════════════════════════════════════════════════════════════
#  DYNAMO WORKER THREAD  (safe Qt thread for DB fetch)
# ════════════════════════════════════════════════════════════════════════════
class DynamoWorker(QThread):
    finished = Signal(list, str)   # items, error

    def __init__(self, dynamo: "DynamoFetcher", room_id: str):
        super().__init__()
        self.dynamo   = dynamo
        self.room_id  = room_id

    def run(self):
        device_id = None if self.room_id == "ALL" else self.room_id
        items, err = self.dynamo.fetch(device_id)
        self.finished.emit(items or [], err or "")


# ════════════════════════════════════════════════════════════════════════════
#  REPORT TABLE
# ════════════════════════════════════════════════════════════════════════════
class ReportTable(QWidget):
    def __init__(self, dynamo: DynamoFetcher):
        super().__init__()
        self.dynamo = dynamo
        self.all_data = []

        lay = QVBoxLayout(self)
        lay.setContentsMargins(16, 16, 16, 16)
        lay.setSpacing(10)

        # ── toolbar ──
        tb = QHBoxLayout()
        lbl = QLabel("📊  Data Report")
        lbl.setStyleSheet("font-size: 16px; font-weight: bold;")
        tb.addWidget(lbl)
        tb.addStretch()

        self.room_combo = QComboBox()
        self.room_combo.addItem("All Rooms", "ALL")
        for rid, rname in zip(ROOM_IDS, ROOMS):
            self.room_combo.addItem(rname, rid)
        self.room_combo.currentIndexChanged.connect(self._filter_table)
        tb.addWidget(QLabel("Filter:"))
        tb.addWidget(self.room_combo)

        self.refresh_btn = QPushButton("🔄  Refresh DynamoDB")
        self.refresh_btn.setStyleSheet(f"""
            QPushButton {{
                background: {C['accent2']};
                color: #001a1a;
                border: none;
                border-radius: 6px;
                padding: 8px 16px;
                font-weight: bold;
            }}
            QPushButton:hover {{ background: #00bfdf; }}
        """)
        self.refresh_btn.clicked.connect(self._fetch)
        tb.addWidget(self.refresh_btn)

        self.export_btn = QPushButton("💾  Export CSV")
        self.export_btn.setStyleSheet(f"""
            QPushButton {{
                background: {C['success']};
                color: #001a00;
                border: none;
                border-radius: 6px;
                padding: 8px 16px;
                font-weight: bold;
            }}
            QPushButton:hover {{ background: #00c060; }}
        """)
        self.export_btn.clicked.connect(self._export)
        tb.addWidget(self.export_btn)
        lay.addLayout(tb)

        # ── summary ──
        self.summary = QLabel("Total: 0   |   With Temp: 0   |   With Hum: 0   |   Rooms: 0")
        self.summary.setStyleSheet(f"""
            background: {C['surface']};
            color: {C['muted']};
            padding: 8px 14px;
            border-radius: 6px;
            font-size: 11px;
        """)
        lay.addWidget(self.summary)

        # ── status ──
        self.status_lbl = QLabel("")
        self.status_lbl.setStyleSheet(f"color: {C['warning']}; font-size: 11px;")
        lay.addWidget(self.status_lbl)

        # ── table ──
        self.table = QTableWidget()
        cols = ["#", "Timestamp", "Device ID", "Room", "Temperature (°C)",
                "Humidity (%)", "Source", "Raw Payload"]
        self.table.setColumnCount(len(cols))
        self.table.setHorizontalHeaderLabels(cols)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Interactive)
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        self.table.setAlternatingRowColors(False)
        self.table.verticalHeader().setVisible(False)
        self.table.setColumnWidth(0, 44)
        self.table.setColumnWidth(1, 165)
        self.table.setColumnWidth(2, 120)
        self.table.setColumnWidth(3, 100)
        self.table.setColumnWidth(4, 120)
        self.table.setColumnWidth(5, 110)
        self.table.setColumnWidth(6, 80)
        lay.addWidget(self.table)

        # ── legend ──
        leg = QHBoxLayout()
        for color, label in [(C["success"], "🟢 Live (MQTT)"),
                              (C["accent2"], "🔵 Historical (DynamoDB)"),
                              (C["warning"], "🟡 Plain message")]:
            l = QLabel(label)
            l.setStyleSheet(f"color: {color}; font-size: 10px;")
            leg.addWidget(l)
        leg.addStretch()
        lay.addLayout(leg)

    def add_live_row(self, payload: dict, ts: str):
        self._insert_row(payload, ts, "Live")

    def _fetch(self):
        self.status_lbl.setText("⏳  Fetching from DynamoDB…")
        self.status_lbl.setStyleSheet(f"color: {C['warning']}; font-size: 11px;")
        room_id = self.room_combo.currentData()
        # Use a worker thread with a signal to safely update UI
        self._worker = DynamoWorker(self.dynamo, room_id)
        self._worker.finished.connect(self._on_fetch_done)
        self._worker.start()

    def _on_fetch_done(self, items, err):
        if err:
            self._post_status(f"✗  {err}", C["danger"])
        else:
            self._post_items(items)

    def _post_status(self, msg, color):
        self.status_lbl.setText(msg)
        self.status_lbl.setStyleSheet(f"color: {color}; font-size: 11px;")

    def _post_items(self, items):
        # remove old history rows, keep live
        self.all_data = [r for r in self.all_data if r.get("source") == "Live"]

        # insert all history rows
        for item in items:
            # unwrap nested payload if IoT rule wrapped it
            if "payload" in item and isinstance(item["payload"], dict):
                item = {**item["payload"],
                        **{k: v for k, v in item.items() if k != "payload"}}
            ts = str(item.get("timestamp", "--"))
            temp = to_float(item.get("temperature"))
            hum  = to_float(item.get("humidity"))
            dev  = str(item.get("device_id", "--"))
            room = self._dev_to_room(dev)
            raw  = json.dumps(item, cls=DecimalEncoder)
            self.all_data.append({
                "timestamp": ts, "device_id": dev, "room": room,
                "temperature": temp, "humidity": hum,
                "source": "History", "raw": raw
            })

        self._refresh_table()
        self._post_status(
            f"✅  Loaded {len(items)} records from DynamoDB  (table: {DYNAMO_TABLE})",
            C["success"])
        self._update_summary()

    def _insert_row(self, payload: dict, ts: str, source: str):
        temp = to_float(payload.get("temperature"))
        hum  = to_float(payload.get("humidity"))
        dev  = str(payload.get("device_id", "--"))
        room = self._dev_to_room(dev)
        raw  = json.dumps(payload, cls=DecimalEncoder)
        self.all_data.append({
            "timestamp": ts, "device_id": dev, "room": room,
            "temperature": temp, "humidity": hum,
            "source": source, "raw": raw
        })
        self._refresh_table()
        self._update_summary()

    def _refresh_table(self):
        room_filter = self.room_combo.currentData()
        rows = self.all_data if room_filter == "ALL" else \
               [r for r in self.all_data if r["device_id"] == room_filter
                or r["room"] == self._id_to_room(room_filter)]
        self.table.setRowCount(len(rows))
        for i, r in enumerate(rows):
            temp = r["temperature"]
            hum  = r["humidity"]
            vals = [
                str(i+1),
                r["timestamp"],
                r["device_id"],
                r["room"],
                f"{temp} °C" if temp != "--" else "--",
                f"{hum} %"   if hum  != "--" else "--",
                r["source"],
                r["raw"]
            ]
            for j, v in enumerate(vals):
                item = QTableWidgetItem(str(v))
                item.setTextAlignment(Qt.AlignCenter if j in (0,4,5,6) else Qt.AlignLeft | Qt.AlignVCenter)
                # row color
                if r["source"] == "Live":
                    item.setForeground(QColor(C["success"]))
                elif temp != "--":
                    item.setForeground(QColor(C["accent2"]))
                else:
                    item.setForeground(QColor(C["warning"]))
                if i % 2 == 0:
                    item.setBackground(QColor(C["surface"]))
                else:
                    item.setBackground(QColor(C["card"]))
                self.table.setItem(i, j, item)
        self.table.scrollToBottom()

    def _filter_table(self):
        self._refresh_table()

    def _update_summary(self):
        total    = len(self.all_data)
        w_temp   = sum(1 for r in self.all_data if r["temperature"] != "--")
        w_hum    = sum(1 for r in self.all_data if r["humidity"]    != "--")
        rooms    = len(set(r["device_id"] for r in self.all_data))
        live     = sum(1 for r in self.all_data if r["source"] == "Live")
        hist     = sum(1 for r in self.all_data if r["source"] == "History")
        self.summary.setText(
            f"Total: {total}   |   Temp: {w_temp}   |   Hum: {w_hum}   |"
            f"   Rooms: {rooms}   |   🟢 Live: {live}   |   🔵 History: {hist}")

    def _export(self):
        if not self.all_data:
            return
        fname = f"iot_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        path  = os.path.join(os.path.dirname(os.path.abspath(__file__)), fname)
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["timestamp","device_id","room",
                                               "temperature","humidity","source","raw"])
            w.writeheader(); w.writerows(self.all_data)
        self._post_status(f"💾  CSV saved → {path}", C["success"])

    def _dev_to_room(self, dev_id):
        for rid, rname in zip(ROOM_IDS, ROOMS):
            if dev_id == rid:
                return rname
        return dev_id

    def _id_to_room(self, room_id):
        for rid, rname in zip(ROOM_IDS, ROOMS):
            if rid == room_id:
                return rname
        return room_id


# ════════════════════════════════════════════════════════════════════════════
#  MAIN WINDOW
# ════════════════════════════════════════════════════════════════════════════
class IndustrialDashboard(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Industrial IoT  ·  5-Room Monitor  ·  AWS IoT Core")
        self.setMinimumSize(1280, 780)
        self.resize(1400, 860)
        self.setStyleSheet(STYLESHEET)

        self.room_data  = {rid: {"temp": 0.0, "hum": 0.0, "ts": "--"} for rid in ROOM_IDS}
        self.dynamo     = DynamoFetcher() if BOTO3_OK else None

        # MQTT
        self.mqtt_signals = MQTTSignals()
        self.mqtt_signals.message.connect(self._on_message)
        self.mqtt_signals.status.connect(self._on_status)
        self.mqtt_client = AWSIoTClient(self.mqtt_signals)

        self._build_ui()

        # connect after UI is built
        threading.Thread(target=self.mqtt_client.connect_aws, daemon=True).start()

        # clock timer
        self.clock_timer = QTimer(self)
        self.clock_timer.timeout.connect(self._update_clock)
        self.clock_timer.start(1000)

    # ── BUILD UI ──────────────────────────────────────────────────────────
    def _build_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        root.addWidget(self._build_topbar())

        self.tabs = QTabWidget()
        self.tabs.setDocumentMode(True)
        root.addWidget(self.tabs)

        self.tabs.addTab(self._build_overview_tab(),  "  🏭  Overview  ")
        self.tabs.addTab(self._build_trends_tab(),    "  📈  Trends  ")
        self.tabs.addTab(self._build_report_tab(),    "  📊  Report  ")
        self.tabs.addTab(self._build_control_tab(),   "  🎛  Control  ")

        self._build_statusbar()

    # ── TOP BAR ───────────────────────────────────────────────────────────
    def _build_topbar(self):
        bar = QFrame()
        bar.setStyleSheet(f"""
            QFrame {{
                background: qlineargradient(x1:0,y1:0,x2:1,y2:0,
                    stop:0 {C['surface']}, stop:1 {C['card']});
                border-bottom: 2px solid {C['accent']};
            }}
        """)
        bar.setFixedHeight(60)
        lay = QHBoxLayout(bar)
        lay.setContentsMargins(20, 0, 20, 0)

        icon = QLabel("⚡")
        icon.setStyleSheet(f"color: {C['accent']}; font-size: 22px;")
        lay.addWidget(icon)

        title = QLabel("Industrial IoT Monitor")
        title.setStyleSheet(f"color: {C['text']}; font-size: 18px; font-weight: bold;")
        lay.addWidget(title)

        sub = QLabel("5-Room  ·  AWS IoT Core  ·  DynamoDB")
        sub.setStyleSheet(f"color: {C['muted']}; font-size: 11px; margin-left: 12px;")
        lay.addWidget(sub)

        lay.addStretch()

        self.conn_lbl = QLabel("○  Disconnected")
        self.conn_lbl.setStyleSheet(f"color: {C['danger']}; font-weight: bold;")
        lay.addWidget(self.conn_lbl)

        sep = QLabel("  |  ")
        sep.setStyleSheet(f"color: {C['border']};")
        lay.addWidget(sep)

        self.clock_lbl = QLabel("")
        self.clock_lbl.setStyleSheet(f"color: {C['muted']}; font-size: 11px;")
        lay.addWidget(self.clock_lbl)

        return bar

    # ── OVERVIEW TAB ──────────────────────────────────────────────────────
    def _build_overview_tab(self):
        tab = QWidget()
        lay = QVBoxLayout(tab)
        lay.setContentsMargins(16, 16, 16, 16)
        lay.setSpacing(12)

        # send all button
        top = QHBoxLayout()
        lbl = QLabel("🏭  Live Room Monitor")
        lbl.setStyleSheet("font-size: 16px; font-weight: bold;")
        top.addWidget(lbl)
        top.addStretch()

        send_all = QPushButton("📤  Send All Rooms")
        send_all.setStyleSheet(f"""
            QPushButton {{
                background: {C['accent']};
                color: white;
                border: none;
                border-radius: 6px;
                padding: 8px 20px;
                font-weight: bold;
            }}
            QPushButton:hover {{ background: #7c74ff; }}
        """)
        send_all.clicked.connect(self._send_all_rooms)
        top.addWidget(send_all)

        self.auto_all_cb = QCheckBox("Auto every 5s")
        self.auto_all_cb.setStyleSheet(f"color: {C['muted']};")
        self.auto_all_cb.toggled.connect(self._toggle_auto_all)
        top.addWidget(self.auto_all_cb)
        lay.addLayout(top)

        # room cards grid
        self.room_cards = {}
        grid = QGridLayout()
        grid.setSpacing(12)
        for i, (rid, rname, color) in enumerate(zip(ROOM_IDS, ROOMS, ROOM_COLORS)):
            card = RoomCard(rname, rid, color)
            card.send_requested.connect(self._send_room)
            self.room_cards[rid] = card
            grid.addWidget(card, i // 3, i % 3)
        lay.addLayout(grid)

        # auto timer
        self.auto_timer = QTimer(self)
        self.auto_timer.timeout.connect(self._send_all_rooms)

        return tab

    # ── TRENDS TAB ────────────────────────────────────────────────────────
    def _build_trends_tab(self):
        tab = QWidget()
        lay = QVBoxLayout(tab)
        lay.setContentsMargins(16, 16, 16, 16)
        lay.setSpacing(10)

        # toolbar
        tb = QHBoxLayout()
        lbl = QLabel("📈  Live Trend Chart")
        lbl.setStyleSheet("font-size: 16px; font-weight: bold;")
        tb.addWidget(lbl)
        tb.addStretch()

        tb.addWidget(QLabel("Show Room:"))
        self.trend_combo = QComboBox()
        self.trend_combo.addItem("All Rooms", "ALL")
        for rid, rname in zip(ROOM_IDS, ROOMS):
            self.trend_combo.addItem(rname, rid)
        self.trend_combo.currentIndexChanged.connect(
            lambda: self.trend_chart.filter_room(self.trend_combo.currentData()))
        tb.addWidget(self.trend_combo)
        lay.addLayout(tb)

        self.trend_chart = TrendChart("Temperature & Humidity Trend")
        lay.addWidget(self.trend_chart)
        return tab

    # ── REPORT TAB ────────────────────────────────────────────────────────
    def _build_report_tab(self):
        self.report_table = ReportTable(self.dynamo)
        return self.report_table

    # ── CONTROL TAB ───────────────────────────────────────────────────────
    def _build_control_tab(self):
        tab = QWidget()
        lay = QVBoxLayout(tab)
        lay.setContentsMargins(20, 20, 20, 20)
        lay.setSpacing(16)

        lbl = QLabel("🎛  Device Control Panel")
        lbl.setStyleSheet("font-size: 16px; font-weight: bold;")
        lay.addWidget(lbl)

        grid = QGridLayout()
        grid.setSpacing(12)

        for i, (rid, rname, color) in enumerate(zip(ROOM_IDS, ROOMS, ROOM_COLORS)):
            grp = QGroupBox(rname)
            grp.setStyleSheet(f"""
                QGroupBox {{
                    border: 1px solid {color}66;
                    border-radius: 8px;
                    margin-top: 14px;
                    color: {color};
                    font-weight: bold;
                    font-size: 12px;
                }}
                QGroupBox::title {{
                    subcontrol-origin: margin;
                    left: 12px;
                    padding: 0 6px;
                }}
            """)
            gl = QVBoxLayout(grp)
            gl.setSpacing(8)

            # temp/hum labels
            rl = QHBoxLayout()
            tl = QLabel("Temp: --"); tl.setObjectName(f"ctrl_temp_{rid}")
            tl.setStyleSheet(f"color: {color}; font-size: 20px; font-weight: bold;")
            hl = QLabel("Hum: --");  hl.setObjectName(f"ctrl_hum_{rid}")
            hl.setStyleSheet(f"color: {C['accent2']}; font-size: 20px; font-weight: bold;")
            rl.addWidget(tl); rl.addStretch(); rl.addWidget(hl)
            gl.addLayout(rl)

            # send btn
            sb = QPushButton(f"📤  Send Data")
            sb.setStyleSheet(f"""
                QPushButton {{
                    background: {color}22;
                    color: {color};
                    border: 1px solid {color}55;
                    border-radius: 6px;
                    padding: 7px;
                    font-weight: bold;
                }}
                QPushButton:hover {{ background: {color}44; }}
            """)
            sb.clicked.connect(lambda checked, r=rid: self._send_room(r))
            gl.addWidget(sb)

            grid.addWidget(grp, i // 3, i % 3)

        lay.addLayout(grid)
        lay.addStretch()

        # connection info box
        info = QGroupBox("Connection Info")
        il = QVBoxLayout(info)
        for k, v in [("Endpoint", AWS_ENDPOINT),
                     ("Publish Topic", TOPIC_PUB),
                     ("Subscribe Topic", TOPIC_SUB),
                     ("DynamoDB Table", DYNAMO_TABLE),
                     ("Region", DYNAMO_REGION)]:
            row = QHBoxLayout()
            kl = QLabel(f"{k}:")
            kl.setStyleSheet(f"color: {C['muted']}; min-width: 130px;")
            vl = QLabel(v)
            vl.setStyleSheet(f"color: {C['accent2']}; font-family: Consolas;")
            row.addWidget(kl); row.addWidget(vl); row.addStretch()
            il.addLayout(row)
        lay.addWidget(info)
        return tab

    # ── STATUS BAR ────────────────────────────────────────────────────────
    def _build_statusbar(self):
        sb = QStatusBar()
        self.setStatusBar(sb)
        sb.showMessage(f"  Endpoint: {AWS_ENDPOINT}  |  Table: {DYNAMO_TABLE}")
        self.msg_lbl = QLabel("Sent: 0  |  Received: 0")
        self.msg_lbl.setStyleSheet(f"color: {C['muted']}; margin-right: 16px;")
        sb.addPermanentWidget(self.msg_lbl)
        self.sent_count = 0
        self.recv_count = 0

    # ── ACTIONS ───────────────────────────────────────────────────────────
    def _send_room(self, room_id):
        temp = round(random.uniform(18.0, 45.0), 1)
        hum  = round(random.uniform(30.0, 95.0), 1)
        ts   = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        payload = {"device_id": room_id, "temperature": temp,
                   "humidity": hum, "timestamp": ts}

        # Always update UI immediately (gauges, trends, report)
        self._on_message(payload)

        ok = self.mqtt_client.publish(payload)
        if ok:
            self.sent_count += 1
            self._update_counter()
            self.statusBar().showMessage(
                f"  ↑ Sent to {room_id}: temp={temp}°C  hum={hum}%  @ {ts[-8:]} UTC", 4000)
        else:
            self.sent_count += 1
            self._update_counter()
            self.statusBar().showMessage(
                f"  ⚠ Local only (not connected): {room_id} temp={temp}°C  hum={hum}%", 4000)

    def _send_all_rooms(self):
        for rid in ROOM_IDS:
            self._send_room(rid)

    def _toggle_auto_all(self, checked):
        if checked:
            self.auto_timer.start(5000)
        else:
            self.auto_timer.stop()

    # ── CALLBACKS ─────────────────────────────────────────────────────────
    def _on_message(self, payload: dict):
        if "payload" in payload and isinstance(payload["payload"], dict):
            payload = payload["payload"]

        ts     = payload.get("timestamp", datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))
        temp   = to_float(payload.get("temperature"))
        hum    = to_float(payload.get("humidity"))
        dev_id = payload.get("device_id", "")

        self.recv_count += 1
        self._update_counter()

        # update room card
        if dev_id in self.room_cards and temp != "--" and hum != "--":
            self.room_cards[dev_id].update_data(temp, hum, ts)
            self.room_data[dev_id] = {"temp": temp, "hum": hum, "ts": ts}

            # update control tab labels
            tl = self.findChild(QLabel, f"ctrl_temp_{dev_id}")
            hl = self.findChild(QLabel, f"ctrl_hum_{dev_id}")
            if tl: tl.setText(f"Temp: {temp}°C")
            if hl: hl.setText(f"Hum: {hum}%")

            # update trend chart
            self.trend_chart.add_point(dev_id, temp, hum)

        # update report table
        self.report_table.add_live_row(payload, ts)

    def _on_status(self, state: str, msg: str):
        colors = {"connected": C["success"], "connecting": C["warning"],
                  "disconnected": C["danger"], "error": C["danger"]}
        icons  = {"connected": "●  Connected", "connecting": "◌  Connecting…",
                  "disconnected": "○  Disconnected", "error": "✗  Error"}
        color = colors.get(state, C["muted"])
        label = icons.get(state, state)
        self.conn_lbl.setText(label)
        self.conn_lbl.setStyleSheet(f"color: {color}; font-weight: bold;")
        self.statusBar().showMessage(f"  {msg}", 5000)

    def _update_clock(self):
        self.clock_lbl.setText(datetime.utcnow().strftime("%Y-%m-%d  %H:%M:%S  UTC"))

    def _update_counter(self):
        self.msg_lbl.setText(f"Sent: {self.sent_count}  |  Received: {self.recv_count}")

    def closeEvent(self, event):
        self.mqtt_client.disconnect_aws()
        event.accept()


# ════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    win = IndustrialDashboard()
    win.show()
    sys.exit(app.exec())