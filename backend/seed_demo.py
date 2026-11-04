import requests
import io
import os

API_URL = "http://127.0.0.1:8001/api/v1"

def seed():
    print("Creating demo dashboard in LarperBI...")
    res = requests.post(f"{API_URL}/dashboards", json={
        "title": "FinTech Card Portfolio & Risk Model",
        "description": "Demonstration dashboard with raw card uploads, Python EDA lab, and Metabase visuals."
    })
    dash_id = res.json()["id"]
    print(f"Created dashboard: {dash_id}")

    # Upload cards_data.csv
    archive_cards = "archive/cards_data.csv"
    if os.path.exists(archive_cards):
        with open(archive_cards, "rb") as f:
            files = {"file": ("cards_portfolio.csv", f, "text/csv")}
            inspection = requests.post(
                f"{API_URL}/dashboards/{dash_id}/upload/inspect", files=files
            ).json()
            up_res = requests.post(
                f"{API_URL}/dashboards/{dash_id}/upload/commit",
                json={
                    "upload_id": inspection["upload_id"],
                    "sheets": [sheet["name"] for sheet in inspection["sheets"]],
                },
            )
            uploaded = up_res.json()["tables"][0]
            table_id = uploaded["id"]
            print(f"Uploaded cards table: {table_id} ({uploaded['row_count']} rows)")

        # Create Card 1: Donut chart of Card Brands
        requests.post(f"{API_URL}/dashboards/{dash_id}/cards", json={
            "table_id": table_id,
            "viz_type": "donut",
            "title": "Card Network Distribution",
            "config": {
                "dimensions": [{"column": "card_brand"}],
                "measures": [{"column": "credit_limit", "aggregation": "count"}],
                "filters": []
            },
            "grid_layout": {"x": 0, "y": 0, "w": 6, "h": 4}
        })

        # Create Card 2: Row Chart of Card Types
        requests.post(f"{API_URL}/dashboards/{dash_id}/cards", json={
            "table_id": table_id,
            "viz_type": "row",
            "title": "Card Volume by Product Type",
            "config": {
                "dimensions": [{"column": "card_type"}],
                "measures": [{"column": "credit_limit", "aggregation": "count"}],
                "filters": []
            },
            "grid_layout": {"x": 6, "y": 0, "w": 6, "h": 4}
        })

        # Create Card 3: SmartScalar of Total Credit Limit
        requests.post(f"{API_URL}/dashboards/{dash_id}/cards", json={
            "table_id": table_id,
            "viz_type": "smart_scalar",
            "title": "Total Credit Lines Extended",
            "config": {
                "dimensions": [],
                "measures": [{"column": "credit_limit", "aggregation": "sum"}],
                "filters": []
            },
            "grid_layout": {"x": 0, "y": 4, "w": 4, "h": 4}
        })
        print("Created 3 initial visual cards.")

if __name__ == "__main__":
    seed()
