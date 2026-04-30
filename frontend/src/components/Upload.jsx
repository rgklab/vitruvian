import React, { useState } from 'react';
import axios from 'axios';

function Upload({ onUploadSuccess }) {
  // ML Scientist Column State
  const [modelName, setModelName] = useState('');
  const [modelPort, setModelPort] = useState('');
  const [modelFile, setModelFile] = useState(null);

  // Clinician Column State
  const [fhirFiles, setFhirFiles] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isSepsisDemoPort = modelPort.trim() === '8000';

  const handlePortChange = (e) => {
    const val = e.target.value;
    setModelPort(val);
    if (val.trim() === '8000') {
      setModelName('Sepsis Risk Predictor (5-Vital)');
    } else if (modelName === 'Sepsis Risk Predictor (5-Vital)') {
      setModelName('');
    }
  };

  const getModelConfig = () => {
    const trimmedPort = modelPort.trim();
    if (trimmedPort !== '8000') {
      return null;
    }
    return {
      modelName: modelName.trim() || 'Sepsis Risk Predictor (5-Vital)',
      port: 8000,
      url: 'http://127.0.0.1:8000',
      hasModel: true
    };
  };

  const handleModelFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setModelFile(e.target.files[0]);
    }
  };

  // 1. Clinician: Load Demo Synthetic Patient Cohort
  const handleLoadDemoCohort = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = process.env.REACT_APP_API_URL 
        ? `${process.env.REACT_APP_API_URL}/upload-sample-fhir` 
        : '/upload-sample-fhir';
      const res = await axios.post(endpoint);
      if (onUploadSuccess) {
        onUploadSuccess(res.data, getModelConfig());
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load demo patient cohort. Ensure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Clinician: Upload Custom FHIR
  const handleCustomFhirUpload = async () => {
    if (!fhirFiles || fhirFiles.length === 0) {
      alert('Please select a FHIR JSON bundle or folder.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      for (let i = 0; i < fhirFiles.length; i++) {
        formData.append('fhir_files', fhirFiles[i]);
      }
      const endpoint = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/upload` : '/upload';
      const res = await axios.post(endpoint, formData);
      if (onUploadSuccess) {
        onUploadSuccess(res.data, getModelConfig());
      }
    } catch (err) {
      setError(err.response?.data?.error || 'FHIR upload failed. Verify file validity.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      color: '#0f172a',
      fontFamily: 'Inter, system-ui, sans-serif',
      boxSizing: 'border-box'
    }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '35px' }}>
        <h1 style={{
          fontSize: '34px',
          fontWeight: '900',
          color: '#1e3a8a',
          margin: '0 0 8px 0',
          letterSpacing: '1px'
        }}>
          VITRUVIAN
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#475569',
          maxWidth: '680px',
          margin: '0 auto',
          lineHeight: '1.5'
        }}>
          An Interactive, Clinician-Friendly Platform for Demonstrating Healthcare ML Models
        </p>
      </div>

      {/* Global Alerts */}
      {loading && (
        <div style={{
          marginBottom: '20px',
          padding: '12px 24px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          color: '#1d4ed8',
          fontWeight: '600',
          fontSize: '14px',
          boxShadow: '0 2px 4px rgba(37,99,235,0.08)'
        }}>
          Processing dataset and initializing workspace...
        </div>
      )}

      {error && (
        <div style={{
          marginBottom: '20px',
          padding: '12px 24px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          color: '#b91c1c',
          fontWeight: '600',
          maxWidth: '700px',
          textAlign: 'center',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {/* Two-Column Symmetrical Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 480px))',
        gap: '30px',
        maxWidth: '1040px',
        width: '100%',
        justifyContent: 'center'
      }}>

        {/* COLUMN 1: CLINICIAN */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '30px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}>
              🩺
            </div>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Role: Clinician
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Upload Patient Dataset
              </h2>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0', lineHeight: '1.5' }}>
            Ingest patient EHR records or any dataset of your choice.
          </p>

          {/* DEMO ACTION: Primary Hero Button */}
          <div style={{
            backgroundColor: '#eff6ff',
            border: '1.5px solid #3b82f6',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            <h4 style={{ margin: '0 0 4px 0', color: '#1e3a8a', fontSize: '14px', fontWeight: '800' }}>
              Demo: Synthetic Cohort
            </h4>
            <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 12px 0' }}>
              5 synthetic patients with standardized 8-hour deterioration and recovery trajectories.
            </p>
            <button
              onClick={handleLoadDemoCohort}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 18px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.2s'
              }}
            >
              {loading ? 'Ingesting Cohort...' : 'Upload'}
            </button>
          </div>

          {/* Secondary Option: Custom Upload (FHIR Only) */}
          <div style={{ marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
              Upload Patient EHR or Dataset (FHIR)
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{
                display: 'block',
                padding: '12px',
                backgroundColor: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#475569',
                textAlign: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {fhirFiles ? `✓ ${fhirFiles.length} FHIR file(s) selected` : "Select FHIR JSON Bundle / Folder"}
                <input
                  type="file"
                  onChange={(e) => setFhirFiles(e.target.files)}
                  multiple
                  accept=".json"
                  style={{ display: 'none' }}
                />
              </label>
              <button
                onClick={handleCustomFhirUpload}
                disabled={loading || !fhirFiles}
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#ffffff',
                  color: '#2563eb',
                  border: '1px solid #2563eb',
                  borderRadius: '6px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: (!fhirFiles || loading) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Upload
              </button>
            </div>
          </div>
        </div>

        {/* COLUMN 2: ML SCIENTIST */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '30px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}>
              🧑‍💻
            </div>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Role: ML Scientist
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Upload / Connect ML Model
              </h2>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0', lineHeight: '1.5' }}>
            Specify the local or remote port listening for live inference requests.
          </p>

          {/* Model Port Field */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Inference Server Port (Demo)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontFamily: 'monospace' }}>http://127.0.0.1:</span>
              <input
                type="text"
                value={modelPort}
                onChange={handlePortChange}
                placeholder="8000"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: isSepsisDemoPort ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: isSepsisDemoPort ? '#eff6ff' : '#ffffff',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  fontWeight: '700',
                  color: isSepsisDemoPort ? '#1d4ed8' : '#1e293b',
                  transition: 'all 0.2s'
                }}
              />
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
              Demo: Enter port <code style={{ backgroundColor: '#f1f5f9', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>8000</code> to connect Sepsis Risk Predictor
            </span>
          </div>

          {/* Model Name Field */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Model Name / Tag
            </label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder={isSepsisDemoPort ? "Sepsis Risk Predictor (5-Vital)" : ""}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: isSepsisDemoPort ? '600' : 'normal',
                color: isSepsisDemoPort ? '#1e3a8a' : '#1e293b',
                backgroundColor: isSepsisDemoPort ? '#f8fafc' : '#ffffff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Required Input Vitals - Pops out when port 8000 is entered */}
          <div style={{ marginBottom: '20px', minHeight: '65px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Expected Core Features
            </label>
            {isSepsisDemoPort ? (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                padding: '10px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(37,99,235,0.06)'
              }}>
                {['Heart Rate (HR)', 'Resp. Rate (RR)', 'Body Temp', 'Blood Pressure (SBP)', 'Oxygen Sat (SpO2)'].map(v => (
                  <span key={v} style={{
                    fontSize: '11px',
                    backgroundColor: '#ffffff',
                    color: '#1d4ed8',
                    padding: '4px 9px',
                    borderRadius: '6px',
                    fontWeight: '700',
                    border: '1px solid #93c5fd',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}>
                    ✓ {v}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '10px 12px',
                backgroundColor: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '12px',
                fontStyle: 'italic'
              }}>
                
              </div>
            )}
          </div>

          {/* Model Weights / Code Upload (Optional) */}
          <div style={{ marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isSepsisDemoPort ? '#10b981' : (modelPort.trim() ? '#ef4444' : '#94a3b8')
              }}></span>
              <span style={{
                fontSize: '11px',
                color: isSepsisDemoPort ? '#059669' : (modelPort.trim() ? '#dc2626' : '#64748b'),
                fontWeight: isSepsisDemoPort || modelPort.trim() ? '700' : '600'
              }}>
                {isSepsisDemoPort 
                  ? 'Live Endpoint Ready (Port 8000)' 
                  : (modelPort.trim() ? `No model found on port ${modelPort.trim()}` : 'Awaiting port configuration...')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Upload;