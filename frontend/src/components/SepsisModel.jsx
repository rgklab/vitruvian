import React, { useState } from 'react';

const DEFAULT_RATIONALE_TAGS = [
  "Elevated Vitals Confirmed",
  "Hypotension Trend",
  "Fever Spike"
];

export default function SepsisModel({ 
  patientData, 
  modelResult, 
  loading,
  hour = 1,
  allPatients = [],
  currentPatientIndex = 0,
  setCurrentPatientIndex,
  annotationsByPatient = {},
  updateGlobalAnnotation,
  customRationaleTags = [],
  setCustomRationaleTags,
  validationCollapsed,
  setValidationCollapsed
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(true);
  const isCollapsed = validationCollapsed !== undefined ? validationCollapsed : internalCollapsed;
  const toggleCollapsed = () => {
    if (setValidationCollapsed) {
      setValidationCollapsed(!isCollapsed);
    } else {
      setInternalCollapsed(!isCollapsed);
    }
  };

  const [isAddingCustomTag, setIsAddingCustomTag] = useState(false);
  const [customTagInput, setCustomTagInput] = useState("");

  const isAlert = modelResult?.assessment === 'caution';
  const isWarning = modelResult?.assessment === 'warning';
  
  const statusColor = isAlert ? '#dc2626' : (isWarning ? '#d97706' : '#16a34a');
  const statusBg = isAlert ? '#fef2f2' : (isWarning ? '#fffbeb' : '#f0fdf4');
  const statusBorder = isAlert ? '#fca5a5' : (isWarning ? '#fde68a' : '#bbf7d0');

  const features = modelResult?.features || {
    HR: { name: 'Heart Rate', value: 75, unit: 'bpm', normal_range: '60 - 100 bpm', status: 'normal', criterion: 'Within normal limits' },
    RR: { name: 'Respiratory Rate', value: 16, unit: 'breaths/min', normal_range: '12 - 20 breaths/min', status: 'normal', criterion: 'Within normal limits' },
    Temp: { name: 'Body Temperature', value: 37.0, unit: '°C', normal_range: '36.1 - 37.2 °C', status: 'normal', criterion: 'Within normal limits' },
    SBP: { name: 'Systolic Blood Pressure', value: 115, unit: 'mmHg', normal_range: '90 - 120 mmHg', status: 'normal', criterion: 'Adequate perfusion' },
    SpO2: { name: 'Oxygen Saturation', value: 98, unit: '%', normal_range: '95 - 100 %', status: 'normal', criterion: 'Normal saturation' }
  };

  const riskScorePercent = modelResult?.risk_score !== undefined 
    ? Math.round(modelResult.risk_score * 100) 
    : 15;

  const modelName = "Sepsis Risk Predictor";
  const currentAnnotation = annotationsByPatient[patientData?.id]?.[modelName] || { status: 'pending', agreement: null, notes: '', tags: [] };

  const handleVerdict = (choice) => {
    if (!updateGlobalAnnotation || !patientData?.id) return;
    const isDeselect = currentAnnotation.agreement === choice;
    updateGlobalAnnotation(patientData.id, modelName, {
      ...currentAnnotation,
      agreement: isDeselect ? null : choice,
      hour: hour,
      riskScore: riskScorePercent,
      prediction: modelResult?.prediction || "EVALUATING",
      status: isDeselect ? 'pending' : 'green',
      confirmedAt: isDeselect ? null : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString()
    });
  };

  const toggleTag = (tag) => {
    if (!updateGlobalAnnotation || !patientData?.id) return;
    const existingTags = currentAnnotation.tags || [];
    const newTags = existingTags.includes(tag) 
      ? existingTags.filter(t => t !== tag) 
      : [...existingTags, tag];
    
    updateGlobalAnnotation(patientData.id, modelName, {
      ...currentAnnotation,
      tags: newTags
    });
  };

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (!trimmed) {
      setIsAddingCustomTag(false);
      return;
    }
    // Add to global custom tags list across all patients
    if (!DEFAULT_RATIONALE_TAGS.includes(trimmed) && !customRationaleTags.includes(trimmed)) {
      if (setCustomRationaleTags) {
        setCustomRationaleTags(prev => [...prev, trimmed]);
      }
    }
    // Automatically select for current patient
    if (!currentAnnotation.tags?.includes(trimmed)) {
      toggleTag(trimmed);
    }
    setCustomTagInput("");
    setIsAddingCustomTag(false);
  };

  const handleDeleteCustomTag = (e, tagToDelete) => {
    e.stopPropagation();
    if (setCustomRationaleTags) {
      setCustomRationaleTags(prev => prev.filter(t => t !== tagToDelete));
    }
    if (currentAnnotation.tags?.includes(tagToDelete)) {
      toggleTag(tagToDelete);
    }
  };

  const handleNotesChange = (text) => {
    if (!updateGlobalAnnotation || !patientData?.id) return;
    updateGlobalAnnotation(patientData.id, modelName, {
      ...currentAnnotation,
      notes: text
    });
  };

  const isConfirmed = !!currentAnnotation.agreement && currentAnnotation.status === 'green';
  const displayedTags = Array.from(new Set([...DEFAULT_RATIONALE_TAGS, ...customRationaleTags, ...(currentAnnotation.tags || [])]));

  return (
    <div style={{ color: '#0f172a', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Box 1: Unified Model Overview & Telemetry (Header, Live Assessment, and 5 Core Vitals) */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        {/* Model Title, Endpoint, and Status Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontWeight: '800', fontSize: '16.5px', color: '#1e3a8a' }}>
              Sepsis Risk Predictor (5-Vital)
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Endpoint: http://127.0.0.1:8000
            </span>
          </div>
          {currentAnnotation.agreement === 'Agree' && (
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#15803d', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '6px', border: '1px solid #86efac' }}>
              ✓ Agreed
            </span>
          )}
          {currentAnnotation.agreement === 'Disagree' && (
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626', backgroundColor: '#fee2e2', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fca5a5' }}>
              ✕ Disagreed
            </span>
          )}
          {currentAnnotation.agreement === 'Uncertain' && (
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#b45309', backgroundColor: '#fef3c7', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fde68a' }}>
              ⚠ Uncertain
            </span>
          )}
          
        </div>

        {/* Live Risk Assessment Banner */}
        <div style={{ backgroundColor: statusBg, border: `1px solid ${statusBorder}`, padding: '14px 16px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ color: statusColor, fontWeight: '800', fontSize: '12px', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
              ML Model's Assessment for Hour {hour}
            </span>
            
          </div>

          {loading ? (
            <div style={{ color: '#64748b', fontSize: '13.5px', fontStyle: 'italic' }}>Evaluating 5-vital trajectory...</div>
          ) : (
            <>
              <div style={{ fontSize: '19px', fontWeight: '800', color: statusColor, display: 'flex', alignItems: 'center', gap: '6px' }}>
                {modelResult?.prediction || "EVALUATING"}
              </div>
              <p style={{ fontSize: '13px', color: '#334155', marginTop: '4px', marginBottom: '10px', lineHeight: '1.45' }}>
                {modelResult?.message || "Analyzing patient vital baseline..."}
              </p>

              {/* Probability Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                  <span>Sepsis Risk Probability</span>
                  <span style={{ color: statusColor }}>{riskScorePercent}%</span>
                </div>
                <div style={{ width: '100%', height: '9px', backgroundColor: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${riskScorePercent}%`,
                    height: '100%',
                    backgroundColor: statusColor,
                    borderRadius: '5px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* 5 Core Vitals Grid */}
        <div>
          <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#1e3a8a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Core Vital Feature Contributions
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: '8px' }}>
            {Object.entries(features).map(([key, f]) => {
              const isVitalAlert = f.status === 'alert';
              const isVitalWarning = f.status === 'warning';
              const cardBorder = isVitalAlert ? '#fca5a5' : (isVitalWarning ? '#fde68a' : '#e2e8f0');
              const cardBg = isVitalAlert ? '#fff5f5' : (isVitalWarning ? '#fffdf5' : '#f8fafc');
              const badgeColor = isVitalAlert ? '#dc2626' : (isVitalWarning ? '#b45309' : '#16a34a');
              const badgeBg = isVitalAlert ? '#fee2e2' : (isVitalWarning ? '#fef3c7' : '#dcfce7');

              return (
                <div key={key} style={{
                  backgroundColor: cardBg,
                  border: `1px solid ${cardBorder}`,
                  borderRadius: '6px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '800', fontSize: '12px', color: '#1e3a8a' }}>{key}</span>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: '800',
                      color: badgeColor,
                      backgroundColor: badgeBg,
                      padding: '2px 5px',
                      borderRadius: '3px',
                      textTransform: 'uppercase'
                    }}>
                      {f.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#64748b' }}>{f.name}</div>
                  <div style={{ fontSize: '14.5px', fontWeight: '800', color: '#0f172a' }}>
                    {f.value} <span style={{ fontSize: '10px', fontWeight: '500', color: '#64748b' }}>{f.unit}</span>
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748b', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '2px' }}>
                    Ref: {f.normal_range}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Box 2: Clinical Validation & Sign-Off Section */}
      <div 
        className={`collapsible-card ${isCollapsed ? 'collapsed' : 'expanded'}`}
        style={{
          backgroundColor: '#ffffff',
          border: isConfirmed ? '1.5px solid #10b981' : '1.5px solid #cbd5e1',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Collapsible Header */}
        <div 
          className={`collapsible-header ${!isCollapsed ? 'active-border' : ''}`}
          onClick={toggleCollapsed}
          style={{
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            backgroundColor: '#ffffff',
            userSelect: 'none',
            borderBottom: !isCollapsed ? '1px solid #f1f5f9' : 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Validation
            </span>
            {currentAnnotation.agreement && (
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 7px',
                borderRadius: '4px',
                backgroundColor: currentAnnotation.agreement === 'Agree' ? '#dcfce7' : (currentAnnotation.agreement === 'Disagree' ? '#fee2e2' : '#fef3c7'),
                color: currentAnnotation.agreement === 'Agree' ? '#15803d' : (currentAnnotation.agreement === 'Disagree' ? '#dc2626' : '#b45309')
              }}>
                {currentAnnotation.agreement}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isConfirmed && (
              <span style={{ fontSize: '11.5px', color: '#059669', fontWeight: '600' }}>
                Signed at {currentAnnotation.confirmedAt || 'recently'}
              </span>
            )}
            <span 
              className="collapsible-chevron"
              style={{
                transform: isCollapsed ? 'rotate(0deg)' : 'rotate(-180deg)',
                transition: 'transform 0.3s ease',
                display: 'inline-block',
                fontSize: '10px',
                color: '#64748b'
              }}
            >
              ▼
            </span>
          </div>
        </div>

        {/* Collapsible Body */}
        {!isCollapsed && (
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #f1f5f9' }}>
            {/* Interactive Cohort Patient Progress Badges */}
            {allPatients.length > 0 && (
              <div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginRight: '2px' }}>Patient:</span>
                  {allPatients.map((p, idx) => {
                    const ann = annotationsByPatient[p.id]?.[modelName];
                    const isCur = idx === currentPatientIndex;
                    const agreement = ann?.agreement;
                    
                    let pillBg = '#f1f5f9';
                    let pillColor = '#64748b';
                    let pillBorder = '#cbd5e1';
                    
                    if (agreement === 'Agree') {
                      pillBg = '#dcfce7';
                      pillColor = '#15803d';
                      pillBorder = '#86efac';
                    } else if (agreement === 'Disagree') {
                      pillBg = '#fee2e2';
                      pillColor = '#dc2626';
                      pillBorder = '#fca5a5';
                    } else if (agreement === 'Uncertain') {
                      pillBg = '#fef3c7';
                      pillColor = '#b45309';
                      pillBorder = '#fde68a';
                    }

                    if (isCur) {
                      pillBorder = '#2563eb';
                    }

                    return (
                      <button
                        key={p.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentPatientIndex && setCurrentPatientIndex(idx);
                        }}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '11.5px',
                          fontWeight: isCur ? '800' : '600',
                          backgroundColor: pillBg,
                          color: pillColor,
                          border: `1.5px solid ${pillBorder}`,
                          cursor: 'pointer',
                          outline: isCur ? '2px solid rgba(37,99,235,0.3)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                        title={`${p.name} - ${agreement ? `${agreement}` : 'Not Reviewed'}`}
                      >
                        {p.id}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Clinical Verdict Options */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                Do you agree with the ML Model's assessment?
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { label: 'Agree', icon: '✓', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
                  { label: 'Uncertain', icon: '⚠', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                  { label: 'Disagree', icon: '✕', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' }
                ].map(({ label, icon, color, bg, border }) => {
                  const isSelected = currentAnnotation.agreement === label;
                  return (
                    <button
                      key={label}
                      onClick={() => handleVerdict(label)}
                      style={{
                        padding: '9px 6px',
                        borderRadius: '6px',
                        border: isSelected ? `2px solid ${color}` : `1px solid ${border}`,
                        backgroundColor: isSelected ? color : bg,
                        color: isSelected ? '#ffffff' : color,
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>{icon}</span> {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clinical Rationale Tags */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                  Clinical Rationale / Context:
                </label>
                {!isAddingCustomTag ? (
                  <button
                    onClick={() => setIsAddingCustomTag(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      padding: '0 4px'
                    }}
                  >
                    + Custom Tag
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      placeholder="Tag name..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCustomTag();
                        if (e.key === 'Escape') {
                          setIsAddingCustomTag(false);
                          setCustomTagInput('');
                        }
                      }}
                      style={{
                        padding: '2px 6px',
                        fontSize: '11px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        outline: 'none',
                        width: '100px'
                      }}
                    />
                    <button
                      onClick={handleAddCustomTag}
                      style={{
                        padding: '2px 6px',
                        fontSize: '11px',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingCustomTag(false);
                        setCustomTagInput('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: '0 2px'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Tag Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {displayedTags.map(tag => {
                  const isSelected = (currentAnnotation.tags || []).includes(tag);
                  const isCustom = customRationaleTags.includes(tag);
                  return (
                    <div
                      key={tag}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                        border: isSelected ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11.5px',
                        fontWeight: isSelected ? '700' : '500',
                        color: isSelected ? '#1d4ed8' : '#475569',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span onClick={() => toggleTag(tag)}>
                        {isSelected ? '✓ ' : ''}{tag}
                      </span>
                      {isCustom && (
                        <button
                          onClick={(e) => handleDeleteCustomTag(e, tag)}
                          style={{
                            background: 'none',
                            fontSize: '10px',
                            padding: '0 2px',
                            color: '#64748b',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Justification Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                Notes / Justification:
              </label>
              <textarea
                value={currentAnnotation.notes || ''}
                onChange={(e) => handleNotesChange(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '68px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '12px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
