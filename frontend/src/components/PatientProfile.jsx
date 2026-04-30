import React from 'react';

export default function PatientProfile({ patientData }) {
  if (!patientData) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
        <p style={{ margin: 0, fontSize: '13px' }}>No patient profile loaded.</p>
      </div>
    );
  }

  // Helper to format values nicely
  const formatValue = (key, val) => {
    if (val === undefined || val === null) return "N/A";
    if (typeof val === 'boolean') return val ? "Yes" : "No";
    if (key.toLowerCase().includes('status') && typeof val === 'number') {
      return `Level ${val}`;
    }
    return String(val);
  };

  const coreFields = [
    { label: "Gender", value: patientData.gender, key: "gender", badge: true },
    { label: "Age", value: patientData.age ? `${patientData.age} yrs` : null, key: "age" },
    { label: "Blood Type", value: patientData.bloodtype, key: "bloodtype", badge: true },
    { label: "Height", value: patientData.height ? `${patientData.height} m` : null, key: "height" },
    { label: "Weight", value: patientData.weight ? `${patientData.weight} kg` : null, key: "weight" },
  ].filter(f => f.value !== null && f.value !== undefined);

  const clinicalFields = [
    { label: "Primary Diagnosis", value: patientData.primaryDiagnosis, key: "primaryDiagnosis" },
    { label: "Life Support", value: patientData.lifeSupport, key: "lifeSupport" },
    { label: "Diabetes Status", value: patientData.diabetesStatus, key: "diabetesStatus" },
    { label: "SBP Diagnosis", value: patientData.spontaneousBacterialPeritonitis, key: "spontaneousBacterialPeritonitis" },
    { label: "Ascites", value: patientData.ascites, key: "ascites" },
    { label: "Functional Status", value: patientData.functionalStatus, key: "functionalStatus" },
  ].filter(f => f.value !== undefined && f.value !== null);

  return (
    <div style={{ color: '#0f172a', fontFamily: 'inherit' }}>
      {/* Patient Header Card */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        marginBottom: '10px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          border: '1.5px solid #2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#2563eb',
          flexShrink: 0
        }}>
          {patientData.name ? patientData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : "?"}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <h3 style={{ margin: 0, fontSize: '14px', color: '#1e3a8a', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {patientData.name || "Unknown Patient"}
          </h3>
          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
            ID: {patientData.id || "N/A"}
          </span>
        </div>
      </div>

      {/* Demographics & Biometrics Pill Grid */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '10px 12px',
        marginBottom: '10px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
          Demographics & Biometrics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
          {coreFields.map((f) => (
            <div key={f.label} style={{ backgroundColor: '#f8fafc', padding: '6px 8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>{f.label}</div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
                {formatValue(f.key, f.value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Clinical Diagnosis / Metadata */}
      {clinicalFields.length > 0 && (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '10px 12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Clinical Indicators
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {clinicalFields.map((f) => (
              <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ color: '#64748b' }}>{f.label}:</span>
                <span style={{ fontWeight: '700', color: (f.value === 'yes' || f.value === 1 || f.value === true) ? '#ef4444' : '#0f172a' }}>
                  {formatValue(f.key, f.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

