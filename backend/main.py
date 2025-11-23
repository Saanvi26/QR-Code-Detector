from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import re
from urllib.parse import urlparse
import pandas as pd

app = FastAPI()

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model
model = joblib.load("model/random_forest_model.pkl")

# Input structure from frontend
class URLInput(BaseModel):
    url: str

# ===== FEATURE EXTRACTION FUNCTION (same as your notebook) =====
def extract_features(url):
    features = {}
    parsed = urlparse(str(url))
    domain = parsed.netloc
    path = parsed.path
    query = parsed.query

    features['url_length'] = len(url)
    features['num_dots'] = url.count('.')
    features['num_hyphens'] = url.count('-')
    features['num_digits'] = sum(c.isdigit() for c in url)
    features['num_special_chars'] = sum(c in "?=&%" for c in url)
    features['has_https'] = 1 if url.lower().startswith("https") else 0
    features['num_subdirs'] = path.count('/')
    features['num_params'] = query.count('=') if query else 0
    features['has_ip_address'] = 1 if re.search(r'\b\d{1,3}(?:\.\d{1,3}){3}\b', url) else 0

    # TLD length
    tld_match = re.search(r'\.([a-z]+)(\/|$)', domain)
    features['tld_length'] = len(tld_match.group(1)) if tld_match else 0

    # Suspicious words
    suspicious_words = ['login', 'secure', 'verify', 'account', 'update', 'free', 'bonus', 'bank','spam']
    features['contains_suspicious_words'] = 1 if any(word in url.lower() for word in suspicious_words) else 0

    return pd.Series(features)

# ================== PREDICTION API ==================
@app.post("/predict")
def predict(input_data: URLInput):
    url = input_data.url

    # Extract numeric features
    features_series = extract_features(url)

    # Convert to DataFrame (model expects 2D input)
    features_df = pd.DataFrame([features_series])

    # Predict
    prediction = model.predict(features_df)[0]

    return {
        "url": url,
        "prediction": int(prediction),    # 1 = safe, 0 = malicious
        "message": "Malicious URL" if prediction == 0 else "Safe URL"
    }
