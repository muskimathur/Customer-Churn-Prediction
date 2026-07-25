"""
Customer Churn Prediction — Flask backend
Serves a banking-themed dashboard and a JSON prediction endpoint
for the ANN model trained in customer_churn.ipynb.

Expects these two files in the SAME folder as this script
(produced by the notebook):
    - customer_churn.model.keras
    - scaler.pkl

Run with:
    python app.py
"""

import os
import pandas as pd
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "customer_churn.model.keras")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "scaler.pkl")

FEATURE_ORDER = [
    "CreditScore", "Gender", "Age", "Tenure", "Balance",
    "NumOfProducts", "HasCrCard", "IsActiveMember", "EstimatedSalary",
    "Geography_Germany", "Geography_Spain",
]

MODEL_METRICS = {
    "accuracy": "85.95%",
    "roc_auc": "0.7146",
    "model_type": "ANN",
    "train_size": "8,000",
}

_model = None
_scaler = None
_load_error = None


def get_artifacts():
    """Lazy-load the Keras model and scaler once, cache in memory."""
    global _model, _scaler, _load_error
    if _model is not None or _load_error is not None:
        return _model, _scaler, _load_error

    try:
        import tensorflow as tf
        import joblib
        if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
            _model = tf.keras.models.load_model(MODEL_PATH)
            _scaler = joblib.load(SCALER_PATH)
        else:
            _load_error = "missing_files"
    except Exception as e:  # noqa: BLE001
        _load_error = str(e)

    return _model, _scaler, _load_error


@app.route("/")
def index():
    return render_template("index.html", metrics=MODEL_METRICS)


@app.route("/predict", methods=["POST"])
def predict():
    model, scaler, error = get_artifacts()

    if error == "missing_files":
        return jsonify({
            "ok": False,
            "message": ("Model files not found. Place customer_churn.model.keras and "
                        "scaler.pkl (generated at the end of the notebook) next to app.py "
                        "to enable live predictions.")
        }), 200

    if error:
        return jsonify({"ok": False, "message": f"Could not load model: {error}"}), 200

    try:
        data = request.get_json(force=True)

        credit_score = float(data["credit_score"])
        geography = data["geography"]
        gender = data["gender"]
        age = float(data["age"])
        tenure = float(data["tenure"])
        balance = float(data["balance"])
        num_products = float(data["num_products"])
        has_cr_card = int(data["has_cr_card"])
        is_active = int(data["is_active"])
        estimated_salary = float(data["estimated_salary"])

        gender_val = 1 if gender == "Male" else 0
        geo_germany = 1 if geography == "Germany" else 0
        geo_spain = 1 if geography == "Spain" else 0

        row = pd.DataFrame([{
            "CreditScore": credit_score,
            "Gender": gender_val,
            "Age": age,
            "Tenure": tenure,
            "Balance": balance,
            "NumOfProducts": num_products,
            "HasCrCard": has_cr_card,
            "IsActiveMember": is_active,
            "EstimatedSalary": estimated_salary,
            "Geography_Germany": geo_germany,
            "Geography_Spain": geo_spain,
        }])[FEATURE_ORDER]

        scaled = scaler.transform(row)
        prob = float(model.predict(scaled, verbose=0)[0][0])
        pct = round(prob * 100, 1)

        if pct < 30:
            risk_level = "low"
        elif pct < 60:
            risk_level = "medium"
        else:
            risk_level = "high"

        return jsonify({
            "ok": True,
            "probability": pct,
            "will_churn": prob >= 0.5,
            "risk_level": risk_level,
        })

    except Exception as e:  # noqa: BLE001
        return jsonify({"ok": False, "message": f"Prediction error: {e}"}), 200



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
