// Main.jsx
import React, { useState } from 'react';
import Upload from './components/Upload';
import App from './App';

function Main() {
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedData, setUploadedData] = useState(null);
  const [selectedOrgans, setSelectedOrgans] = useState([]);
  const [organToMetrics, setOrganToMetrics] = useState({});
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [modelConfig, setModelConfig] = useState(null);

  const handleUploadSuccess = (data, customModelConfig) => {
    setUploadedData(data);
    setOrganToMetrics(data.organ_to_metrics || {});
    setModelConfig(customModelConfig || null);
    setUploadSuccess(true);
  };

  return (
    <div>
      {!uploadSuccess ? (
        <Upload onUploadSuccess={handleUploadSuccess} />
      ) : (
        <App 
          uploadedData={uploadedData}
          selectedOrgans={selectedOrgans}
          setSelectedOrgans={setSelectedOrgans}
          organToMetrics={organToMetrics}
          csvByMetric={uploadedData?.csv_by_metric || {}}
          selectedMetrics={selectedMetrics}
          setselectedMetrics={setSelectedMetrics}
          max_hour={uploadedData.max_hour}
          organ_colors={uploadedData.organ_colors}
          common_metrics={uploadedData.common_metrics}
          normalRanges={uploadedData.normalRanges}
          modelConfig={modelConfig}
        />
      )}
    </div>
  );
}

export default Main;

