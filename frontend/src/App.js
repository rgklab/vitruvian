import React, { useState, useEffect, useMemo } from 'react';
import ModelViewer from './components/ModelViewer';
import MiddlePanel from './components/MiddlePanel';
import HourlySlider from './components/HourlySlider';
import PatientProfile from './components/PatientProfile';
import ModelDetails from './components/ModelDetails';
import Chat from './components/Chat';
import Annotate from './components/Annotate';
import './App.css'; 

function downloadFHIR() {
  const endpoint = process.env.REACT_APP_API_URL 
    ? `${process.env.REACT_APP_API_URL}/export/fhir-bundle` 
    : '/export/fhir-bundle';
  fetch(endpoint)
    .then((response) => response.blob())
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fhir_bundle.json"; 
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch((err) => {
      console.error("Download error:", err);
    });
}

const getOrganColorsForPatient = (patientMetrics, normalRanges, organToMetrics) => {
  const hoursMap = {};
  patientMetrics.forEach(m => {
    const hr = Math.round(m.time);
    if (!hoursMap[hr]) {
      hoursMap[hr] = {};
    }
    const org = m.organ;
    if (!hoursMap[hr][org]) {
      hoursMap[hr][org] = [];
    }
    hoursMap[hr][org].push(m);
  });

  const isNormal = (value, range) => {
    if (!range) return true;
    const numericVal = parseFloat(value);
    if (!isNaN(numericVal)) {
      return numericVal >= range.min && numericVal <= range.max;
    }
    const valStr = String(value).trim().toLowerCase();
    if (range.type === 'binary') {
      const mapped = ['yes', 'true', '1', 'positive', 'active', 'present'].includes(valStr) ? 1 : 0;
      return mapped >= range.min && mapped <= range.max;
    }
    if (['normal', 'negative', 'no', 'none', 'false', 'absent'].includes(valStr)) {
      return true;
    }
    return false;
  };

  const getFailingMetrics = (organMetricsList, organName) => {
    const failing = [];
    organMetricsList.forEach(m => {
      const range = normalRanges?.[organName.toLowerCase()]?.[m.metric_name];
      if (range) {
        if (!isNormal(m.metric_value, range)) {
          failing.push(m.metric_name);
        }
      }
    });
    return failing;
  };

  const calculateHealthScore = (organMetricsList, organName) => {
    if (!organMetricsList || organMetricsList.length === 0) return null;
    const failing = getFailingMetrics(organMetricsList, organName);
    if (failing.length === 0) return 1.0;
    
    const matchedKey = Object.keys(organToMetrics || {}).find(
      k => k.toLowerCase() === organName.toLowerCase()
    ) || organName;
    const totalMetrics = organToMetrics?.[matchedKey]?.length || 0;
    if (totalMetrics === 0) return null;

    const failingCount = failing.length;
    if (failingCount === 1) return 0.75;
    if (failingCount < totalMetrics) return 0.5;
    return 0.0;
  };

  const getColorForHealthScore = (healthScore) => {
    if (healthScore === null || healthScore >= 1.0) return null;
    const clamped = Math.max(0.0, Math.min(1.0, healthScore));
    let r, g, b;
    if (clamped <= 0.5) {
      r = 1.0;
      g = 2 * clamped;
      b = 0.0;
    } else {
      r = 2 * (1.0 - clamped);
      g = 1.0;
      b = 0.0;
    }
    return [r, g, b];
  };

  const organColorsOverTime = {};
  Object.entries(hoursMap).forEach(([hrStr, organs]) => {
    const hr = parseInt(hrStr);
    organColorsOverTime[hr] = {};
    Object.entries(organs).forEach(([org, list]) => {
      const hs = calculateHealthScore(list, org);
      if (hs !== null) {
        const color = getColorForHealthScore(hs);
        if (color) {
          organColorsOverTime[hr][org] = color;
        }
      }
    });
  });

  return organColorsOverTime;
};

function App({
  uploadedData,
  selectedOrgans,
  setSelectedOrgans,
  organToMetrics,
  csvByMetric,
  selectedMetrics,
  setselectedMetrics,
  max_hour,
  organ_colors,
  common_metrics,
  normalRanges,
  modelConfig
}){
  // --- State Management ---
  const hasModel = Boolean(modelConfig && modelConfig.port);
  const [allPatients, setAllPatients] = useState([]);
  const [currentPatientIndex, setCurrentPatientIndex] = useState(0);
  const [annotationsByPatient, setAnnotationsByPatient] = useState({}); 
  const [customRationaleTags, setCustomRationaleTags] = useState([]);
  
  const [hour, setHour] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false); 
  const [selectedMesh, setSelectedMesh] = useState(null); 
  const [selectedModels, setSelectedModels] = useState(() => {
    return (modelConfig && modelConfig.port) ? [modelConfig.modelName || "Sepsis Risk Predictor"] : [];
  });
  const [annotatingModels, setAnnotatingModels] = useState([]); 
  const [activeTab, setActiveTab] = useState('charts');
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [annotateCollapsed, setAnnotateCollapsed] = useState(true);
  const [currentBounds, setCurrentBounds] = useState({ start: 1, end: max_hour });

  // Lifted States for predictions
  const [modelResult, setModelResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sync selectedModels with incoming modelConfig
  useEffect(() => {
    if (modelConfig && modelConfig.port) {
      setSelectedModels([modelConfig.modelName || "Sepsis Risk Predictor"]);
    } else {
      setSelectedModels([]);
      setModelResult(null);
    }
  }, [modelConfig]);

  // --- 1. Process Uploaded Data ---
  useEffect(() => {
    if (uploadedData?.json_data) {
      // Check if it's a flat profile (standard ingestion)
      if (uploadedData.json_data.name && !uploadedData.json_data.metrics && !Object.values(uploadedData.json_data).some(v => v && typeof v === 'object' && v.name)) {
        const data = uploadedData.json_data;
        const patient = {
          id: "patient-alpha",
          ...data,
          name: String(data.name || "Alpha Smith").replace(/\d+/g, '').trim(),
          dob: data.dob || data.birthDate || "N/A",
          age: data.age || "N/A",
          metrics: []
        };
        
        // Convert csvByMetric back into a flat metrics list for this patient
        const metrics = [];
        Object.entries(uploadedData.csv_by_metric || {}).forEach(([metricName, points]) => {
          points.forEach(pt => {
            metrics.push({
              patient_id: "patient-alpha",
              organ: pt.organ,
              metric_name: metricName,
              metric_value: pt.metric_value,
              unit: pt.unit || '',
              time: pt.time
            });
          });
        });
        patient.metrics = metrics;
        
        setAllPatients([patient]);
        setCurrentPatientIndex(0);
      } else {
        // Dictionary of patients (FHIR folder upload)
        const patientsArray = Object.entries(uploadedData.json_data).map(([id, data]) => {
          const rawName = data.name || "Unknown";
          const birthDate = data.dob || data.birthDate || data.birth_date || "N/A";
          
          let calculatedAge = data.age;
          if (!calculatedAge && birthDate !== "N/A") {
            const year = new Date(birthDate).getFullYear();
            const currentYear = new Date().getFullYear();
            calculatedAge = currentYear - year;
          }
          return {
            id,
            ...data,
            name: String(rawName).replace(/\d+/g, '').trim(),
            dob: birthDate,
            age: calculatedAge || "N/A"
          };
        });
        setAllPatients(patientsArray);
        setCurrentPatientIndex(0);
      }
    }
  }, [uploadedData]);

  const currentPatient = allPatients[currentPatientIndex] || null;

  const processedPatientMetrics = useMemo(() => {
    let rawList = currentPatient?.metrics;
    
    // Fallback: If currentPatient has no metrics array, but uploadedData has csv_by_metric:
    if (!rawList || rawList.length === 0) {
      if (uploadedData?.csv_by_metric && Object.keys(uploadedData.csv_by_metric).length > 0) {
        const fallbackList = [];
        Object.entries(uploadedData.csv_by_metric).forEach(([metricName, points]) => {
          (points || []).forEach(pt => {
            const pid = String(pt.patient_id || '').split('/').pop().split(':').pop().trim();
            const curId = String(currentPatient?.id || '').split('/').pop().split(':').pop().trim();
            if (!curId || !pid || pid === curId || pid === 'patient-alpha') {
              fallbackList.push({
                ...pt,
                metric_name: pt.metric_name || metricName,
                time: pt.time ?? pt.hour ?? 1,
                metric_value: pt.metric_value
              });
            }
          });
        });
        if (fallbackList.length > 0) rawList = fallbackList;
      }
    }

    if (!rawList || rawList.length === 0) return [];

    // Parse timestamps into clean 1, 2, 3... integer hours
    const rawTimes = rawList.map(m => m.time);
    const isNumericTimes = rawTimes.every(t => t !== undefined && t !== null && !isNaN(Number(t)));
    let timeMap = null;
    if (!isNumericTimes) {
      const uniqueTimes = Array.from(new Set(rawTimes)).sort((a, b) => new Date(a) - new Date(b));
      timeMap = new Map();
      uniqueTimes.forEach((t, index) => {
        timeMap.set(t, index + 1);
      });
    }

    return rawList.map(m => {
      let tNum = Number(m.time);
      if ((isNaN(tNum) || !Number.isFinite(tNum)) && timeMap) {
        tNum = timeMap.get(m.time) || 1;
      }
      return {
        ...m,
        time: isNaN(tNum) ? 1 : tNum,
        metric_value: Number(m.metric_value)
      };
    }).filter(m => !isNaN(m.metric_value));
  }, [currentPatient, uploadedData]);

  const patientCsvByMetric = useMemo(() => {
    const grouped = {};
    processedPatientMetrics.forEach((m) => {
      if (!grouped[m.metric_name]) {
        grouped[m.metric_name] = [];
      }
      grouped[m.metric_name].push(m);
    });
    return grouped;
  }, [processedPatientMetrics]);

  const patientOrganColors = useMemo(() => {
    if (processedPatientMetrics.length === 0) return {};
    return getOrganColorsForPatient(processedPatientMetrics, normalRanges, organToMetrics);
  }, [processedPatientMetrics, normalRanges, organToMetrics]);

  const patientMaxHour = useMemo(() => {
    if (processedPatientMetrics.length === 0) return max_hour;
    const times = processedPatientMetrics.map(m => m.time);
    return Math.max(...times);
  }, [processedPatientMetrics, max_hour]);

  const currentPatientOrganToMetrics = useMemo(() => {
    const mapping = {};
    processedPatientMetrics.forEach(m => {
      const org = m.organ || 'general';
      if (!mapping[org]) mapping[org] = [];
      if (!mapping[org].includes(m.metric_name)) {
        mapping[org].push(m.metric_name);
      }
    });
    const merged = { ...organToMetrics };
    Object.entries(mapping).forEach(([org, metrics]) => {
      merged[org] = Array.from(new Set([...(merged[org] || []), ...metrics]));
    });
    return Object.keys(merged).length > 0 ? merged : organToMetrics;
  }, [processedPatientMetrics, organToMetrics]);

  // Reset hour, bounds, and auto-select core vitals on patient switch
  useEffect(() => {
    setHour(1);
    setCurrentBounds({ start: 1, end: patientMaxHour });
    setSelectedMesh(null);
    
    // Automatically select the 5 core vitals if available, or first available metrics
    const availableMetricNames = Object.keys(patientCsvByMetric);
    if (availableMetricNames.length > 0) {
      const coreVitals = ["HeartRate", "RespiratoryRate", "Temperature", "SystolicBloodPressure", "SpO2"];
      const matchingCore = coreVitals.filter(v => availableMetricNames.includes(v));
      const initialMetrics = matchingCore.length > 0 ? matchingCore : availableMetricNames.slice(0, 5);
      setselectedMetrics(initialMetrics);
      
      const organsForMetrics = [];
      processedPatientMetrics.forEach(m => {
        if (initialMetrics.includes(m.metric_name) && m.organ && !organsForMetrics.includes(m.organ)) {
          organsForMetrics.push(m.organ);
        }
      });
      setSelectedOrgans(organsForMetrics);
    } else {
      setselectedMetrics([]);
      setSelectedOrgans([]);
    }
  }, [currentPatientIndex, patientMaxHour, patientCsvByMetric, processedPatientMetrics, setSelectedOrgans, setselectedMetrics]);

  // --- 2. Live Predict Model Inference (Sepsis 5-Vital Early Warning) ---
  useEffect(() => {
    if (!hasModel) {
      setModelResult(null);
      setLoading(false);
      return;
    }

    const fetchAnalysis = async () => {
      setLoading(true);
      try {
        const getVital = (metricName, fallbackVal) => {
          const points = patientCsvByMetric?.[metricName] || [];
          if (!points || points.length === 0) return fallbackVal;
          const match = points.find(p => Number(p.time) === Number(hour));
          if (match && match.metric_value !== undefined && match.metric_value !== null) {
            return Number(match.metric_value);
          }
          const preceding = points
            .filter(p => Number(p.time) <= Number(hour))
            .sort((a, b) => Number(b.time) - Number(a.time));
          if (preceding.length > 0 && preceding[0].metric_value !== undefined && preceding[0].metric_value !== null) {
            return Number(preceding[0].metric_value);
          }
          return Number(points[0].metric_value) || fallbackVal;
        };

        const hr = getVital('HeartRate', 75);
        const rr = getVital('RespiratoryRate', 16);
        const temp = getVital('Temperature', 37.0);
        const sbp = getVital('SystolicBloodPressure', 115);
        const spo2 = getVital('SpO2', 98);

        const computeClientSepsis = () => {
          const sirs_hr = hr > 90;
          const sirs_rr = rr > 20;
          const sirs_temp = temp > 38.0 || temp < 36.0;
          const qsofa_sbp = sbp <= 100;
          const qsofa_rr = rr >= 22;
          const hypoxemia = spo2 < 95;
          const severe_hypoxemia = spo2 < 90;

          const features = {
            HR: { name: 'Heart Rate', value: Math.round(hr * 10) / 10, unit: 'bpm', normal_range: '60 - 100 bpm', status: (hr > 100 || hr < 50) ? 'alert' : (sirs_hr ? 'warning' : 'normal'), criterion: sirs_hr ? 'SIRS Tachycardia (>90 bpm)' : 'Within normal limits' },
            RR: { name: 'Respiratory Rate', value: Math.round(rr * 10) / 10, unit: 'breaths/min', normal_range: '12 - 20 breaths/min', status: qsofa_rr ? 'alert' : (sirs_rr ? 'warning' : 'normal'), criterion: qsofa_rr ? 'qSOFA Tachypnea (≥22 /min)' : (sirs_rr ? 'SIRS Tachypnea (>20 /min)' : 'Within normal limits') },
            Temp: { name: 'Body Temperature', value: Math.round(temp * 10) / 10, unit: '°C', normal_range: '36.1 - 37.2 °C', status: (temp > 38.5 || temp < 35.5) ? 'alert' : (sirs_temp ? 'warning' : 'normal'), criterion: temp > 38.0 ? 'Fever (>38.0°C)' : (temp < 36.0 ? 'Hypothermia (<36.0°C)' : 'Within normal limits') },
            SBP: { name: 'Systolic Blood Pressure', value: Math.round(sbp * 10) / 10, unit: 'mmHg', normal_range: '90 - 120 mmHg', status: sbp < 90 ? 'alert' : (qsofa_sbp ? 'warning' : 'normal'), criterion: qsofa_sbp ? 'qSOFA Hypotension (≤100 mmHg)' : 'Adequate perfusion' },
            SpO2: { name: 'Oxygen Saturation', value: Math.round(spo2 * 10) / 10, unit: '%', normal_range: '95 - 100 %', status: severe_hypoxemia ? 'alert' : (hypoxemia ? 'warning' : 'normal'), criterion: severe_hypoxemia ? 'Severe Hypoxemia (<90%)' : (hypoxemia ? 'Hypoxemia (<95%)' : 'Normal saturation') }
          };

          let risk_score = 0.05;
          const abnormal_vitals = [];
          if (sirs_hr) { risk_score += 0.22; abnormal_vitals.push(`Elevated HR (${Math.round(hr)} bpm)`); }
          if (qsofa_rr) { risk_score += 0.25; abnormal_vitals.push(`High RR (${Math.round(rr)} /min)`); }
          else if (sirs_rr) { risk_score += 0.18; abnormal_vitals.push(`Elevated RR (${Math.round(rr)} /min)`); }
          if (sirs_temp) { risk_score += 0.20; abnormal_vitals.push(`Abnormal Temp (${temp.toFixed(1)} °C)`); }
          if (sbp < 90) { risk_score += 0.25; abnormal_vitals.push(`Hypotension SBP (${Math.round(sbp)} mmHg)`); }
          else if (qsofa_sbp) { risk_score += 0.18; abnormal_vitals.push(`Borderline Low SBP (${Math.round(sbp)} mmHg)`); }
          if (severe_hypoxemia) { risk_score += 0.20; abnormal_vitals.push(`Severe Hypoxemia SpO2 (${Math.round(spo2)}%)`); }
          else if (hypoxemia) { risk_score += 0.12; abnormal_vitals.push(`Low SpO2 (${Math.round(spo2)}%)`); }

          risk_score = Math.min(0.98, Math.max(0.02, risk_score));
          let prediction, assessment, confidence, message;
          if (risk_score >= 0.50 || abnormal_vitals.length >= 2) {
            prediction = "High Risk";
            assessment = "caution";
            confidence = Math.round((0.78 + (risk_score * 0.18)) * 100) / 100;
            message = `Critical septic risk profile. Core physiological drivers: ${abnormal_vitals.join(', ')}.`;
          } else if (risk_score >= 0.25 || abnormal_vitals.length === 1) {
            prediction = "Moderate Risk";
            assessment = "stable";
            confidence = 0.82;
            message = `Early warning signs present (${abnormal_vitals.join(', ')}). Close clinical telemetry surveillance recommended.`;
          } else {
            prediction = "Low Risk";
            assessment = "stable";
            confidence = 0.94;
            message = "All 5 core physiological vitals within stable baseline limits. No immediate SIRS/qSOFA sepsis alert.";
          }

          return {
            risk_score: Math.round(risk_score * 100) / 100,
            prediction,
            assessment,
            confidence,
            message,
            features
          };
        };

        const serverUrl = modelConfig?.url || "http://127.0.0.1:8000";
        try {
          const res = await fetch(`${serverUrl}/predict/sepsis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              hr,
              rr,
              temp,
              sbp,
              spo2,
              hour,
              patientId: currentPatient?.id
            }),
            signal: AbortSignal.timeout(1500)
          });

          if (res.ok) {
            const data = await res.json();
            setModelResult(data);
          } else {
            setModelResult(computeClientSepsis());
          }
        } catch {
          setModelResult(computeClientSepsis());
        }
      } catch (err) {
        console.error("Live predict calculation error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [hasModel, selectedModels, hour, currentPatient, patientCsvByMetric, modelConfig]);

  // Sync selectedMesh with MiddlePanel selection
  useEffect(() => {
    if (!selectedMesh) return;
    const meshName = String(selectedMesh).toLowerCase();
    
    let organKey = null;
    if (meshName.includes('heart') || meshName.includes('cardiac') || meshName.includes('ventricle') || meshName.includes('atrium')) {
      organKey = 'heart';
    } else if (meshName.includes('lung') || meshName.includes('bronch') || meshName.includes('trachea')) {
      organKey = 'lung';
    } else if (meshName.includes('kidney') || meshName.includes('renal') || meshName.includes('ureter')) {
      organKey = 'kidney';
    } else if (meshName.includes('liver') || meshName.includes('hepatic') || meshName.includes('gall')) {
      organKey = 'liver';
    } else if (meshName.includes('brain') || meshName.includes('nerve') || meshName.includes('cord') || meshName.includes('cervical') || meshName.includes('thoracic') || meshName.includes('lumbar')) {
      organKey = 'neurological';
    }

    if (organKey) {
      const organMetrics = currentPatientOrganToMetrics[organKey] || [];
      setselectedMetrics(prev => Array.from(new Set([...prev, ...organMetrics])));
      setSelectedOrgans(prev => Array.from(new Set([...prev, organKey])));
    }
  }, [selectedMesh, currentPatientOrganToMetrics, setselectedMetrics, setSelectedOrgans]);

  const updateGlobalAnnotation = (patientId, modelName, data) => {
    setAnnotationsByPatient(prev => ({
      ...prev,
      [patientId]: {
        ...(prev[patientId] || {}),
        [modelName]: data
      }
    }));
  };

  const handleAnnotateToggle = (modelName) => {
    setAnnotatingModels((prev) => {
      if (prev.includes(modelName)) {
        return prev.filter(m => m !== modelName);
      } else {
        return [...prev, modelName];
      }
    });
  };

  return (
    <div className={`app-container ${!hasModel ? 'two-column' : ''}`}>
      {/* Left Column: 3D Anatomy Visualizer & Compact Patient Top Bar */}
      <div className="left-panel">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', minHeight: '34px' }}>
          <h1 style={{ color: '#1e3a8a', margin: 0, fontSize: '22px', fontWeight: '900', letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'center' }}>
            VITRUVIAN
          </h1>
        </div>

        {/* Really Small / Compact Patient Selection & Info Bar at Top */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '6px 8px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
              Patient:
            </span>
            <select 
              className="patient-select"
              value={currentPatientIndex} 
              onChange={(e) => setCurrentPatientIndex(Number(e.target.value))}
              style={{ marginBottom: 0, padding: '2px 6px', fontSize: '11.5px', height: '26px', flex: 1, fontWeight: '600' }}
            >
              {allPatients.map((p, idx) => (
                <option key={p.id} value={idx}>{p.name}</option>
              ))}
            </select>
          </div>

          {currentPatient && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: '#64748b', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: '700', color: '#1e293b' }}>
                {currentPatient.gender || 'N/A'}, {currentPatient.age ? `${currentPatient.age}y` : ''}
              </span>
              {currentPatient.bloodtype && (
                <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '1px 4px', borderRadius: '3px', fontSize: '9.5px', fontWeight: '700', border: '1px solid #bfdbfe' }}>
                  {currentPatient.bloodtype}
                </span>
              )}
              {currentPatient.primaryDiagnosis && (
                <span style={{ fontSize: '10px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis' }} title={currentPatient.primaryDiagnosis}>
                  • {currentPatient.primaryDiagnosis}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 3D Model Visualizer (Height adjusted to fit neatly with top patient bar) */}
        <div style={{ flex: 1, minHeight: '180px', width: '100%', position: 'relative', overflow: 'hidden' }}>
          <ModelViewer 
            organ_colors={patientOrganColors} 
            hour={hour} 
            selectedMesh={selectedMesh} 
            setSelectedMesh={setSelectedMesh}
            patientId={currentPatient?.id}
            organToMetrics={currentPatientOrganToMetrics}
            csvByMetric={patientCsvByMetric}
            normalRanges={normalRanges}
          />
        </div>

        {/* Hourly Timeline Slider */}
        <HourlySlider 
          hour={hour} 
          setHour={setHour} 
          isPlaying={isPlaying} 
          setIsPlaying={setIsPlaying} 
          max_hour={patientMaxHour} 
          currentBounds={currentBounds}
          setCurrentBounds={setCurrentBounds}
        />
      </div>

      {/* Middle Column: Metric Charts & Clinical Chat */}
      <div className="mid-panel">
        <MiddlePanel 
          hour={hour} 
          csvByMetric={patientCsvByMetric} 
          normalRanges={normalRanges} 
          currentBounds={currentBounds} 
          max_hour={patientMaxHour} 
          chatCollapsed={chatCollapsed}
          setChatCollapsed={setChatCollapsed}
          selectedMesh={selectedMesh}
        />
      </div>

      {/* Right Column: Model Details & In-Context Validation (Only rendered when ML Model is configured) */}
      {hasModel && (
        <div className="right-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', minHeight: '34px' }}>
            <h2 style={{ margin: 0, color: '#1e3a8a', fontSize: '18px', fontWeight: '700' }}>
              ML Model (supplied by ML Scientist)
            </h2>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', padding: '3px 8px', borderRadius: '12px' }}>
              
            </span>
          </div>

          {/* Model Details & Integrated Clinical Validation */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <ModelDetails 
              patientData={currentPatient} 
              modelResult={modelResult} 
              loading={loading} 
              hour={hour}
              allPatients={allPatients}
              currentPatientIndex={currentPatientIndex}
              setCurrentPatientIndex={setCurrentPatientIndex}
              annotationsByPatient={annotationsByPatient}
              updateGlobalAnnotation={updateGlobalAnnotation}
              customRationaleTags={customRationaleTags}
              setCustomRationaleTags={setCustomRationaleTags}
              validationCollapsed={annotateCollapsed}
              setValidationCollapsed={setAnnotateCollapsed}
            />
          </div>

          <button onClick={downloadFHIR} className="download-btn" style={{ marginTop: '4px', flexShrink: 0 }}>
            Export Validation via FHIR
          </button>
        </div>
      )}
    </div>
  );
}

export default App;