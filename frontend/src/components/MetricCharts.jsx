import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ResponsiveContainer, ReferenceDot, Label
} from 'recharts';

const formatTimeLabel = (hr) => {
  if (hr === undefined || hr === null || isNaN(Number(hr))) return 'Hour 1';
  const num = Number(hr);
  if (num < 24) return `Hour ${num}`;
  const days = Math.floor(num / 24);
  const remainingHours = num % 24;
  return remainingHours > 0 ? `Day ${days} +${remainingHours}h` : `Day ${days}`;
};

const CORE_VITALS = ["HeartRate", "RespiratoryRate", "Temperature", "SystolicBloodPressure", "SpO2"];

const COMMON_PANELS = {
  "Vital Signs": ["HeartRate", "SystolicBloodPressure", "DiastolicBloodPressure", "MeanBloodPressure", "RespiratoryRate", "Temperature", "SpO2"],
  "Basic Metabolic Panel": ["Glucose", "Sodium", "Potassium", "Chloride", "Calcium", "Bicarbonate", "Lactate"],
  "Complete Blood Count (CBC)": ["WBC", "Hemoglobin", "Platelets"],
  "Kidney Function Panel": ["Creatinine", "BloodUreaNitrogen", "UrineOutput"],
  "Liver Function Panel": ["ALT", "AST", "Bilirubin", "ALP", "Albumin", "INR"],
  "Arterial Blood Gas (ABG)": ["PaO2", "PaCO2", "ph", "SpO2", "Lactate"],
  "Cardiac Markers": ["Troponin", "MeanBloodPressure", "DiastolicBloodPressure", "HeartRate"],
  "Neurological": ["GCS"]
};

const ORGAN_SYSTEMS = {
  "Heart / Cardiovascular": ["HeartRate", "SystolicBloodPressure", "DiastolicBloodPressure", "MeanBloodPressure", "Troponin"],
  "Lungs / Respiratory": ["RespiratoryRate", "SpO2", "PaO2", "PaCO2", "ph"],
  "Kidneys / Renal": ["Creatinine", "BloodUreaNitrogen", "UrineOutput"],
  "Liver / Hepatic": ["ALT", "AST", "Bilirubin", "ALP", "Albumin"],
  "Neurological": ["GCS"],
  "General / Systemic": ["Temperature", "WBC", "Hemoglobin", "Platelets", "Lactate", "Glucose", "Potassium", "Sodium", "Calcium", "Bicarbonate"]
};

export default function MetricCharts({ 
  csvByMetric, 
  hour, 
  normalRanges, 
  currentBounds, 
  max_hour,
  selectedMesh
}) {
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  // Extract and sort all metrics: 5 core vitals first, followed alphabetically by other labs
  const availableMetrics = Object.keys(csvByMetric || {})
    .filter((metric) => Array.isArray(csvByMetric[metric]) && csvByMetric[metric].length > 0)
    .sort((a, b) => {
      const idxA = CORE_VITALS.indexOf(a);
      const idxB = CORE_VITALS.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

  // Automatically sync with 3D anatomical organ clicks if user selects a mesh
  useEffect(() => {
    if (!selectedMesh) return;
    const meshLower = String(selectedMesh).toLowerCase();
    if (meshLower.includes('heart') || meshLower.includes('cardiac') || meshLower.includes('ventricle') || meshLower.includes('atrium')) {
      setSelectedFilter('organ:Heart / Cardiovascular');
    } else if (meshLower.includes('lung') || meshLower.includes('bronch') || meshLower.includes('trachea')) {
      setSelectedFilter('organ:Lungs / Respiratory');
    } else if (meshLower.includes('kidney') || meshLower.includes('renal') || meshLower.includes('ureter')) {
      setSelectedFilter('organ:Kidneys / Renal');
    } else if (meshLower.includes('liver') || meshLower.includes('hepatic') || meshLower.includes('gall')) {
      setSelectedFilter('organ:Liver / Hepatic');
    } else if (meshLower.includes('brain') || meshLower.includes('nerve') || meshLower.includes('cord') || meshLower.includes('cerebr')) {
      setSelectedFilter('organ:Neurological');
    }
  }, [selectedMesh]);

  // Compute filtered metrics based on selected dropdown filter
  let displayedMetrics = availableMetrics;
  if (selectedFilter === 'CORE_VITALS') {
    displayedMetrics = availableMetrics.filter(m => CORE_VITALS.includes(m));
  } else if (selectedFilter.startsWith('panel:')) {
    const panelKey = selectedFilter.replace('panel:', '');
    const targetList = COMMON_PANELS[panelKey] || [];
    displayedMetrics = availableMetrics.filter(m => targetList.includes(m));
  } else if (selectedFilter.startsWith('organ:')) {
    const organKey = selectedFilter.replace('organ:', '');
    const targetList = ORGAN_SYSTEMS[organKey] || [];
    displayedMetrics = availableMetrics.filter(m => targetList.includes(m));
  }

  return (
    <div style={{ width: '100%', height: '100%', boxSizing: 'border-box' }}>
      {/* Filter Toolbar (Panel/Organ Dropdown and #/# metric count badge) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor="panel-organ-select" style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
            Panel / Organ:
          </label>
          <select 
            id="panel-organ-select"
            value={selectedFilter} 
            onChange={(e) => setSelectedFilter(e.target.value)}
            style={{
              padding: '3px 8px',
              fontSize: '11.5px',
              fontWeight: '600',
              borderRadius: '6px',
              border: '1.5px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#1e3a8a',
              outline: 'none',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <optgroup label="Presets">
              <option value="ALL">All Clinical Metrics ({availableMetrics.length})</option>
              <option value="CORE_VITALS">Core Sepsis Vitals (5)</option>
            </optgroup>
            
            <optgroup label="Common Clinical Panels">
              {Object.entries(COMMON_PANELS).map(([panelName, metrics]) => {
                const count = metrics.filter(m => availableMetrics.includes(m)).length;
                return (
                  <option key={panelName} value={`panel:${panelName}`} disabled={count === 0}>
                    {panelName} ({count})
                  </option>
                );
              })}
            </optgroup>

            <optgroup label="Organ Systems">
              {Object.entries(ORGAN_SYSTEMS).map(([organName, metrics]) => {
                const count = metrics.filter(m => availableMetrics.includes(m)).length;
                return (
                  <option key={organName} value={`organ:${organName}`} disabled={count === 0}>
                    {organName} ({count})
                  </option>
                );
              })}
            </optgroup>
          </select>
        </div>

        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          {displayedMetrics.length} / {availableMetrics.length} metrics
        </span>
      </div>
      
      {/* Quick Filter Pill Buttons */}
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
        {[
          { key: 'ALL', label: `All (${availableMetrics.length})` },
          { key: 'CORE_VITALS', label: 'Core Vitals (5)' },
          { key: 'panel:Vital Signs', label: 'Vital Signs' },
          { key: 'panel:Kidney Function Panel', label: 'Renal' },
          { key: 'panel:Liver Function Panel', label: 'Liver' },
          { key: 'panel:Complete Blood Count (CBC)', label: 'CBC' },
          { key: 'panel:Arterial Blood Gas (ABG)', label: 'ABG' },
          { key: 'panel:Basic Metabolic Panel', label: 'Metabolic' },
          { key: 'panel:Cardiac Markers', label: 'Cardiac' },
          { key: 'organ:Neurological', label: 'Neuro' }
        ].map(chip => {
          const isActive = selectedFilter === chip.key;
          return (
            <button
              key={chip.key}
              onClick={() => setSelectedFilter(chip.key)}
              style={{
                padding: '2px 8px',
                fontSize: '10.5px',
                fontWeight: isActive ? '700' : '500',
                borderRadius: '12px',
                border: isActive ? '1px solid #2563eb' : '1px solid #e2e8f0',
                backgroundColor: isActive ? '#eff6ff' : '#ffffff',
                color: isActive ? '#1d4ed8' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {chip.label}
            </button>
          );
        })}
        {selectedFilter !== 'ALL' && (
          <button
            onClick={() => setSelectedFilter('ALL')}
            style={{
              padding: '2px 6px',
              fontSize: '10px',
              fontWeight: '600',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
            title="Reset filter to show all metrics"
          >
            ✕ Reset
          </button>
        )}
      </div>
      
      {displayedMetrics.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: '500' }}>No metrics available for the selected panel or organ filter.</p>
          <button 
            onClick={() => setSelectedFilter('ALL')}
            style={{ marginTop: '8px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '600', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Show All Metrics
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '10px'
        }}>
          {displayedMetrics.map((metric) => {
            const rawData = csvByMetric?.[metric];
            if (!rawData || rawData.length === 0) return null;
            
            // Defensively handle ISO datestrings, numbers, or string timestamps
            const rawTimes = rawData.map(d => d.time);
            const isNumericTimes = rawTimes.every(t => t !== undefined && t !== null && !isNaN(Number(t)));
            let localTimeMap = null;
            if (!isNumericTimes) {
              const uniqueSorted = Array.from(new Set(rawTimes)).sort((a, b) => new Date(a) - new Date(b));
              localTimeMap = new Map();
              uniqueSorted.forEach((t, idx) => localTimeMap.set(t, idx + 1));
            }

            const sortedData = [...rawData]
              .map(d => {
                let tNum = Number(d.time);
                if ((isNaN(tNum) || !Number.isFinite(tNum)) && localTimeMap) {
                  tNum = localTimeMap.get(d.time) || 1;
                }
                return {
                  ...d,
                  time: isNaN(tNum) ? 1 : tNum,
                  metric_value: Number(d.metric_value)
                };
              })
              .filter(d => !isNaN(d.metric_value))
              .sort((a, b) => a.time - b.time);

            if (sortedData.length === 0) return null;

            const dataTimes = sortedData.map(d => d.time);
            const dataMin = Math.min(...dataTimes);
            const dataMax = Math.max(...dataTimes);

            const startBound = currentBounds?.start !== undefined && !isNaN(Number(currentBounds.start)) ? Number(currentBounds.start) : dataMin;
            const endBound = currentBounds?.end !== undefined && !isNaN(Number(currentBounds.end)) ? Number(currentBounds.end) : dataMax;
            const minBound = Math.min(startBound, endBound);
            const maxBound = Math.max(startBound, endBound, minBound + 1);

            let filteredData = sortedData.filter(d => d.time >= minBound && d.time <= maxBound);
            if (filteredData.length === 0) {
              filteredData = sortedData;
            }
            
            const highlightPoint = sortedData.find((d) => Number(d.time) === Number(hour));
            const organName = sortedData[0]?.organ?.toLowerCase();
            const isCoreVital = CORE_VITALS.includes(metric);
            
            const hourlyTicks = [];
            for (let t = Math.floor(minBound); t <= Math.ceil(maxBound); t++) {
              hourlyTicks.push(t);
            }

            let range = normalRanges?.[organName]?.[metric];
            if (!range && normalRanges) {
              for (const org of Object.values(normalRanges)) {
                if (org && org[metric]) {
                  range = org[metric];
                  break;
                }
              }
            }
   
            return (
              <div 
                key={metric} 
                style={{ 
                  padding: '8px 10px', 
                  backgroundColor: '#ffffff', 
                  borderRadius: '6px', 
                  border: '1px solid #cbd5e1', 
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <span style={{ fontWeight: '800', color: '#1e3a8a', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {metric}
                    </span>
                    {isCoreVital && (
                      <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#2563eb', backgroundColor: '#eff6ff', padding: '1px 4px', borderRadius: '3px', border: '1px solid #bfdbfe', textTransform: 'uppercase' }}>
                        Vital
                      </span>
                    )}
                  </div>
                  {highlightPoint && (
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#2563eb', backgroundColor: '#f8fafc', padding: '1px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                      {highlightPoint.metric_value} {highlightPoint.unit || ''}
                    </span>
                  )}
                </div>

                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={filteredData} margin={{ top: 6, right: 10, bottom: 2, left: -22 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.05)" />
                    <XAxis 
                      dataKey="time" 
                      type="number" 
                      domain={[minBound, maxBound]}
                      ticks={hourlyTicks.length > 0 ? hourlyTicks : undefined}
                      tickFormatter={(t) => `H${t}`} 
                      stroke="#64748b" 
                      tick={{ fontSize: 9, fontWeight: '600' }}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      tick={{ fontSize: 9, fontWeight: '500' }}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip 
                      labelFormatter={(t) => `Hour ${t}`}
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '11px', padding: '4px 8px', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }} 
                    />
                    
                    {range && (
                      <ReferenceArea
                        y1={range.min}
                        y2={range.max}
                        fill="rgba(16, 185, 129, 0.12)"
                        stroke="rgba(16, 185, 129, 0.3)"
                        strokeDasharray="2 2"
                      />
                    )}

                    <Line
                      type="linear"
                      dataKey="metric_value"
                      stroke="#2563eb"
                      strokeWidth={2}
                      isAnimationActive={false} 
                      dot={{ r: 2.5, fill: '#ffffff', stroke: '#2563eb', strokeWidth: 1.5 }}
                      activeDot={{ r: 4, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 1.5 }}
                      name={metric}
                    />
                    {highlightPoint && (
                      <ReferenceDot
                        x={highlightPoint.time}
                        y={highlightPoint.metric_value}
                        r={4.5}
                        fill="#ef4444"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}