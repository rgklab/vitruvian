import React, { useState } from 'react';
import PatientProgressDashboard from './PatientProgressDashboard';

export default function Annotate({ 
  annotatingModels, 
  modelResult, 
  currentPatient, 
  annotationsByPatient, 
  updateGlobalAnnotation,
  allPatients,
  currentPatientIndex,
  setCurrentPatientIndex
}) {
  const [editingModels, setEditingModels] = useState([]);
  const modelsToDisplay = annotatingModels || [];
  
  // Get existing annotations for the current patient from the global state
  const patientAnnotations = annotationsByPatient[currentPatient?.id] || {};

  const toggleEdit = (model) => {
    setEditingModels(prev => 
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    );
  };

  const handleConfirm = (model) => {
    const data = patientAnnotations[model];
    if (!data?.agreement) {
      alert("Please select Agree or Disagree.");
      return;
    }
    updateGlobalAnnotation(currentPatient.id, model, { ...data, status: 'green' });
    setEditingModels(prev => prev.filter(m => m !== model));
  };

  return (
    <div style={{ color: '#0f172a', display: 'flex', flexDirection: 'column', gap: '15px' }}>
      {/* Session progress dashboard control inside Annotate */}
      <PatientProgressDashboard 
        allPatients={allPatients}
        currentPatientIndex={currentPatientIndex}
        setCurrentPatientIndex={setCurrentPatientIndex}
        annotationsByPatient={annotationsByPatient}
        annotatingModels={annotatingModels} 
      />

      {modelsToDisplay.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: '500' }}>No models selected for tracking. Click "+ Annotate Model" on the model detail cards in the center column.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {modelsToDisplay.map((model) => {
            const data = patientAnnotations[model] || { status: 'red', notes: '', agreement: null };
            const isActive = data.status !== 'green' || editingModels.includes(model);
            const statusColor = data.status === 'green' ? '#10b981' : data.status === 'orange' ? '#f59e0b' : '#cbd5e1';
            const bg = data.status === 'green' ? 'rgba(16, 185, 129, 0.04)' : '#f8fafc';

            return (
              <div key={model} style={{
                border: `1px solid ${statusColor}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                borderRadius: '8px', padding: '16px',
                backgroundColor: bg
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#1e3a8a' }}>{model}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {data.status === 'green' && (
                      <button onClick={() => toggleEdit(model)} style={styles.editBtn}>
                        {editingModels.includes(model) ? 'Close' : 'Edit'}
                      </button>
                    )}
                  </div>
                </div>

                {isActive && (
                  <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Agree/Disagree Buttons */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {['Agree', 'Disagree'].map(choice => {
                        const isSelected = data.agreement === choice;
                        const choiceColor = choice === 'Agree' ? '#10b981' : '#ef4444';
                        return (
                          <button 
                            key={choice}
                            onClick={() => updateGlobalAnnotation(currentPatient.id, model, { ...data, agreement: choice, status: 'orange' })}
                            style={{
                              ...styles.verdictBtn,
                              backgroundColor: isSelected ? choiceColor : 'transparent',
                              color: isSelected ? '#ffffff' : choiceColor,
                              borderColor: choiceColor,
                              fontSize: '12px'
                            }}
                          >
                            {choice}
                          </button>
                        );
                      })}
                    </div>
                    
                    <textarea 
                      placeholder="Enter clinical justification/rationale..."
                      value={data.notes}
                      onChange={(e) => updateGlobalAnnotation(currentPatient.id, model, { ...data, notes: e.target.value, status: 'orange' })}
                      style={styles.textarea}
                    />

                    <button onClick={() => handleConfirm(model)} style={styles.confirmBtn}>
                      Confirm for this Patient
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  textarea: { width: '100%', minHeight: '60px', backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', fontSize: '13px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  confirmBtn: { backgroundColor: '#1e3a8a', color: '#ffffff', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s', width: '100%' },
  verdictBtn: { flex: 1, padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', border: '1px solid', transition: 'all 0.2s' },
  editBtn: { background: 'none', border: '1px solid #94a3b8', color: '#64748b', cursor: 'pointer', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '500' }
};