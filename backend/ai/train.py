"""
Huấn luyện Random Forest trên heart.csv (demo đồ án TechCare).
Chạy: python backend/ai/train.py
"""
import json
import os
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "heart.csv"
MODEL_DIR = ROOT / "models"
MODEL_PATH = MODEL_DIR / "heart_rf.joblib"
META_PATH = MODEL_DIR / "meta.json"

FEATURES = [
    "age", "sex", "cp", "trestbps", "chol", "fbs",
    "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"
]


def main():
    if not DATA.exists():
        raise FileNotFoundError(f"Không tìm thấy {DATA}")

    df = pd.read_csv(DATA)
    df = df.dropna()
    X = df[FEATURES]
    y = df["target"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = RandomForestClassifier(
        n_estimators=80, max_depth=8, random_state=42, n_jobs=-1
    )
    model.fit(X_train, y_train)
    acc = accuracy_score(y_test, model.predict(X_test))

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    meta = {
        "model": "RandomForestClassifier",
        "dataset": "heart.csv",
        "samples": int(len(df)),
        "accuracy": round(float(acc), 4),
        "features": FEATURES,
        "target_meaning": "0=bình thường, 1=nguy cơ bệnh tim mạch",
        "feature_means": {k: round(float(df[k].mean()), 3) for k in FEATURES},
    }
    META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({"ok": True, "accuracy": meta["accuracy"], "samples": meta["samples"]}))


if __name__ == "__main__":
    main()
