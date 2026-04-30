import React from 'react';
import MetricCharts from './MetricCharts';
import Chat from './Chat';

export default function MiddlePanel({ 
  hour, 
  csvByMetric, 
  normalRanges, 
  currentBounds, 
  max_hour,
  chatCollapsed,
  setChatCollapsed,
  selectedMesh
}) {
  return (
    <div className="middle-panel-container" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
      {/* Fixed Non-Scrollable Column Header (Identical to Column 3) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', minHeight: '34px', flexShrink: 0 }}>
        <h2 style={{ margin: 0, color: '#1e3a8a', fontSize: '18px', fontWeight: '700' }}>
          Clinical Data (supplied by Clinician)
        </h2>
        
      </div>

      {/* Scrollable Metric Charts Area */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <MetricCharts 
          hour={hour} 
          csvByMetric={csvByMetric} 
          normalRanges={normalRanges} 
          currentBounds={currentBounds} 
          max_hour={max_hour} 
          selectedMesh={selectedMesh}
        />
      </div>

      {/* Bottom Section: Clinical Chat directly under metric charts */}
      <div 
        className={`collapsible-card ${chatCollapsed ? 'collapsed' : 'expanded'}`}
        style={{ 
          height: chatCollapsed ? '44px' : '310px',
          flexShrink: 0,
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div 
          className={`collapsible-header ${!chatCollapsed ? 'active-border' : ''}`}
          onClick={() => setChatCollapsed(!chatCollapsed)} 
        >
          <h3>LLM Chat</h3>
          <span className={`collapsible-chevron ${!chatCollapsed ? 'rotated' : ''}`}>▼</span>
        </div>
        <div className="collapsible-content" style={{ 
          padding: chatCollapsed ? '0' : '10px 14px',
          flex: 1,
          display: chatCollapsed ? 'none' : 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden'
        }}>
          <Chat />
        </div>
      </div>
    </div>
  );
}