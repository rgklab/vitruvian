from flask import Flask, request, jsonify,send_file, make_response
from flask_cors import CORS
import pandas as pd
import json,io,os
from utils.chat import handle_chat
from utils.medical_metrics import calculate_health_score,get_patient_normal_ranges
from utils.colors import get_color_for_health_score,get_no_data_color
from utils.chat import handle_chat
import globals
from utils.conversions import fhir2jsoncsv, process_patient_folder_eicu

#api protocol imports
# from fastapi import FastAPI
# from pydantic import BaseModel

FHIR_MAPPING = {
    # Keywords -> (Clean Name, Organ)
    'heart rate': ('HeartRate', 'heart'),
    'heartrate': ('HeartRate', 'heart'),
    'pulse': ('HeartRate', 'heart'),
    'systolic blood pressure': ('SystolicBloodPressure', 'heart'),
    'diastolic blood pressure': ('DiastolicBloodPressure', 'heart'),
    'mean blood pressure': ('MeanBloodPressure', 'heart'),
    'blood pressure': ('MeanBloodPressure', 'heart'),
    'respiratory rate': ('RespiratoryRate', 'lung'),
    'respiratoryrate': ('RespiratoryRate', 'lung'),
    'body temperature': ('Temperature', 'general'),
    'temperature': ('Temperature', 'general'),
    'oxygen saturation': ('SpO2', 'lung'),
    'spo2': ('SpO2', 'lung'),
    'creatinine': ('Creatinine', 'kidney'),
    'blood urea nitrogen': ('BloodUreaNitrogen', 'kidney'),
    'urea nitrogen': ('BloodUreaNitrogen', 'kidney'),
    'bun': ('BloodUreaNitrogen', 'kidney'),
    'glucose': ('Glucose', 'general'),
    'alanine aminotransferase': ('ALT', 'liver'),
    'alt': ('ALT', 'liver'),
    'aspartate aminotransferase': ('AST', 'liver'),
    'ast': ('AST', 'liver'),
    'bilirubin': ('Bilirubin', 'liver'),
    'albumin': ('Albumin', 'liver'),
    'alkaline phosphatase': ('ALP', 'liver'),
    'alp': ('ALP', 'liver'),
    'hemoglobin': ('Hemoglobin', 'general'),
    'hematocrit': ('hematocrit', 'general'),
    'leukocytes': ('WBC', 'general'),
    'white blood cell': ('WBC', 'general'),
    'wbc': ('WBC', 'general'),
    'erythrocyte': ('RBC', 'general'),
    'rbc': ('RBC', 'general'),
    'platelet': ('Platelets', 'general'),
    'platelets': ('Platelets', 'general'),
    'sodium': ('Sodium', 'general'),
    'potassium': ('Potassium', 'general'),
    'chloride': ('Chloride', 'general'),
    'calcium': ('Calcium', 'general'),
    'carbon dioxide': ('Bicarbonate', 'general'),
    'bicarbonate': ('Bicarbonate', 'general'),
    'body height': ('Height', 'general'),
    'body weight': ('Weight', 'general'),
    'body mass index': ('BMI', 'general'),
    'pain severity': ('PainSeverity', 'general'),
    'tobacco smoking status': ('SmokingStatus', 'general'),
    'albumin [mass/volume]': ('Albumin', 'liver'),
    'bilirubin.total': ('Bilirubin', 'liver'),
    'hemoglobin a1c': ('hba1c', 'general'),
    'erythrocytes': ('RBC', 'general'),
    'hemoglobin [mass/volume]': ('Hemoglobin', 'general'),
    'gcs': ('GCS', 'neurological'),
    'glasgow coma scale': ('GCS', 'neurological'),
    'sedation': ('Sedation', 'neurological'),
    'analgesia': ('Analgesia', 'neurological'),
    'icdsc': ('ICDSC', 'neurological'),
    'sas': ('SAS', 'neurological'),
    'antiepileptics': ('Antiepileptics', 'neurological'),
    'antipsychotics': ('Antipsychotics', 'neurological'),
    'airway pressure': ('AirwayPressure', 'lung'),
    'fio2': ('FiO2', 'lung'),
    'minute ventilation': ('MinuteVentilation', 'lung'),
    'peep': ('PEEP', 'lung'),
    'tidal volume': ('TidalVolume', 'lung'),
    'ventilation': ('Ventilation', 'lung'),
    'paco2': ('PaCO2', 'lung'),
    'pao2': ('PaO2', 'lung'),
    'ph': ('ph', 'lung'),
    'blood ph': ('ph', 'lung'),
    'creatinine kinase': ('CreatinineKinase', 'general'),
    'lactate': ('Lactate', 'general'),
    'magnesium': ('Magnesium', 'general'),
    'phosphate': ('Phosphate', 'general'),
    'inr': ('INR', 'liver'),
    'troponin': ('Troponin', 'heart'),
    'antiarrhythmics': ('Antiarrhythmics', 'heart'),
    'ejection fraction': ('EjectionFraction', 'heart'),
    'urine output': ('UrineOutput', 'kidney'),
    'diuretics': ('Diuretics', 'kidney'),
}
METRIC_MAPPING = {
    # Vital Signs
    "8867-4": {"name": "heart_rate", "panel": "Vital Signs"},
    "9279-1": {"name": "respiratory_rate", "panel": "Vital Signs"},
    "2708-6": {"name": "spo2", "panel": "Vital Signs"},
    "8480-6": {"name": "systolic_blood_pressure", "panel": "Vital Signs"},
    "8462-4": {"name": "diastolic_blood_pressure", "panel": "Vital Signs"},
    
    # Found in file but not in specific user lists (Additional)
    "72514-3": {"name": "pain_severity", "panel": "Assessments"},
    "76504-0": {"name": "hark_total_score", "panel": "Social Screening"},
    "70274-6": {"name": "gad7_score", "panel": "Mental Health"},
    "39156-5": {"name": "bmi", "panel": "Body Metrics"}
}
app = Flask(__name__)
CORS(app)
# preprocessing code - csv
def get_organ_to_metrics(df):
    """
    Given a DataFrame containing 'organ' and 'metric_name' columns,
    returns a dictionary {organ:[metrics]}
    """
    if 'organ' not in df.columns or 'metric_name' not in df.columns:
        raise ValueError("DataFrame must contain 'organ' and 'metric_name' columns.")

    return (
        df.groupby('organ')['metric_name']
        .unique()
        .apply(list)
        .to_dict()
    )

def group_by_metric(df):
    """
    Given a DataFrame containing 'metric_name' columns,
    returns a dictionary {metric_name:[metric data]}
    """
    if 'metric_name' not in df.columns:
        raise ValueError("DataFrame must contain 'metric_name' columns.")

    return {
        metric: group.to_dict(orient='records')
        for metric, group in df.groupby('metric_name')
    }

def find_max_hour(df):
    """return max of time"""
    max_time = df['time'].max()
    return int(max_time)


def get_lab_panel_mapping(df):
    """
    Categorize metrics (from the 'metric_name' column) into clinical lab panels.
    Always include all categories, but only include metrics that actually exist in df.
    """

    # Ensure we have the expected column
    if "metric_name" not in df.columns:
        raise ValueError("Expected column 'metric_name' not found in DataFrame.")

    # Normalize metric names for matching
    metric_names = df["metric_name"].dropna().unique()
    lower_to_original = {m.lower().strip(): m for m in metric_names}

    # Define standard lab panel groupings
    panels = {
        "Vital Signs": [
            "heartrate", "heart_rate", "heart rate", "pulse", "respiratoryrate", "respiratory_rate", "respiratory rate", "spo2", "temperature", "temp", "bloodpressure", "blood_pressure", "blood pressure", "systolic", "diastolic", "sbp", "dbp", "meanbloodpressure"
        ],
        "Blood Test": [
            "wbc", "rbc", "hemoglobin", "hematocrit", "platelet", "platelets", "mcv", "mch", "mchc", "rdw"
        ],
        "Basic Metabolic Panel": [
            "glucose", "sodium", "potassium", "chloride", "co2", "bicarbonate", "calcium"
        ],
        "Kidney Function Panel": [
            "creatinine", "bun", "bloodureanitrogen", "urea", "uric_acid", "egfr", "albumin_creatinine_ratio", "urineoutput", "diuretics"
        ],
        "Liver Function Panel": [
            "alt", "ast", "alkaline_phosphatase", "alp", "bilirubin", "albumin", "total_protein", "gpt", "got", "inr"
        ],
        "Electrolytes": [
            "sodium", "potassium", "chloride", "magnesium", "calcium", "phosphate", "phosphorus"
        ],
        "Blood Gases": [
            "ph", "pco2", "po2", "pao2", "paco2", "hco3", "base_excess", "oxygen_saturation", "lactate", "fio2"
        ],
        "Cardiac Markers": [
            "troponin", "ck_mb", "ckmb", "bnp", "nt_pro_bnp", "myoglobin", "ejectionfraction", "antiarrhythmics", "meanbloodpressure", "diastolicbloodpressure"
        ],
        "Neurological": [
            "gcs", "sedation", "analgesia", "icdsc", "sas"
        ]
    }

    # Initialize output with all panels, even if empty
    panel_mapping = {panel: [] for panel in panels}
    panel_mapping["Other"] = []

    # Assign each metric_name to a matching panel
    for lower_name, original_name in lower_to_original.items():
        matched = False
        for panel, keywords in panels.items():
            if any(keyword in lower_name for keyword in keywords):
                panel_mapping[panel].append(original_name)
                matched = True
                break
        if not matched:
            panel_mapping["Other"].append(original_name)

    return panel_mapping

def calculate_all_organ_health_scores(df):
    """
    Compute health scores for all organs in the provided DataFrame.

    Args:
        df (pd.DataFrame): A DataFrame containing columns:
            ['organ', 'metric_name', 'metric_value', ...]
    
    Returns:
        dict: { organ_name: health_score }
    """
    if df.empty:
        return {}

    organ_scores = {}

    # Group by organ name and calculate each organ's score
    for organ_name, organ_data in df.groupby('organ'):
        try:
            hs = calculate_health_score(organ_data)
        except Exception as e:
            print(f"Error calculating health score for {organ_name}: {e}")
            hs = None
        organ_scores[organ_name] = hs

    return organ_scores

def get_organ_colors_over_time(df):
    """
    Compute organ colors for each hour, sorted by time.

    Returns:
        dict: {
            hour_1: { organ_name: [r,g,b], ... },
            hour_2: { organ_name: [r,g,b], ... },
            ...
        }
    """
    result = {}
    # Ensure hours are sorted numerically
    hours = sorted(df['time'].dropna().unique())

    for hour in hours:
        hour_df = df[df['time'] == hour]
        organ_colors = {}
        
        for organ in hour_df['organ'].unique():
            organ_data = hour_df[hour_df['organ'] == organ]
            hs = calculate_health_score(organ_data)
            if hs is not None:
                color = get_color_for_health_score(hs)
                if color is not None:
                    organ_colors[organ] = color
        
        result[int(hour)] = organ_colors

    return result

# chatbot - send and receive 
@app.route('/chat', methods=['POST'])
def chat():
    return handle_chat()

# frontend communication-upload
@app.route('/upload', methods=['POST'])
def upload_files():
# Initialize defaults so they always exist
    df = pd.DataFrame()
    json_data = {"patients": [], "metrics": []} 

    # --- 1. FHIR FOLDER UPLOAD PATH ---
    if 'fhir_files' in request.files or 'to_fhir' in request.files:
        patient_list = []
        metrics_list = []
        merged_entries = []
        if 'fhir_files' in request.files:
            fhir_files = request.files.getlist('fhir_files')
            for file in fhir_files:
                try:
                    content = file.read()
                    if not content: continue
                    data = json.loads(content)
                    if isinstance(data, dict):
                        if data.get('resourceType') == 'Bundle':
                            merged_entries.extend(data.get('entry', []))
                        else:
                            merged_entries.append({"resource": data})
                    if 'to_fhir' in request.files:
                        data=process_patient_folder_eicu(file)
                    fhir2jsoncsv(data,metrics_list,patient_list,FHIR_MAPPING)
                except Exception as e:
                    return jsonify({'error': f'FHIR parsing error: {str(e)}'}), 400
            globals.latest_fhir_bundle = {
                "resourceType": "Bundle",
                "type": "collection",
                "entry": merged_entries
            }
        if 'to_fhir' in request.files:
            files = request.files.getlist('to_fhir')
            fhir_bundle = process_patient_folder_eicu(files)
            fhir2jsoncsv(fhir_bundle, metrics_list, patient_list, FHIR_MAPPING)
            globals.latest_fhir_bundle = fhir_bundle
        # Create DataFrame and populate json_data
        df = pd.DataFrame(metrics_list)
        json_data = {"patients": patient_list, "metrics": metrics_list}

        # Apply the 'time' to integer conversion here (from the previous step)
        if not df.empty and 'time' in df.columns:
            df['time_dt'] = pd.to_datetime(df['time'], errors='coerce')
            df = df.sort_values(by=['patient_id', 'time_dt'])
            if df['time_dt'].notnull().all():
                df['time'] = df.groupby('patient_id')['time_dt'].rank(method='dense').astype(int)
            else:
                df['time'] = df.groupby('patient_id').cumcount() + 1
            df['hour'] = df['time']
        metrics_list_processed = df.to_dict(orient='records') if not df.empty else []
        legacy_json_format = {}
        for p in patient_list:
            #print(p)
            pid = str(p.get('id', '')).split('/')[-1].split(':')[-1].strip()
            legacy_json_format[pid] = {
                "name": f"{p['first_name']} {p['last_name']}".strip() or "Unnamed Patient",
                "gender": p.get('gender', 'unknown'),
                "birthDate": p.get('birthDate', 'N/A'),
                "metrics": [m for m in metrics_list_processed if str(m.get('patient_id', '')).split('/')[-1].split(':')[-1].strip() == pid]
            }
        # 2. Assign this to json_data so the Frontend is happy
        json_data = legacy_json_format
        
    # --- 2. STANDARD CSV/JSON UPLOAD PATH ---
    elif 'csv_file' in request.files and 'json_file' in request.files:
        try:
            df = pd.read_csv(request.files['csv_file'])
            json_data = json.load(request.files['json_file'])
            
            # Generate a compliant fallback FHIR bundle so download is immediately active
            import uuid
            patient_id = "patient-alpha"
            patient_resource = {
                "resourceType": "Patient",
                "id": patient_id,
                "name": [{"text": json_data.get("name", "Alpha Smith")}],
                "gender": json_data.get("gender", "unknown"),
                "extension": [
                    {
                        "url": "http://hl7.org/fhir/StructureDefinition/patient-age",
                        "valueInteger": int(json_data.get("age")) if json_data.get("age") else None
                    }
                ]
            }
            entry_list = [{"resource": patient_resource}]
            for _, row in df.iterrows():
                obs = {
                    "resourceType": "Observation",
                    "id": str(uuid.uuid4()),
                    "status": "final",
                    "code": {"text": str(row.get("metric_name"))},
                    "subject": {"reference": f"Patient/{patient_id}"},
                    "valueQuantity": {
                        "value": float(row.get("metric_value")),
                        "unit": str(row.get("unit", ""))
                    },
                    "effectiveDateTime": str(row.get("time"))
                }
                entry_list.append({"resource": obs})
            globals.latest_fhir_bundle = {
                "resourceType": "Bundle",
                "type": "collection",
                "entry": entry_list
            }
        except Exception as e:
            return jsonify({'error': f'File parsing error: {str(e)}'}), 400
    
    # Check if we actually got data
    if df.empty:
        return jsonify({'error': 'No valid data found to process.'}), 400
    try:
        csv_by_metric=group_by_metric(df)
        organ_to_metrics=get_organ_to_metrics(df)
        organ_colors=get_organ_colors_over_time(df)
        common_metric_mapping=get_lab_panel_mapping(df)
        normalRanges=get_patient_normal_ranges(df)
        if not normalRanges:
            # print("normalRanges",normalRanges)
        # Provide a 'safe' structure if the FHIR data didn't trigger your logic
        # Replace these keys with the ones your Frontend usually looks for
            normalRanges = {
                "General": {"min": 0, "max": 100} 
            }
        #     print("normalRanges",normalRanges)
        # # if not csv_by_metric:
        # print("csv_by_metric",csv_by_metric)
        # #debug
        # # if not organ_to_metrics:
        # print("organ_to_metrics",organ_to_metrics)
        # # if not organ_colors:
        # print("organ_colors",organ_colors)
        # # if not common_metric_mapping:
        # print("common_metric_mapping",common_metric_mapping)
        
        # print("CSV preview:", df.head())
        # print("JSON data:", json_data)
        return jsonify({
            'status': 'Files processed',
            'organ_to_metrics': organ_to_metrics if organ_to_metrics is not None else {},
            'csv_by_metric': csv_by_metric if csv_by_metric is not None else {},
            'json_data': json_data if json_data is not None else {},
            'max_hour': find_max_hour(df) if not df.empty else 0,
            'organ_colors': organ_colors if organ_colors is not None else {},
            'common_metrics': common_metric_mapping if common_metric_mapping is not None else {},
            'normalRanges': normalRanges if normalRanges is not None else {}
        })
    except Exception as e:
        return jsonify({'error': f'Processing Error: {str(e)}'}), 500

@app.route('/upload-sample-fhir', methods=['POST'])
def upload_sample_fhir():
    patient_list = []
    metrics_list = []
    merged_entries = []
    
    import os
    sample_dir = os.path.join(os.path.dirname(__file__), '..', 'test_data', 'fhir')
    
    if not os.path.exists(sample_dir):
        return jsonify({'error': f'Sample FHIR directory not found at {sample_dir}'}), 400

    for filename in os.listdir(sample_dir):
        if filename.endswith('.json'):
            file_path = os.path.join(sample_dir, filename)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if not content: continue
                    data = json.loads(content)
                    if isinstance(data, dict):
                        if data.get('resourceType') == 'Bundle':
                            merged_entries.extend(data.get('entry', []))
                        else:
                            merged_entries.append({"resource": data})
                    fhir2jsoncsv(data, metrics_list, patient_list, FHIR_MAPPING)
            except Exception as e:
                return jsonify({'error': f'FHIR parsing error in {filename}: {str(e)}'}), 400

    globals.latest_fhir_bundle = {
        "resourceType": "Bundle",
        "type": "collection",
        "entry": merged_entries
    }
    
    df = pd.DataFrame(metrics_list)
    json_data = {"patients": patient_list, "metrics": metrics_list}

    if not df.empty and 'time' in df.columns:
        df['time_dt'] = pd.to_datetime(df['time'], errors='coerce')
        df = df.sort_values(by=['patient_id', 'time_dt'])
        if df['time_dt'].notnull().all():
            df['time'] = df.groupby('patient_id')['time_dt'].rank(method='dense').astype(int)
        else:
            df['time'] = df.groupby('patient_id').cumcount() + 1
        df['hour'] = df['time']
    
    metrics_list_processed = df.to_dict(orient='records') if not df.empty else []
    legacy_json_format = {}
    for p in patient_list:
        pid = str(p.get('id', '')).split('/')[-1].split(':')[-1].strip()
        legacy_json_format[pid] = {
            "name": f"{p['first_name']} {p['last_name']}".strip() or "Unnamed Patient",
            "gender": p.get('gender', 'unknown'),
            "birthDate": p.get('birthDate', 'N/A'),
            "metrics": [m for m in metrics_list_processed if str(m.get('patient_id', '')).split('/')[-1].split(':')[-1].strip() == pid]
        }
    json_data = legacy_json_format

    if df.empty:
        return jsonify({'error': 'No valid data found to process.'}), 400
        
    try:
        csv_by_metric = group_by_metric(df)
        organ_to_metrics = get_organ_to_metrics(df)
        organ_colors = get_organ_colors_over_time(df)
        common_metric_mapping = get_lab_panel_mapping(df)
        normalRanges = get_patient_normal_ranges(df)
        if not normalRanges:
            normalRanges = {
                "General": {"min": 0, "max": 100} 
            }
            
        return jsonify({
            'status': 'Files processed',
            'organ_to_metrics': organ_to_metrics if organ_to_metrics is not None else {},
            'csv_by_metric': csv_by_metric if csv_by_metric is not None else {},
            'json_data': json_data if json_data is not None else {},
            'max_hour': find_max_hour(df) if not df.empty else 0,
            'organ_colors': organ_colors if organ_colors is not None else {},
            'common_metrics': common_metric_mapping if common_metric_mapping is not None else {},
            'normalRanges': normalRanges if normalRanges is not None else {}
        })
    except Exception as e:
        return jsonify({'error': f'Processing Error: {str(e)}'}), 500

@app.route('/upload-sample-standard', methods=['POST'])
def upload_sample_standard():
    import os
    csv_path = os.path.join(os.path.dirname(__file__), '..', 'test_data', 'metrics.csv')
    json_path = os.path.join(os.path.dirname(__file__), '..', 'test_data', 'profile.json')
    
    if not os.path.exists(csv_path) or not os.path.exists(json_path):
        return jsonify({'error': 'Sample metrics.csv or profile.json not found in test_data'}), 400

    try:
        df = pd.read_csv(csv_path)
        with open(json_path, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
            
        import uuid
        patient_id = "patient-alpha"
        patient_resource = {
            "resourceType": "Patient",
            "id": patient_id,
            "name": [{"text": json_data.get("name", "Alpha Smith")}],
            "gender": json_data.get("gender", "unknown"),
            "extension": [
                {
                    "url": "http://hl7.org/fhir/StructureDefinition/patient-age",
                    "valueInteger": int(json_data.get("age")) if json_data.get("age") else None
                }
            ]
        }
        entry_list = [{"resource": patient_resource}]
        for _, row in df.iterrows():
            obs = {
                "resourceType": "Observation",
                "id": str(uuid.uuid4()),
                "status": "final",
                "code": {"text": str(row.get("metric_name"))},
                "subject": {"reference": f"Patient/{patient_id}"},
                "valueQuantity": {
                    "value": float(row.get("metric_value")),
                    "unit": str(row.get("unit", ""))
                },
                "effectiveDateTime": str(row.get("time"))
            }
            entry_list.append({"resource": obs})
        globals.latest_fhir_bundle = {
            "resourceType": "Bundle",
            "type": "collection",
            "entry": entry_list
        }
    except Exception as e:
        return jsonify({'error': f'File parsing error: {str(e)}'}), 400

    if df.empty:
        return jsonify({'error': 'No valid data found to process.'}), 400
    try:
        csv_by_metric = group_by_metric(df)
        organ_to_metrics = get_organ_to_metrics(df)
        organ_colors = get_organ_colors_over_time(df)
        common_metric_mapping = get_lab_panel_mapping(df)
        normalRanges = get_patient_normal_ranges(df)
        if not normalRanges:
            normalRanges = {
                "General": {"min": 0, "max": 100} 
            }
        return jsonify({
            'status': 'Files processed',
            'organ_to_metrics': organ_to_metrics if organ_to_metrics is not None else {},
            'csv_by_metric': csv_by_metric if csv_by_metric is not None else {},
            'json_data': json_data if json_data is not None else {},
            'max_hour': find_max_hour(df) if not df.empty else 0,
            'organ_colors': organ_colors if organ_colors is not None else {},
            'common_metrics': common_metric_mapping if common_metric_mapping is not None else {},
            'normalRanges': normalRanges if normalRanges is not None else {}
        })
    except Exception as e:
        return jsonify({'error': f'Processing Error: {str(e)}'}), 500

# frontend export FHIR JSON
@app.route("/export/fhir-bundle", methods=["GET"])
def export_fhir_bundle():
    if globals.latest_fhir_bundle is None:
        return jsonify({"error": "No FHIR bundle available"}), 404

    # Convert bundle dict to pretty JSON
    json_bytes = json.dumps(globals.latest_fhir_bundle, indent=2).encode("utf-8")

    # Use BytesIO so no temp file is written
    buffer = io.BytesIO(json_bytes)

    response = make_response(buffer.getvalue())
    response.headers.set("Content-Type", "application/fhir+json")
    response.headers.set(
        "Content-Disposition", "attachment", filename="fhir_bundle.json"
    )

    return response


# #api protocol
# app = FastAPI(
#     title="Visualization Protocol API",
#     description="This API follows the Visualizer V1 Protocol",
#     version="1.0.0"
# )

# # --- THE PROTOCOL ---
# # Any API following my protocol MUST return this structure
# class VisualizerResponse(BaseModel):
#     raw_value: float
#     interpretation: str
#     visualization_color: str
#     label: str

# @app.post("/predict", response_model=VisualizerResponse)
# async def predict(heart_rate: int):
#     # Logic for your demo
#     status = "Normal" if 60 <= heart_rate <= 100 else "Alert"
#     color = "#28a745" if status == "Normal" else "#dc3545"
    
#     # Returning data that matches the protocol exactly
#     return {
#         "raw_value": float(heart_rate),
#         "interpretation": status,
#         "visualization_color": color,
#         "label": "Heart Rate (BPM)"
#     }


if __name__ == "__main__":
    port=int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port,debug=True, use_reloader=False)
