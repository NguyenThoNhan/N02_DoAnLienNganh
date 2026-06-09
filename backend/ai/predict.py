"""
Dự đoán từ stdin JSON -> stdout JSON.
"""
import json
import sys
from pathlib import Path

import joblib
import numpy as np

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "heart_rf.joblib"
META_PATH = ROOT / "models" / "meta.json"

FEATURES = [
    "age", "sex", "cp", "trestbps", "chol", "fbs",
    "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"
]


def main():
    payload = json.loads(sys.stdin.read() or "{}")
    if not MODEL_PATH.exists():
        print(json.dumps({"ok": False, "error": "Chưa huấn luyện mô hình"}))
        return

    model = joblib.load(MODEL_PATH)
    meta = json.loads(META_PATH.read_text(encoding="utf-8")) if META_PATH.exists() else {}

    row = []
    for f in FEATURES:
        row.append(float(payload.get(f, meta.get("feature_means", {}).get(f, 0))))

    X = np.array([row])
    pred = int(model.predict(X)[0])
    proba = model.predict_proba(X)[0]
    risk_score = round(float(proba[1] if len(proba) > 1 else proba[0]), 4)

    out = {
        "ok": True,
        "risk_label": pred,
        "risk_score": risk_score,
        "risk_level": "high" if risk_score >= 0.55 else ("medium" if risk_score >= 0.35 else "low"),
        "features_used": dict(zip(FEATURES, row)),
    }
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
