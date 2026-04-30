import uuid
from datetime import datetime

def build_fhir_communication(user_message, bot_reply, patient_id="example-patient"):
    """
    Build a FHIR Communication resource for a chatbot interaction.
    """

    return {
        "resourceType": "Communication",
        "id": str(uuid.uuid4()),
        "status": "completed",
        "sent": datetime.utcnow().isoformat() + "Z",
        "subject": {
            "reference": f"Patient/{patient_id}"
        },
        "category": [
            {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": "LP173418-7",
                        "display": "Digital patient interaction"
                    }
                ]
            }
        ],
        "payload": [
            {
                "contentString": f"User: {user_message}"
            },
            {
                "contentString": f"Bot: {bot_reply}"
            }
        ]
    }

def build_fhir_observation_from_dynameld_response(data, patient_id="example-patient"):
    """
    Convert a DynaMeLD response (from dynMELD or breslow channels)
    into a FHIR Observation resource.
    
    Expected response payload example:
    {
        "prediction": 0.87,
        "feature": "mortality_risk",
        "units": "probability",
        "timestamp": "2025-02-10T14:03:00Z",
        "model": "dynaMELD-v3.0",
        "metadata": {... optional ...}
    }
    """

    # Extract values safely with sensible defaults
    value = data.get("prediction") or data.get("value")
    feature_name = data.get("feature", "dynameld-output")
    timestamp = data.get("timestamp", datetime.utcnow().isoformat() + "Z")
    units = data.get("units", "1")
    model_name = data.get("model", "dynaMELD-model")

    return {
        "resourceType": "Observation",
        "id": str(uuid.uuid4()),
        "status": "final",

        "subject": {
            "reference": f"Patient/{patient_id}"
        },

        "effectiveDateTime": timestamp,

        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "predictive-model",
                        "display": "Predictive Model Output"
                    }
                ]
            }
        ],

        "code": {
            "text": f"DynaMeLD prediction: {feature_name}"
        },

        "valueQuantity": {
            "value": value,
            "unit": units,
            "system": "http://unitsofmeasure.org",
            "code": units
        },

        "method": {
            "text": model_name
        },

        # optional metadata extension
        "extension": [
            {
                "url": "http://example.org/fhir/StructureDefinition/dynameld-metadata",
                "valueString": str(data.get("metadata", {}))
            }
        ]
    }

def add_resource_to_bundle(bundle, resource):
    """Append a FHIR resource into an existing Bundle."""
    bundle["entry"].append({"resource": resource})
    return bundle

def wrap_in_fhir_bundle(resources):
    return {
        "resourceType": "Bundle",
        "type": "collection",
        "id": str(uuid.uuid4()),
        "entry": [
            {"resource": r} for r in resources
        ]
    }
