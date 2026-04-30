import pandas as pd
import json
import uuid
import os
import glob

# ==========================================
# eICU CONVERSION LOGIC
# ==========================================

def generate_id():
    return str(uuid.uuid4())

def create_patient(row):
    return {
        "resourceType": "Patient",
        "id": str(row['uniquepid']).replace('-', ''),
        "identifier": [{"system": "http://eicu-crd.mit.edu/uniquepid", "value": str(row['uniquepid'])}],
        "gender": str(row['gender']).lower() if pd.notnull(row['gender']) else "unknown",
        "extension": [
            {
                "url": "http://hl7.org/fhir/StructureDefinition/patient-age",
                "valueInteger": int(row['age']) if pd.notnull(row['age']) and str(row['age']).isdigit() else None
            },
            {
                "url": "http://hl7.org/fhir/StructureDefinition/us-core-race",
                "valueString": str(row['ethnicity']) if pd.notnull(row['ethnicity']) else None
            }
        ]
    }

def create_encounter(row, patient_id):
    return {
        "resourceType": "Encounter",
        "id": str(row['patientunitstayid']),
        "status": "finished",
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", 
            "code": "IMP", 
            "display": "inpatient encounter"
        },
        "subject": {"reference": f"Patient/{patient_id}"},
        "period": {
            "start": f"{row['hospitaldischargeyear']}T{row['hospitaladmittime24']}" if pd.notnull(row['hospitaldischargeyear']) else None,
            "end": f"{row['hospitaldischargeyear']}T{row['hospitaldischargetime24']}" if pd.notnull(row['hospitaldischargeyear']) else None
        },
        "location": [{"location": {"display": str(row['unittype'])}}]
    }

def create_medication_request(row, patient_id, encounter_id):
    return {
        "resourceType": "MedicationRequest",
        "id": str(row['medicationid']),
        "status": "completed",
        "intent": "order",
        "medicationCodeableConcept": {"text": str(row['drugname'])},
        "subject": {"reference": f"Patient/{patient_id}"},
        "encounter": {"reference": f"Encounter/{encounter_id}"},
        "dosageInstruction": [{"text": f"Dose: {row['dosage']}, Route: {row['routeadmin']}, Freq: {row['frequency']}"}]
    }

def create_observation(patient_id, encounter_id, code_display, value, unit=None, status="final"):
    if pd.isnull(value): return None
    obs = {
        "resourceType": "Observation",
        "id": generate_id(),
        "status": status,
        "code": {"text": code_display},
        "subject": {"reference": f"Patient/{patient_id}"},
        "encounter": {"reference": f"Encounter/{encounter_id}"}
    }
    try:
        val_float = float(value)
        obs["valueQuantity"] = {"value": val_float}
        if unit:
            obs["valueQuantity"]["unit"] = unit
    except ValueError:
        obs["valueString"] = str(value)
    return obs

def process_patient_folder_eicu(folder_path):
    bundle = {
        "resourceType": "Bundle",
        "type": "collection",
        "entry": []
    }
    
    patient_id = "unknown"
    encounter_id = "unknown"
    
    # 1. Process Patient & Encounter
    patient_file = os.path.join(folder_path, 'patient_filtered.csv')
    if os.path.exists(patient_file):
        df_patient = pd.read_csv(patient_file)
        if not df_patient.empty:
            p_row = df_patient.iloc[0]
            patient_resource = create_patient(p_row)
            encounter_resource = create_encounter(p_row, patient_resource['id'])
            
            bundle['entry'].append({"resource": patient_resource})
            bundle['entry'].append({"resource": encounter_resource})
            
            patient_id = patient_resource['id']
            encounter_id = encounter_resource['id']
        else:
            return False
    else:
        return False

    # 2. Process Medications
    med_file = os.path.join(folder_path, 'medication_filtered.csv')
    if os.path.exists(med_file):
        df_meds = pd.read_csv(med_file)
        for _, row in df_meds.iterrows():
            bundle['entry'].append({"resource": create_medication_request(row, patient_id, encounter_id)})

    # 3. Process Vital Periodic
    vp_file = os.path.join(folder_path, 'vitalPeriodic_filtered.csv')
    if os.path.exists(vp_file):
        df_vp = pd.read_csv(vp_file).head(20) # Limit for POC
        for _, row in df_vp.iterrows():
            if pd.notnull(row.get('heartrate')):
                bundle['entry'].append({"resource": create_observation(patient_id, encounter_id, "Heart Rate", row['heartrate'], "bpm")})
            if pd.notnull(row.get('sao2')):
                bundle['entry'].append({"resource": create_observation(patient_id, encounter_id, "O2 Saturation", row['sao2'], "%")})

    # 4. Process Vital Aperiodic
    va_file = os.path.join(folder_path, 'vitalAperiodic_filtered.csv')
    if os.path.exists(va_file):
        df_va = pd.read_csv(va_file).head(20) # Limit for POC
        for _, row in df_va.iterrows():
            if pd.notnull(row.get('noninvasivemean')):
                bundle['entry'].append({"resource": create_observation(patient_id, encounter_id, "Non-Invasive Mean BP", row['noninvasivemean'], "mmHg")})

    # 5. Process Nurse Charting
    nc_file = os.path.join(folder_path, 'nurseCharting_filtered.csv')
    if os.path.exists(nc_file):
        df_nc = pd.read_csv(nc_file).head(20) # Limit for POC
        for _, row in df_nc.iterrows():
            val = row.get('nursingchartvalue')
            label = row.get('nursingchartcelltypevalname')
            if pd.notnull(val) and pd.notnull(label):
                bundle['entry'].append({"resource": create_observation(patient_id, encounter_id, label, val)})

    # 6. Process Intake Output
    io_file = os.path.join(folder_path, 'intakeOutput_filtered.csv')
    if os.path.exists(io_file):
        df_io = pd.read_csv(io_file)
        for _, row in df_io.iterrows():
            label = row.get('celllabel', 'Fluid I/O')
            if pd.notnull(row.get('cellvaluenumeric')):
                bundle['entry'].append({"resource": create_observation(patient_id, encounter_id, label, row['cellvaluenumeric'], "ml")})
        
    return bundle

# ==========================================
# MIMIC CONVERSION LOGIC
# ==========================================

def package_mimic_to_bundle(input_filepath, output_filepath):
    try:
        with open(input_filepath, 'r') as f:
            fhir_resources = json.load(f)
            
        bundle = {
            "resourceType": "Bundle",
            "type": "collection",
            "entry": []
        }
        
        for resource in fhir_resources:
            bundle['entry'].append({
                "resource": resource
            })
            
        with open(output_filepath, 'w') as f:
            json.dump(bundle, f, indent=2)
            
        return True
    except Exception as e:
        print(f"    [ERROR] processing {input_filepath}: {e}")
        return False

def process_mimic():
    base_dir = os.path.join('data', 'mimic')
    print(f" -> Searching for MIMIC data in {base_dir}...")
    
    mimic_files = glob.glob(os.path.join(base_dir, '**', '*.json'), recursive=True)
    
    if not mimic_files:
        print(f"    [SKIP] No MIMIC JSON files found.")
        return
        
    success_count = 0
    for file_path in mimic_files:
        filename = os.path.basename(file_path)
        output_name = f"fhir_bundle_mimic_{filename}"
        
        if package_mimic_to_bundle(file_path, output_name):
            success_count += 1
            
    print(f"    [SUCCESS] Generated {success_count} standard MIMIC FHIR bundles.")
def fhir2jsoncsv(data,metrics_list,patient_list,FHIR_MAPPING):
    # Use the robust extraction logic from previous steps
    raw_resources = []
    if isinstance(data, list):
        raw_resources = data
    elif isinstance(data, dict):
        if data.get('resourceType') == 'Bundle':
            raw_resources = [e.get('resource') for e in data.get('entry', []) if isinstance(e, dict) and e.get('resource')]
        else:
            raw_resources = [data]

    for res in raw_resources:
        if not isinstance(res, dict): continue
        rtype = res.get('resourceType')

        if rtype == 'Patient':
            name_info = res.get('name', [{}])[0]
            raw_id = res.get('id', '')
            clean_pid = raw_id.split('/')[-1].split(':')[-1].strip() if raw_id else 'patient-alpha'
            patient_list.append({
                'id': clean_pid,
                'first_name': " ".join(name_info.get('given', [])) if isinstance(name_info.get('given'), list) else "",
                'last_name': name_info.get('family', ''),
                'gender': res.get('gender'),
                'birthDate': res.get('birthDate'),
            })

        elif rtype == 'Observation':
            # 1. Flatten Panels: Check if there are nested components (like for BP)
            components = res.get('component', [])
            obs_to_process = components if components else [res]
            for obs in obs_to_process:
                # 1. Get and Clean Raw Text
                raw_code = 'Unknown'
                code_obj = obs.get('code', {})
                if 'coding' in code_obj and code_obj['coding']:
                    raw_code = code_obj['coding'][0].get('display') or code_obj['coding'][0].get('code') or 'Unknown'
                if raw_code == 'Unknown' or not raw_code:
                    raw_code = code_obj.get('text', 'Unknown')

                import re
                def normalize_string(s):
                    return re.sub(r'[^a-z0-9]', '', s.lower())

                normalized_raw = normalize_string(raw_code)

                # 2. Extract Value
                val_qty = obs.get('valueQuantity', {})
                value = val_qty.get('value')
                if value is None:
                    value = obs.get('valueCodeableConcept', {}).get('text')
                
                if value is None: continue

                # 3. STRICT Mapping Logic
                clean_name = None
                organ_type = None
                matched = False
                
                # Sort keys by length for accuracy
                sorted_keys = sorted(FHIR_MAPPING.keys(), key=len, reverse=True)
                
                for keyword in sorted_keys:
                    # Use word boundary regex matching to avoid substring collision (e.g. 'last' matching 'ast')
                    pattern = rf"\b{re.escape(keyword.lower())}\b"
                    if re.search(pattern, raw_code.lower()):
                        clean_name, organ_type = FHIR_MAPPING[keyword]
                        matched = True
                        break

                # ONLY append if the metric is one we explicitly want
                if matched:
                    ref_str = res.get('subject', {}).get('reference', '')
                    clean_pid = ref_str.split('/')[-1].split(':')[-1].strip() if ref_str else 'patient-alpha'
                    metrics_list.append({
                        'patient_id': clean_pid,
                        'organ': organ_type,
                        'metric_name': clean_name,
                        'metric_value': value,
                        'unit': val_qty.get('unit', ''),
                        'time': res.get('effectiveDateTime', '0')
                    })
            # for obs in obs_to_process:
            #     # 1. Get and Clean Raw Text
            #     raw_code = obs.get('code', {}).get('text', 'Unknown')
            #     # Remove newlines and extra spaces that Synthea sometimes adds
            #     normalized_raw = " ".join(raw_code.lower().split())

            #     # 2. Extract Value
            #     val_qty = obs.get('valueQuantity', {})
            #     value = val_qty.get('value')
            #     if value is None:
            #         value = obs.get('valueCodeableConcept', {}).get('text')
                
            #     if value is None: continue

            #     # 3. Improved Mapping Logic
            #     clean_name = raw_code
            #     organ_type = 'General'
                
            #     # Sort keys by length so "systolic blood pressure" matches before "blood pressure"
            #     sorted_keys = sorted(FHIR_MAPPING.keys(), key=len, reverse=True)
                
            #     for keyword in sorted_keys:
            #         # Clean the keyword the same way
            #         normalized_keyword = " ".join(keyword.lower().split())
            #         if normalized_keyword in normalized_raw:
            #             clean_name, organ_type = FHIR_MAPPING[keyword]
            #             break

            #     metrics_list.append({
            #         'patient_id': res.get('subject', {}).get('reference', '').split(':')[-1],
            #         'organ': organ_type,
            #         'metric_name': clean_name, # This MUST be 'mch', 'alt', etc.
            #         'value': value,
            #         'unit': val_qty.get('unit', ''),
            #         'time': res.get('effectiveDateTime', '0')
            #     })
# ==========================================
# SYNTHEA TRANSFER LOGIC
# ==========================================

def process_synthea(synthea_files):
    success_count = 0
    for file_path in synthea_files:
        
        try:
            with open(file_path, 'r') as f:
                bundle = json.load(f)
                
            # Synthea is already a properly formatted FHIR Bundle! 
            # We just write it directly to the working directory.
            # with open(output_name, 'w') as f:
            #     json.dump(bundle, f, indent=2)
                
            success_count += 1
        except Exception as e:
            print(f"    [ERROR] processing {file_path}: {e}")
            
    print(f"    [SUCCESS] Migrated {success_count} standard Synthea FHIR bundles.")
