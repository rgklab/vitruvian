import json
import os
import pandas as pd

# Load metric thresholds from JSON file
def load_metric_thresholds():
    """
    Load metric thresholds from the JSON file in the project root directory.
    
    Returns:
        dict: Dictionary containing metric thresholds for different organs
        
    Raises:
        FileNotFoundError: If organ_metrics.json is not found
        json.JSONDecodeError: If the JSON file is invalid
    """
    json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'organ_metrics.json')
    with open(json_path, 'r') as f:
        return json.load(f)

# Load the metric thresholds
METRIC_THRESHOLDS = load_metric_thresholds()

def check_metric_thresholds(organ, metric_name, value):
    """
    Check if a metric value is within its threshold range.
    
    Args:
        organ (str): The organ name (e.g., 'heart', 'liver')
        metric_name (str): The name of the metric to check
        value (float): The metric value to check
        
    Returns:
        bool: True if the value is within normal range, False otherwise
        
    Raises:
        ValueError: If the metric is not defined in METRIC_THRESHOLDS
    """
    if organ not in METRIC_THRESHOLDS:
        raise ValueError(f"{organ} is not defined in METRIC_THRESHOLDS")
    if metric_name not in METRIC_THRESHOLDS[organ]:
        raise ValueError(f"{metric_name} is not defined in METRIC_THRESHOLDS")
        
    thresholds = METRIC_THRESHOLDS[organ][metric_name]
    try:
        val_numeric = float(value)
        return thresholds['min'] <= val_numeric <= thresholds['max']
    except (ValueError, TypeError):
        val_str = str(value).strip().lower()
        if thresholds.get('type') == 'binary':
            if val_str in ('yes', 'true', '1', 'positive', 'active', 'present'):
                mapped_val = 1
            else:
                mapped_val = 0
            return thresholds['min'] <= mapped_val <= thresholds['max']
        if val_str in ('normal', 'negative', 'no', 'none', 'false', 'absent'):
            return True
        return False

def get_organ_normal_ranges(organ):
    """
    Get the normal ranges for all metrics of a specific organ.
    
    Args:
        organ (str): The organ name
        
    Returns:
        dict: Dictionary containing metric names and their normal ranges
    """
    if organ in METRIC_THRESHOLDS:
        return METRIC_THRESHOLDS[organ]
    return {}

def load_organ_metrics():
    """Load organ metrics configuration from JSON file."""
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'organ_metrics.json')
    with open(config_path, 'r') as f:
        return json.load(f)

def get_failing_metrics(organ_data, show_vitals=True, show_lab_tests=True):
    """
    Get list of failing metrics for an organ.
    
    Args:
        organ_data (pd.DataFrame): DataFrame containing organ metrics
        show_vitals (bool): Whether to include vital signs in the check (only used for chart filtering)
        show_lab_tests (bool): Whether to include lab test results in the check (only used for chart filtering)
    
    Returns:
        tuple: (bool, list) - Whether any metrics are failing and list of failing metrics
    """
    organ_metrics = load_organ_metrics()
    organ_name = organ_data['organ'].iloc[0]
    failing_metrics = []
    
    if organ_name not in organ_metrics:
        return False, []
    
    for _, row in organ_data.iterrows():
        metric_name = row['metric_name']
        metric_value = row['metric_value']
        
        if metric_name in organ_metrics[organ_name]:
            if not check_metric_thresholds(organ_name, metric_name, metric_value):
                try:
                    failing_metrics.append(f"{metric_name}: {float(metric_value):.2f}")
                except (ValueError, TypeError):
                    failing_metrics.append(f"{metric_name}: {metric_value}")
    
    return len(failing_metrics) > 0, failing_metrics

def validate_metrics(organ_data):
    """
    Validate that all metrics in the DataFrame exist in organ_metrics.json.
    
    Args:
        organ_data (DataFrame): DataFrame containing organ metrics
        
    Raises:
        ValueError: If any metric in the DataFrame is not defined in organ_metrics.json
    """
    thresholds = load_metric_thresholds()
    
    for _, row in organ_data.iterrows():
        organ = row['organ'].lower()
        metric_name = row['metric_name']
        
        if organ not in thresholds:
            raise ValueError(f"{organ} is not defined in organ_metrics.json")
        if metric_name not in thresholds[organ]:
            raise ValueError(f"{metric_name} is not defined in organ_metrics.json")

def calculate_health_score(organ_data, show_vitals=True, show_lab_tests=True):
    """
    Calculate health score based on the number of failing metrics.
    
    Args:
        organ_data (pd.DataFrame): DataFrame containing organ metrics
        show_vitals (bool): Whether to include vital signs in the calculation (only used for chart filtering)
        show_lab_tests (bool): Whether to include lab test results in the calculation (only used for chart filtering)
    
    Returns:
        float: Health score from 0 to 1, or None if no data
    """
    if organ_data.empty:
        return None
    
    any_metric_failing, failing_metrics = get_failing_metrics(organ_data, show_vitals, show_lab_tests)
    
    if not any_metric_failing:
        return 1.0  # All metrics are within range
    
    # Count total metrics (ignoring type)
    organ_metrics = load_organ_metrics()
    organ_name = organ_data['organ'].iloc[0]
    total_metrics = len(organ_metrics[organ_name])
    
    if total_metrics == 0:
        return None
    
    # Calculate score based on number of failing metrics
    failing_count = len(failing_metrics)
    if failing_count == 1:
        return 0.75  # One failing metric
    elif failing_count < total_metrics:
        return 0.5   # Multiple failing metrics but not all
    else:
        return 0.0   # All metrics failing
    
def get_patient_normal_ranges(patient_data):
    """
    Return normal ranges for all organs in the patient data.

    Args:
        patient_data (pd.DataFrame): DataFrame with 'organ' and 'metric_name' columns

    Returns:
        dict: { organ_name: { metric_name: {'min': x, 'max': y, 'type': ...} } }
    """
    normal_ranges = {}

    for organ in patient_data['organ'].unique():
        organ_thresholds = get_organ_normal_ranges(organ)
        if organ_thresholds:  # skip if no thresholds defined
            # normalize organ and metric names
            normal_ranges[organ.lower()] = {
                metric.replace(" ", ""): value for metric, value in organ_thresholds.items()
            }

    return normal_ranges

