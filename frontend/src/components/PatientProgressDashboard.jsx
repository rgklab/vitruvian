import React from 'react';

export default function PatientProgressDashboard({ 
  allPatients, 
  currentPatientIndex, 
  setCurrentPatientIndex, 
  annotationsByPatient, 
  annotatingModels 
}) {
  
  // --- DOWNLOAD LOGIC ---

  const triggerDownload = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Option A: Single Patient (Merged raw data + annotations)
  const downloadCurrentPatient = () => {
    const currentPatient = allPatients[currentPatientIndex];
    if (!currentPatient) return;

    const exportData = {
      patient_info: currentPatient,
      annotations: annotationsByPatient[currentPatient.id] || {}
    };
    triggerDownload(exportData, `Patient_${currentPatient.id}_Export.json`);
  };

  // Option B: All Patients (Separated raw data and annotations keys)
  const downloadAllPatients = () => {
    const exportData = {
      metadata: {
        exported_at: new Date().toISOString(),
        total_patients: allPatients.length,
        models_tracked: annotatingModels
      },
      annotations: annotationsByPatient,
      raw_patient_data: allPatients 
    };
    triggerDownload(exportData, `Full_Session_Batch_${Date.now()}.json`);
  };

  if (!annotatingModels || annotatingModels.length === 0) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Session Control</span>
        <div style={styles.navGroup}>
          <button onClick={() => setCurrentPatientIndex(Math.max(0, currentPatientIndex - 1))} style={styles.navBtn}>←</button>
          <button onClick={() => setCurrentPatientIndex(Math.min(allPatients.length - 1, currentPatientIndex + 1))} style={styles.navBtn}>→</button>
        </div>
      </div>

      {/* Parallel Progress Bars */}
      <div style={styles.modelList}>
        {annotatingModels.map((model) => (
          <div key={model} style={styles.modelRow}>
            <div style={styles.modelLabel}>{model}</div>
            <div style={styles.segmentBar}>
              {allPatients.map((p, idx) => {
                const annotation = annotationsByPatient?.[p.id]?.[model];
                const status = annotation?.status || 'red';
                
                let statusColor = '#cbd5e1'; // Default: Grey for no validation started
                if (status === 'orange') {
                  statusColor = '#f59e0b'; // Yellow: In-progress changes, not confirmed yet
                } else if (status === 'green') {
                  statusColor = annotation?.agreement === 'Agree' ? '#10b981' : '#ef4444'; // Green/Red: Confirmed
                }

                const isCurrent = idx === currentPatientIndex;
                return (
                  <div 
                    key={p.id}
                    onClick={() => setCurrentPatientIndex(idx)}
                    style={{
                      ...styles.segment,
                      backgroundColor: statusColor,
                      border: isCurrent ? '1.5px solid #0f172a' : 'none',
                      opacity: isCurrent ? 1 : 0.6
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.infoText}>
        Focus: {allPatients[currentPatientIndex]?.name || "None"}
      </div>

      {/* Download Section */}
      <div style={styles.downloadSection}>
        <button onClick={downloadCurrentPatient} style={styles.btnSecondary}>
          Export Current Patient
        </button>
        <button onClick={downloadAllPatients} style={styles.btnPrimary}>
          Export All Patients
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '15px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  title: { fontSize: '11px', fontWeight: '700', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px' },
  navGroup: { display: 'flex', gap: '5px' },
  navBtn: { background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#1e293b', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  modelList: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' },
  modelRow: { display: 'flex', flexDirection: 'column', gap: '4px' },
  modelLabel: { fontSize: '10px', color: '#2563eb', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' },
  segmentBar: { display: 'flex', gap: '3px', height: '8px' },
  segment: { flex: 1, borderRadius: '2px', cursor: 'pointer' },
  infoText: { fontSize: '12px', color: '#475569', textAlign: 'center', marginBottom: '12px', fontWeight: '600' },
  downloadSection: { display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' },
  btnPrimary: { width: '100%', padding: '8px', backgroundColor: '#1e3a8a', border: 'none', color: '#ffffff', fontWeight: '600', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' },
  btnSecondary: { width: '100%', padding: '8px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#1e3a8a', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' },
  empty: { padding: '20px', color: '#64748b', fontSize: '12px', textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: '8px', backgroundColor: '#ffffff' }
};