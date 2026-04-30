import React, { useState, useEffect, useMemo } from 'react';

const formatTimeLabel = (hr) => {
  if (hr === undefined || hr === null || isNaN(Number(hr))) return 'Hour 1';
  const num = Number(hr);
  if (num < 24) return `Hour ${num}`;
  const days = Math.floor(num / 24);
  const remainingHours = num % 24;
  return remainingHours > 0 ? `Day ${days} +${remainingHours}h` : `Day ${days}`;
};

const formatChunkLabel = (start, end, size) => {
  if (size >= 8760) {
    const yStart = Math.ceil(start / 8760);
    const yEnd = Math.ceil(end / 8760);
    return yStart === yEnd ? `Year ${yStart}` : `Years ${yStart}-${yEnd}`;
  }
  if (size >= 720) {
    const mStart = Math.ceil(start / 720);
    const mEnd = Math.ceil(end / 720);
    return mStart === mEnd ? `Month ${mStart}` : `Months ${mStart}-${mEnd}`;
  }
  if (size >= 24) {
    const dStart = Math.ceil(start / 24);
    const dEnd = Math.ceil(end / 24);
    return dStart === dEnd ? `Day ${dStart}` : `Days ${dStart}-${dEnd}`;
  }
  return start === end ? `Hour ${start}` : `Hours ${start}-${end}`;
};

function HourlySlider({ 
  hour, 
  setHour, 
  isPlaying, 
  setIsPlaying, 
  max_hour,
  currentBounds,      // Lifted state object: { start, end }
  setCurrentBounds   // Lifted state setter
}) {
  const [chunkSize, setChunkSize] = useState(1); // Default span size set to 1 hour
  
  // 1. Generate standard time intervals based on max_hour and chunkSize
  const timeChunks = useMemo(() => {
    const chunks = [];
    let start = 1;
    while (start <= max_hour) {
      const end = Math.min(start + chunkSize - 1, max_hour);
      chunks.push({ start, end });
      start += chunkSize;
    }
    return chunks;
  }, [max_hour, chunkSize]);

  const [selectedIndices, setSelectedIndices] = useState(() => {
    const count = Math.ceil((max_hour || 1) / 1);
    return Array.from({ length: count }, (_, i) => i);
  });

  // 2. Sync local chunk selections with the lifted parent state
  useEffect(() => {
    // Filter out indices that are out of bounds of the new timeChunks
    const validChunks = selectedIndices
      .map(idx => timeChunks[idx])
      .filter(chunk => chunk !== undefined);

    if (validChunks.length === 0) {
      setCurrentBounds({ start: 1, end: max_hour });
      return;
    }

    const starts = validChunks.map(chunk => chunk.start);
    const ends = validChunks.map(chunk => chunk.end);
    
    setCurrentBounds({
      start: Math.min(...starts),
      end: Math.max(...ends)
    });
  }, [selectedIndices, timeChunks, max_hour, setCurrentBounds]);

  // Select all chunks by default when the span configuration or patient max_hour changes
  useEffect(() => {
    const allIndices = timeChunks.map((_, idx) => idx);
    setSelectedIndices(allIndices);
    setHour(1);
  }, [chunkSize, max_hour, timeChunks.length, setHour]);

  // 3. Constrained Playback Loop (advances 1 hour per tick through selected intervals)
  useEffect(() => {
    if (!isPlaying || selectedIndices.length === 0) return;

    const interval = setInterval(() => {
      setHour((prevHour) => {
        const start = currentBounds?.start ?? 1;
        const end = currentBounds?.end ?? max_hour;

        const nextHour = prevHour + 1;
        if (nextHour > end || prevHour < start) {
          return start;
        }
        return nextHour;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, selectedIndices, setHour, currentBounds, max_hour]);

  // 4. Consecutive Multi-Selection Logic
  const handleChunkSelect = (index) => {
    if (selectedIndices.includes(index)) {
      const updated = selectedIndices.filter(i => i !== index).sort((a, b) => a - b);
      
      const isConsecutive = updated.every((val, i) => i === 0 || val === updated[i - 1] + 1);
      if (isConsecutive) {
        setSelectedIndices(updated);
        if (updated.length > 0) {
          const remainingStarts = updated.map(i => timeChunks[i].start);
          setHour(Math.min(...remainingStarts));
        } else {
          setHour(1);
        }
      } else {
        setSelectedIndices([]);
        setHour(1);
      }
    } else {
      if (selectedIndices.length === 0) {
        setSelectedIndices([index]);
        setHour(timeChunks[index].start);
      } else {
        const minSelected = Math.min(...selectedIndices);
        const maxSelected = Math.max(...selectedIndices);
        
        // Block adjacency confirmation
        if (index === minSelected - 1 || index === maxSelected + 1) {
          const updated = [...selectedIndices, index].sort((a, b) => a - b);
          setSelectedIndices(updated);
          
          const remainingStarts = updated.map(i => timeChunks[i].start);
          const currentStart = Math.min(...remainingStarts);
          if (hour < currentStart) setHour(currentStart);
        } else {
          // Break non-consecutive arrays and anchor a clean index point
          setSelectedIndices([index]);
          setHour(timeChunks[index].start);
        }
      }
    }
  };

  const handleSelectAll = () => {
    const allIndices = timeChunks.map((_, idx) => idx);
    setSelectedIndices(allIndices);
    if (timeChunks.length > 0) {
      setHour(timeChunks[0].start);
    }
  };

  const handleDeselectAll = () => {
    setSelectedIndices([]);
    setHour(1);
  };

  const activeStart = currentBounds?.start ?? 1;
  const activeEnd = currentBounds?.end ?? max_hour;
  const isDefaultRange = activeStart === 1 && activeEnd === max_hour;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <strong>Time:</strong> {formatTimeLabel(hour)} 
          {!isDefaultRange && ` (${formatChunkLabel(activeStart, activeEnd, chunkSize)})`}
        </div>
        
        <div style={styles.configGroup}>
          <label style={styles.label}>Span Size: </label>
          <select 
            value={chunkSize} 
            onChange={(e) => setChunkSize(Number(e.target.value))}
            style={styles.select}
          >
            <option value={1}>1 Hour</option>
            {[2, 4, 6, 8, 12, 24].map(sz => (
              <option key={sz} value={sz}>{sz} Hours</option>
            ))}
            <option value={720}>1 Month</option>
            <option value={4320}>6 Months</option>
            <option value={8760}>1 Year</option>
          </select>
        </div>
      </div>

      {/* Dynamic range slider mapped directly to the parent constraints */}
      <input
        type="range"
        min={activeStart}
        max={activeEnd}
        value={hour}
        onChange={(e) => setHour(Number(e.target.value))}
        step="1"
        style={{ width: '100%', cursor: 'pointer' }}
      />
      
      <div style={styles.trackLabels}>
        <span>{formatTimeLabel(activeStart)}</span>
        <span>{formatTimeLabel(activeEnd)}</span>
      </div>

      {/* Rendered Chunk Selectors */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={handleSelectAll}
            style={{
              ...styles.chunkButton,
              backgroundColor: '#f1f5f9',
              color: 'var(--color-text-main)',
              borderColor: 'var(--color-border)',
              padding: '4px 8px',
              fontSize: '10px',
              whiteSpace: 'nowrap'
            }}
          >
            Select All
          </button>
          <button
            onClick={handleDeselectAll}
            style={{
              ...styles.chunkButton,
              backgroundColor: '#f1f5f9',
              color: 'var(--color-text-main)',
              borderColor: 'var(--color-border)',
              padding: '4px 8px',
              fontSize: '10px',
              whiteSpace: 'nowrap'
            }}
          >
            Deselect All
          </button>
        </div>
        <div style={styles.chunkContainer}>
          {timeChunks.map((chunk, idx) => {
            const isSelected = selectedIndices.includes(idx);
            return (
              <button
                key={idx}
                onClick={() => handleChunkSelect(idx)}
                style={{
                  ...styles.chunkButton,
                  backgroundColor: isSelected ? '#f59e0b' : '#f1f5f9',
                  color: isSelected ? '#ffffff' : 'var(--color-text-main)',
                  borderColor: isSelected ? '#f59e0b' : 'var(--color-border)'
                }}
              >
                {formatChunkLabel(chunk.start, chunk.end, chunkSize)}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => {
          if (selectedIndices.length > 0) {
            setIsPlaying((prev) => !prev);
          }
        }}
        disabled={selectedIndices.length === 0}
        style={{
          ...styles.playBtn,
          backgroundColor: selectedIndices.length === 0 
            ? '#cbd5e1' 
            : (isPlaying ? '#ef4444' : '#10b981'),
          color: selectedIndices.length === 0 ? '#64748b' : '#ffffff',
          cursor: selectedIndices.length === 0 ? 'not-allowed' : 'pointer'
        }}
      >
        {selectedIndices.length === 0 
          ? 'Select Interval to Play' 
          : (isPlaying ? 'Pause Loop' : 'Play Selection')}
      </button>
    </div>
  );
}

const styles = {
  container: { 
    padding: '16px', 
    backgroundColor: '#ffffff', 
    borderRadius: '8px', 
    border: '1px solid var(--color-border)', 
    color: 'var(--color-text-main)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxSizing: 'border-box'
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '600' },
  configGroup: { display: 'flex', alignItems: 'center', gap: '6px' },
  label: { fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' },
  select: { backgroundColor: '#ffffff', color: 'var(--color-text-main)', border: '1px solid var(--color-border)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', outline: 'none' },
  trackLabels: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '-4px', fontWeight: '600' },
  chunkContainer: { 
    display: 'flex', 
    flexWrap: 'nowrap', 
    gap: '6px', 
    overflowX: 'auto', 
    paddingBottom: '8px', 
    scrollbarWidth: 'thin',
    WebkitOverflowScrolling: 'touch'
  },
  chunkButton: { 
    flex: '0 0 auto', 
    padding: '6px 12px', 
    border: '1px solid', 
    borderRadius: '4px', 
    cursor: 'pointer', 
    fontSize: '11px', 
    fontWeight: 'bold', 
    transition: 'all 0.2s ease',
    outline: 'none'
  },
  playBtn: { 
    width: '100%', 
    padding: '10px', 
    color: '#ffffff', 
    border: 'none', 
    borderRadius: '6px', 
    cursor: 'pointer', 
    fontWeight: '700', 
    fontSize: '13px',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  }
};

export default HourlySlider;