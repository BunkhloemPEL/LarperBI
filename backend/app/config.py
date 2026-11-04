import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "larper.db")
DASHBOARDS_DATA_DIR = os.path.join(DATA_DIR, "dashboards")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(DASHBOARDS_DATA_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
