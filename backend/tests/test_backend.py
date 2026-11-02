import sys
import os
import io

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_pipeline():
    # 1. Health
    res = client.get("/health")
    assert res.status_code == 200
    print("✓ Health check passed")

    # 2. Create Dashboard
    res = client.post("/api/v1/dashboards", json={"title": "Test Sales Board", "description": "QA Pipeline"})
    assert res.status_code == 200
    dash_id = res.json()["id"]
    print(f"✓ Created dashboard: {dash_id}")

    # 3. Upload Sample CSV
    sample_csv = """order_id,date,customer_id,channel,amount,is_fraud
101,2024-01-15,c_1,Online,$150.00,0
102,2024-01-16,c_2,Store,$85.50,0
103,2024-02-10,c_1,Online,$450.00,1
104,2024-02-12,c_3,Store,$120.00,0
105,2024-03-01,c_2,Online,$220.00,0
"""
    files = {"file": ("orders.csv", io.BytesIO(sample_csv.encode("utf-8")), "text/csv")}
    res = client.post(f"/api/v1/dashboards/{dash_id}/upload", files=files)
    assert res.status_code == 200
    table_data = res.json()
    table_id = table_data["id"]
    assert table_data["row_count"] == 5
    # Verify amount was cleaned of '$'
    amount_col = [c for c in table_data["columns"] if c["name"] == "amount"][0]
    assert amount_col["semantic_type"] == "measure"
    print(f"✓ Uploaded CSV & profiled: {table_id} (5 rows, {len(table_data['columns'])} columns)")

    # 4. Python Sandbox Execution
    py_code = """
import polars as pl
print("Analyzing orders in Python Lab...")
df_monthly = df.group_by("channel").agg([
    pl.col("amount").sum().alias("total_spend"),
    pl.len().alias("order_count")
])
print("Group by complete:")
print(df_monthly)
"""
    res = client.post(f"/api/v1/dashboards/{dash_id}/sandbox/execute", json={"code": py_code})
    assert res.status_code == 200
    sandbox_res = res.json()
    assert sandbox_res["success"] is True
    assert "Analyzing orders in Python Lab..." in sandbox_res["stdout"]
    assert "df_monthly" in sandbox_res["detected_dataframes"]
    assert sandbox_res["table_preview"] is not None
    print(f"✓ Python sandbox executed successfully. Detected DFs: {sandbox_res['detected_dataframes']}")

    # 5. Save as Derived Table
    res = client.post(f"/api/v1/dashboards/{dash_id}/derived-tables", json={
        "table_name": "channel_summary",
        "dataframe_var": "df_monthly",
        "code": py_code
    })
    assert res.status_code == 200
    derived_tbl = res.json()
    assert derived_tbl["display_name"] == "channel_summary"
    assert derived_tbl["table_type"] == "derived_python"
    print(f"✓ Saved derived table: {derived_tbl['id']} ({derived_tbl['display_name']})")

    # 6. Query Engine Execution for visual card
    query_payload = {
        "table_id": derived_tbl["id"],
        "viz_type": "donut",
        "config": {
            "dimensions": [{"column": "channel"}],
            "measures": [{"column": "total_spend", "aggregation": "sum"}],
            "filters": []
        }
    }
    res = client.post(f"/api/v1/dashboards/{dash_id}/query", json=query_payload)
    assert res.status_code == 200
    q_res = res.json()
    assert q_res["viz_type"] == "donut"
    assert len(q_res["data"]) == 2  # Online and Store
    print(f"✓ Query engine returned shaped visual data: {q_res['data']}")

    # 7. Add Card to Dashboard
    card_payload = {
        "table_id": derived_tbl["id"],
        "viz_type": "donut",
        "title": "Channel Spend Breakdown",
        "config": query_payload["config"],
        "grid_layout": {"x": 0, "y": 0, "w": 6, "h": 4}
    }
    res = client.post(f"/api/v1/dashboards/{dash_id}/cards", json=card_payload)
    assert res.status_code == 200
    print("✓ Created visual card on dashboard canvas")

    # 8. Get Full Dashboard Detail
    res = client.get(f"/api/v1/dashboards/{dash_id}")
    assert res.status_code == 200
    dash_detail = res.json()
    assert len(dash_detail["tables"]) == 2  # raw + derived
    assert len(dash_detail["cards"]) == 1
    print("✓ Retrieved complete dashboard state with tables and cards")

    # 9. Clean up
    res = client.delete(f"/api/v1/dashboards/{dash_id}")
    assert res.status_code == 200
    print("✓ Cascaded delete dashboard and storage files")

if __name__ == "__main__":
    test_full_pipeline()
    print("All backend tests completed successfully!")
