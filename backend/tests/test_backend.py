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

def test_metrics_pipeline():
    res = client.post("/api/v1/dashboards", json={"title": "Metrics QA Dashboard"})
    assert res.status_code == 200
    dash_id = res.json()["id"]

    csv_body = "brand,amount,is_fraud\nVisa,100,0\nVisa,300,1\nMastercard,200,0\n"
    files = {"file": ("tx.csv", io.BytesIO(csv_body.encode("utf-8")), "text/csv")}
    res = client.post(f"/api/v1/dashboards/{dash_id}/upload", files=files)
    assert res.status_code == 200
    table_id = res.json()["id"]

    # Simple aggregation metric
    res = client.post(f"/api/v1/dashboards/{dash_id}/metrics", json={
        "table_id": table_id,
        "name": "Total Amount",
        "formula_type": "simple_agg",
        "definition": {"column": "amount", "aggregation": "sum"},
        "format_type": "currency",
    })
    assert res.status_code == 200
    total_metric = res.json()

    # Ratio metric
    res = client.post(f"/api/v1/dashboards/{dash_id}/metrics", json={
        "table_id": table_id,
        "name": "Fraud Rate",
        "formula_type": "ratio",
        "definition": {
            "numerator_column": "is_fraud", "numerator_agg": "sum",
            "denominator_column": "brand", "denominator_agg": "count",
            "multiplier": 100,
        },
        "format_type": "percentage",
    })
    assert res.status_code == 200
    ratio_metric = res.json()

    # Global scalar using saved metric
    res = client.post(f"/api/v1/dashboards/{dash_id}/query", json={
        "table_id": table_id,
        "viz_type": "smart_scalar",
        "config": {"dimensions": [], "measures": [{"metric_id": total_metric["id"]}], "filters": []},
    })
    assert res.status_code == 200
    scalar = res.json()["data"]
    assert scalar["title"] == "Total Amount"
    assert scalar["formatted_value"] == "$600.00"

    # Ratio metric grouped by dimension
    res = client.post(f"/api/v1/dashboards/{dash_id}/query", json={
        "table_id": table_id,
        "viz_type": "bar",
        "config": {
            "dimensions": [{"column": "brand"}],
            "measures": [{"metric_id": ratio_metric["id"]}],
            "filters": [],
        },
    })
    assert res.status_code == 200
    bar = res.json()["data"]
    rates = dict(zip(bar["dimensions"], bar["series"][0]["data"]))
    assert rates["Visa"] == 50.0
    assert rates["Mastercard"] == 0.0
    print("✓ Saved metrics compile correctly (simple aggregation + ratio grouped by dimension)")

    res = client.delete(f"/api/v1/dashboards/{dash_id}")
    assert res.status_code == 200
    print("✓ Cascaded delete metrics dashboard")


def test_modeling_pipeline():
    res = client.post("/api/v1/dashboards", json={"title": "Modeling QA"})
    assert res.status_code == 200
    dash_id = res.json()["id"]

    csv_body = "brand,amount,count\nVisa,100,2\nVisa,300,4\nMastercard,200,1\n"
    files = {"file": ("m.csv", io.BytesIO(csv_body.encode("utf-8")), "text/csv")}
    res = client.post(f"/api/v1/dashboards/{dash_id}/upload", files=files)
    assert res.status_code == 200
    table_id = res.json()["id"]

    # New calculated column
    res = client.post(
        f"/api/v1/dashboards/{dash_id}/tables/{table_id}/calculated-column",
        json={"name": "amount_x_count", "expression": "amount * count"},
    )
    assert res.status_code == 200
    assert "amount_x_count" in [c["name"] for c in res.json()["columns"]]

    res = client.post(
        f"/api/v1/dashboards/{dash_id}/tables/{table_id}/calculated-column",
        json={"name": "bad", "expression": "amount ** \"x\""},
    )
    assert res.status_code == 400
    print("✓ Calculated columns compile (and reject unsafe expressions)")

    # New aggregated table
    res = client.post(f"/api/v1/dashboards/{dash_id}/derived-tables/aggregate", json={
        "base_table_id": table_id,
        "display_name": "brand_totals",
        "dimensions": ["brand"],
        "measures": [{"column": "amount", "aggregation": "sum", "alias": "total_amount"}],
        "filters": [],
    })
    assert res.status_code == 200
    agg = res.json()
    assert agg["row_count"] == 2
    assert agg["table_type"] == "derived_model"
    print("✓ Aggregated derived table materialized")

    # Derived save survives a lost kernel by re-running the cell code
    client.post(f"/api/v1/dashboards/{dash_id}/notebook/restart")
    code = 'df_summary = df.group_by("brand").agg(pl.col("amount").sum().alias("total"))\ndf_summary'
    res = client.post(f"/api/v1/dashboards/{dash_id}/derived-tables", json={
        "table_name": "from_code", "dataframe_var": "df_summary", "code": code,
    })
    assert res.status_code == 200, res.text
    res = client.post(f"/api/v1/dashboards/{dash_id}/derived-tables", json={
        "table_name": "no_code", "dataframe_var": "df_summary",
    })
    assert res.status_code == 400
    assert "not found" in res.json()["detail"]
    print("✓ Derived table save handles lost kernel sessions with clear errors")

    client.delete(f"/api/v1/dashboards/{dash_id}")


def test_table_definitions_pipeline():
    res = client.post("/api/v1/dashboards", json={"title": "Table Definitions QA"})
    assert res.status_code == 200
    dash_id = res.json()["id"]

    # Empty helper table
    res = client.post(f"/api/v1/dashboards/{dash_id}/tables/empty", json={
        "display_name": "sort_order",
        "columns": [{"name": "label", "dtype": "string"}, {"name": "rank", "dtype": "integer"}],
        "role": "helper",
    })
    assert res.status_code == 200, res.text
    empty = res.json()
    assert empty["row_count"] == 0
    assert empty["role"] == "helper"
    assert empty["origin"] == "manual"
    assert [c["name"] for c in empty["columns"]] == ["label", "rank"]

    # Python table using pandas + numpy
    script = "import pandas as pd\nimport numpy as np\nresult = pd.DataFrame({'brand': ['Visa', 'Mastercard'], 'amount': np.array([120.5, 80.0])})"
    res = client.post(f"/api/v1/dashboards/{dash_id}/tables/python", json={
        "display_name": "py_brands", "script": script,
    })
    assert res.status_code == 200, res.text
    py = res.json()
    assert py["row_count"] == 2
    assert py["origin"] == "python_script"

    # Update script using the table's own snapshot, then refresh
    self_script = 'result = py_brands.with_columns((pl.col("amount") * 2).alias("double_amount"))'
    res = client.put(f"/api/v1/dashboards/{dash_id}/tables/{py['id']}/script", json={"script": self_script})
    assert res.status_code == 200, res.text
    assert "double_amount" in [c["name"] for c in res.json()["columns"]]

    res = client.post(f"/api/v1/dashboards/{dash_id}/tables/{py['id']}/refresh")
    assert res.status_code == 200
    assert res.json()["row_count"] == 2

    # Broken script is rejected and previous data survives
    res = client.put(f"/api/v1/dashboards/{dash_id}/tables/{py['id']}/script", json={"script": "result = 1 / 0"})
    assert res.status_code == 400
    assert "ZeroDivisionError" in res.json()["detail"]
    tables = client.get(f"/api/v1/dashboards/{dash_id}/tables").json()
    survivor = next(t for t in tables if t["id"] == py["id"])
    assert survivor["row_count"] == 2

    # Filling the empty table through a script converts it to a scripted table
    res = client.put(f"/api/v1/dashboards/{dash_id}/tables/{empty['id']}/script", json={
        "script": 'result = pl.DataFrame({"label": ["Low", "Medium", "High"], "rank": [1, 2, 3]})',
    })
    assert res.status_code == 200
    assert res.json()["row_count"] == 3
    assert res.json()["table_type"] == "python_script"

    # Validation
    res = client.post(f"/api/v1/dashboards/{dash_id}/tables/empty", json={
        "display_name": "bad", "columns": [{"name": "1x", "dtype": "string"}],
    })
    assert res.status_code == 400
    res = client.post(f"/api/v1/dashboards/{dash_id}/tables/python", json={
        "display_name": "noresult", "script": "x = 1",
    })
    assert res.status_code == 400

    # Model canvas layout persists
    res = client.put(f"/api/v1/dashboards/{dash_id}/model-layout", json=[
        {"table_id": empty["id"], "x": 4, "y": 2, "w": 7, "h": 9},
    ])
    assert res.status_code == 200, res.text
    tables = client.get(f"/api/v1/dashboards/{dash_id}/tables").json()
    moved = next(t for t in tables if t["id"] == empty["id"])
    assert (moved["pos_x"], moved["pos_y"], moved["pos_w"], moved["pos_h"]) == (4, 2, 7, 9)
    print("✓ Model canvas layout persists positions")

    print("✓ Empty/manual, Python-script, refresh, self-snapshot, and validation flows pass")

    client.delete(f"/api/v1/dashboards/{dash_id}")


def test_relationship_validation():
    res = client.post("/api/v1/dashboards", json={"title": "Relationships QA"})
    dash_id = res.json()["id"]

    a = client.post(
        f"/api/v1/dashboards/{dash_id}/upload",
        files={"file": ("a.csv", io.BytesIO(b"key,amount\n1,10\n2,20\n"), "text/csv")},
    ).json()["id"]
    b = client.post(
        f"/api/v1/dashboards/{dash_id}/upload",
        files={"file": ("b.csv", io.BytesIO(b"key,tier\n1,gold\n"), "text/csv")},
    ).json()["id"]

    def link(from_t, from_c, to_t, to_c):
        return client.post(f"/api/v1/dashboards/{dash_id}/relationships", json={
            "from_table_id": from_t, "from_column": from_c,
            "to_table_id": to_t, "to_column": to_c,
        })

    assert link(a, "key", a, "amount").status_code == 400
    assert link(a, "missing", b, "key").status_code == 400
    assert link(a, "key", b, "missing").status_code == 400
    res = link(a, "key", b, "key")
    assert res.status_code == 200, res.text
    res = link(a, "key", b, "key")
    assert res.status_code == 400
    assert "already exists" in res.json()["detail"]
    print("✓ Relationship creation validates self-links, columns, and duplicates")

    client.delete(f"/api/v1/dashboards/{dash_id}")


def test_table_rows_view():
    res = client.post("/api/v1/dashboards", json={"title": "Rows QA"})
    dash_id = res.json()["id"]

    csv_body = (
        "brand,amount\n"
        "Visa,100\nVisa,300\nMastercard,200\nAmex,50\nDiscover,400\n"
    )
    res = client.post(
        f"/api/v1/dashboards/{dash_id}/upload",
        files={"file": ("rows.csv", io.BytesIO(csv_body.encode()), "text/csv")},
    )
    table_id = res.json()["id"]

    res = client.get(f"/api/v1/dashboards/{dash_id}/tables/{table_id}/rows?page=1&page_size=2")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_count"] == 5
    assert body["unfiltered_count"] == 5
    assert body["total_pages"] == 3
    assert len(body["rows"]) == 2

    res = client.get(f"/api/v1/dashboards/{dash_id}/tables/{table_id}/rows?page=3&page_size=2")
    assert len(res.json()["rows"]) == 1

    res = client.get(f"/api/v1/dashboards/{dash_id}/tables/{table_id}/rows?search=visa")
    body = res.json()
    assert body["total_count"] == 2
    assert all(r["brand"] == "Visa" for r in body["rows"])

    res = client.get(
        f"/api/v1/dashboards/{dash_id}/tables/{table_id}/rows?sort_column=amount&sort_dir=desc&page_size=1"
    )
    body = res.json()
    assert body["rows"][0]["amount"] == 400

    res = client.get(f"/api/v1/dashboards/{dash_id}/tables/{table_id}/rows?sort_column=nope")
    assert res.status_code == 400

    # Column filters (Excel-style value selection)
    res = client.get(
        f"/api/v1/dashboards/{dash_id}/tables/{table_id}/rows",
        params={"filters": '[{"column":"brand","values":["Visa","Amex"]}]'},
    )
    body = res.json()
    assert body["total_count"] == 3
    assert set(r["brand"] for r in body["rows"]) == {"Visa", "Amex"}

    res = client.get(
        f"/api/v1/dashboards/{dash_id}/tables/{table_id}/rows?filters=" + "%5Bnot-json"
    )
    assert res.status_code == 400
    res = client.get(
        f"/api/v1/dashboards/{dash_id}/tables/{table_id}/rows",
        params={"filters": '[{"column":"nope","values":["x"]}]'},
    )
    assert res.status_code == 400
    print("✓ Table row browser paginates, searches, sorts, filters, and validates input")

    client.delete(f"/api/v1/dashboards/{dash_id}")

if __name__ == "__main__":
    test_full_pipeline()
    test_metrics_pipeline()
    test_modeling_pipeline()
    test_table_definitions_pipeline()
    test_relationship_validation()
    test_table_rows_view()
    print("All backend tests completed successfully!")
