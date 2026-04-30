from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn

app = FastAPI(title="Vitruvian Clinical ML Server", version="2.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SepsisInput(BaseModel):
    hr: Optional[float] = 75.0      # Heart Rate (bpm)
    rr: Optional[float] = 16.0      # Respiratory Rate (breaths/min)
    temp: Optional[float] = 37.0    # Temperature (°C)
    sbp: Optional[float] = 115.0    # Systolic Blood Pressure (mmHg)
    spo2: Optional[float] = 98.0    # Oxygen Saturation (%)
    hour: Optional[int] = None
    patientId: Optional[str] = None

def compute_sepsis_risk(hr: float, rr: float, temp: float, sbp: float, spo2: float) -> Dict[str, Any]:
    # Clinical criteria checks (SIRS + qSOFA + Hypoxemia)
    sirs_hr = hr > 90
    sirs_rr = rr > 20
    sirs_temp = temp > 38.0 or temp < 36.0
    qsofa_sbp = sbp <= 100
    qsofa_rr = rr >= 22
    hypoxemia = spo2 < 95
    severe_hypoxemia = spo2 < 90
    
    # Feature assessments with physiological thresholds
    features = {
        "HR": {
            "name": "Heart Rate",
            "value": round(hr, 1),
            "unit": "bpm",
            "normal_range": "60 - 100 bpm",
            "status": "alert" if hr > 100 or hr < 50 else ("warning" if sirs_hr else "normal"),
            "criterion": "SIRS Tachycardia (>90 bpm)" if sirs_hr else "Within normal limits"
        },
        "RR": {
            "name": "Respiratory Rate",
            "value": round(rr, 1),
            "unit": "breaths/min",
            "normal_range": "12 - 20 breaths/min",
            "status": "alert" if qsofa_rr else ("warning" if sirs_rr else "normal"),
            "criterion": "qSOFA Tachypnea (≥22 /min)" if qsofa_rr else ("SIRS Tachypnea (>20 /min)" if sirs_rr else "Within normal limits")
        },
        "Temp": {
            "name": "Body Temperature",
            "value": round(temp, 1),
            "unit": "°C",
            "normal_range": "36.1 - 37.2 °C",
            "status": "alert" if (temp > 38.5 or temp < 35.5) else ("warning" if sirs_temp else "normal"),
            "criterion": "Fever (>38.0°C)" if temp > 38.0 else ("Hypothermia (<36.0°C)" if temp < 36.0 else "Within normal limits")
        },
        "SBP": {
            "name": "Systolic Blood Pressure",
            "value": round(sbp, 1),
            "unit": "mmHg",
            "normal_range": "90 - 120 mmHg",
            "status": "alert" if sbp < 90 else ("warning" if qsofa_sbp else "normal"),
            "criterion": "qSOFA Hypotension (≤100 mmHg)" if qsofa_sbp else "Adequate perfusion"
        },
        "SpO2": {
            "name": "Oxygen Saturation",
            "value": round(spo2, 1),
            "unit": "%",
            "normal_range": "95 - 100 %",
            "status": "alert" if severe_hypoxemia else ("warning" if hypoxemia else "normal"),
            "criterion": "Severe Hypoxemia (<90%)" if severe_hypoxemia else ("Hypoxemia (<95%)" if hypoxemia else "Normal saturation")
        }
    }
    
    # Calculate continuous risk score
    risk_score = 0.05
    abnormal_vitals = []
    
    if sirs_hr:
        risk_score += 0.22
        abnormal_vitals.append(f"Elevated HR ({hr:.0f} bpm)")
    if qsofa_rr:
        risk_score += 0.25
        abnormal_vitals.append(f"High RR ({rr:.0f} /min)")
    elif sirs_rr:
        risk_score += 0.18
        abnormal_vitals.append(f"Elevated RR ({rr:.0f} /min)")
    if sirs_temp:
        risk_score += 0.20
        abnormal_vitals.append(f"Abnormal Temp ({temp:.1f} °C)")
    if sbp < 90:
        risk_score += 0.25
        abnormal_vitals.append(f"Hypotension SBP ({sbp:.0f} mmHg)")
    elif qsofa_sbp:
        risk_score += 0.18
        abnormal_vitals.append(f"Borderline Low SBP ({sbp:.0f} mmHg)")
    if severe_hypoxemia:
        risk_score += 0.20
        abnormal_vitals.append(f"Severe Hypoxemia SpO2 ({spo2:.0f}%)")
    elif hypoxemia:
        risk_score += 0.12
        abnormal_vitals.append(f"Low SpO2 ({spo2:.0f}%)")
        
    risk_score = min(0.98, max(0.02, risk_score))
    
    if risk_score >= 0.50 or len(abnormal_vitals) >= 2:
        prediction = "High Risk"
        assessment = "caution"
        confidence = round(0.78 + (risk_score * 0.18), 2)
        message = f"High probability of sepsis detected ({int(risk_score * 100)}% risk). {len(abnormal_vitals)} abnormal core vitals: {', '.join(abnormal_vitals)}."
    elif risk_score >= 0.25 or len(abnormal_vitals) == 1:
        prediction = "Moderate Risk"
        assessment = "warning"
        confidence = round(0.70 + (risk_score * 0.15), 2)
        message = f"Moderate sepsis risk ({int(risk_score * 100)}%). Contributing vital: {', '.join(abnormal_vitals)}."
    else:
        prediction = "Low Risk"
        assessment = "normal"
        confidence = round(0.88 + ((1.0 - risk_score) * 0.08), 2)
        message = f"Normal vital status ({int(risk_score * 100)}% risk). All 5 core vitals are within baseline limits."
        
    return {
        "status": "success",
        "model_name": "Sepsis Risk Predictor (5-Vital)",
        "prediction": prediction,
        "assessment": assessment,
        "risk_score": round(risk_score, 2),
        "confidence": confidence,
        "message": message,
        "abnormal_count": len(abnormal_vitals),
        "features": features
    }

@app.post("/predict-sepsis")
async def predict_sepsis(payload: SepsisInput):
    return compute_sepsis_risk(
        hr=payload.hr if payload.hr is not None else 75.0,
        rr=payload.rr if payload.rr is not None else 16.0,
        temp=payload.temp if payload.temp is not None else 37.0,
        sbp=payload.sbp if payload.sbp is not None else 115.0,
        spo2=payload.spo2 if payload.spo2 is not None else 98.0
    )

@app.post("/analyze-fhir")
async def analyze_fhir(payload: Dict[str, Any]):
    # Backwards compatibility: extract hr or direct vitals
    if "valueQuantity" in payload:
        hr = float(payload.get("valueQuantity", {}).get("value", 75))
        return compute_sepsis_risk(hr=hr, rr=16.0, temp=37.0, sbp=115.0, spo2=98.0)
    
    hr = float(payload.get("hr", 75.0))
    rr = float(payload.get("rr", 16.0))
    temp = float(payload.get("temp", 37.0))
    sbp = float(payload.get("sbp", 115.0))
    spo2 = float(payload.get("spo2", 98.0))
    return compute_sepsis_risk(hr=hr, rr=rr, temp=temp, sbp=sbp, spo2=spo2)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)