import React from 'react';
import SepsisModel from "./SepsisModel";

export default function ModelDetails({ 
  patientData, 
  modelResult, 
  loading,
  hour,
  allPatients,
  currentPatientIndex,
  setCurrentPatientIndex,
  annotationsByPatient,
  updateGlobalAnnotation,
  customRationaleTags,
  setCustomRationaleTags,
  validationCollapsed,
  setValidationCollapsed
}) {
  return (
    <div style={{ padding: '0', boxSizing: 'border-box' }}>
      <SepsisModel 
        key="sepsis" 
        patientData={patientData} 
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
        validationCollapsed={validationCollapsed}
        setValidationCollapsed={setValidationCollapsed}
      />
    </div>
  );
}