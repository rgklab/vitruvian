import React, { Suspense, useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Box3, Vector3 } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

// Data
import organGroups from './organ_system.json';

// ------------------------------- GLB (Anatomy) ----------------------------------------
function GLBModel({ groupsToShow = [], setSelectedMesh, organ_colors = {}, setHoveredMesh }) {
  const gltf = useGLTF('/models/anatomy/3d-vh-m-united.glb', true);
  const glbRef = useRef();

  //Center the GLB model precisely on mount/load
  useEffect(() => {
    if (!gltf?.scene) return;

    // Reset position and scale to default before calculating bounding box to avoid double-scaling
    gltf.scene.position.set(0, 0, 0);
    gltf.scene.scale.set(1, 1, 1);
    gltf.scene.updateMatrixWorld(true);

    // Calculate bounding parameters for the absolute dimensions of the meshes
    const box = new Box3().setFromObject(gltf.scene);
    const size = new Vector3();
    box.getSize(size);
    const center = new Vector3();
    box.getCenter(center);

    // Align base boundary to ground level (y=0) and shift center coordinates
    gltf.scene.position.y -= box.min.y;
    gltf.scene.position.x -= center.x;
    gltf.scene.position.z -= center.z;

    // Normalizing scale relative to scene boundaries
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 1.5 / maxDim; // Matches the target scale factor of your OBJ model
      gltf.scene.scale.setScalar(scale);
    }
  }, [gltf]);

  // Precompute organ system lookup map (O(N))
  const systemMeshSet = useMemo(() => {
    const activeMeshes = new Set();
    groupsToShow.forEach((system) => {
      const meshes = organGroups[system] || [];
      meshes.forEach(m => activeMeshes.add(m.toLowerCase()));
    });
    return activeMeshes;
  }, [groupsToShow]);

  // Precompute simple lookup map for colors
  const colorLookup = useMemo(() => {
    const lookup = new Map();
    Object.entries(organ_colors).forEach(([organ, colorVal]) => {
      lookup.set(organ.toLowerCase(), new THREE.Color(...colorVal));
    });
    return lookup;
  }, [organ_colors]);

  const defaultColor = useMemo(() => new THREE.Color(0.5, 0.5, 0.5), []);

  // Update Visibility and Colors without structural cloning
  useEffect(() => {
    if (!gltf?.scene) return;

    const integumentaryMeshes = organGroups['Integumentary'] || [];
    const integumentaryLower = integumentaryMeshes.map(m => m.toLowerCase());

    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        const nameLower = child.name.toLowerCase();
        const isVisible = systemMeshSet.has(nameLower);
        child.visible = isVisible;

        const isIntegumentary = integumentaryLower.some(target => nameLower.includes(target));
        child.userData.clickable = isVisible && !isIntegumentary;

        if (isVisible && child.material) {
          if (!child.userData.materialCloned) {
            child.material = Array.isArray(child.material)
              ? child.material.map(m => m.clone())
              : child.material.clone();
            child.userData.materialCloned = true;
          }

          let matchedColor = null;
          for (const [organKey, colorObj] of colorLookup.entries()) {
            if (nameLower.includes(organKey)) {
              matchedColor = colorObj;
              break;
            }
          }

          if (isIntegumentary) {
            // Render skin as a semi-transparent glass shell to expose internal organs
            child.material.transparent = true;
            child.material.opacity = 0.15;
            child.material.color.setRGB(0.8, 0.8, 0.8);
          } else {
            if (matchedColor) {
              // Render organs with data as solid colored shapes
              child.material.transparent = false;
              child.material.opacity = 1.0;
              child.material.color.copy(matchedColor);
            } else {
              // No data for this organ -> don't color it at all (remain uncolored/transparent)
              child.material.transparent = true;
              child.material.opacity = 0.15;
              child.material.color.setRGB(0.8, 0.8, 0.8);
            }
          }
        }
      }
    });
  }, [gltf, systemMeshSet, colorLookup]);

  const handleMeshClick = (event) => {
    event.stopPropagation();
    const clickedMesh = event.object;
    if (clickedMesh.userData?.clickable) {
      setSelectedMesh(clickedMesh.name);
    }
  };

  const handlePointerOver = (event) => {
    event.stopPropagation();
    const mesh = event.object;
    if (mesh.userData?.clickable) {
      setHoveredMesh(mesh.name);
    } else {
      setHoveredMesh(null);
    }
  };

  const handlePointerOut = (event) => {
    event.stopPropagation();
    setHoveredMesh(null);
  };

  return gltf?.scene ? (
    <primitive 
      ref={glbRef}
      object={gltf.scene} 
      onClick={handleMeshClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
  ) : null;
}

// ------------------------------- OBJ (Original) ----------------------------------------
function OBJModel({ setSelectedMesh, organ_colors = {}, setHoveredMesh }) {
  const obj = useLoader(OBJLoader, '/models/meshcapade/adam.obj');
  const groupRef = useRef();

  // Center model footprint once on mount
  useEffect(() => {
    if (!obj) return;

    // Reset position and scale to default before calculating bounding box to avoid double-scaling
    obj.position.set(0, 0, 0);
    obj.scale.set(1, 1, 1);
    obj.updateMatrixWorld(true);

    const box = new Box3().setFromObject(obj);
    const size = new Vector3();
    box.getSize(size);
    const center = new Vector3();
    box.getCenter(center);

    obj.position.y -= box.min.y;
    obj.position.x -= center.x;
    obj.position.z -= center.z;

    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 1.5 / maxDim;
      obj.scale.setScalar(scale);
    }
  }, [obj]);

  const meshes = useMemo(() => {
    const list = [];
    if (obj) {
      obj.traverse(child => {
        if (child.isMesh) list.push(child);
      });
    }
    return list;
  }, [obj]);

  // Precompute simple lookup map for colors
  const colorLookup = useMemo(() => {
    const lookup = new Map();
    Object.entries(organ_colors).forEach(([organ, colorVal]) => {
      lookup.set(organ.toLowerCase(), new THREE.Color(...colorVal));
    });
    return lookup;
  }, [organ_colors]);

  useEffect(() => {
    if (colorLookup.size === 0) return;

    meshes.forEach(mesh => {
      const nameLower = mesh.name.toLowerCase();
      if (mesh.material) {
        if (!mesh.userData.materialCloned) {
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(m => m.clone())
            : mesh.material.clone();
          mesh.userData.materialCloned = true;
        }

        let matchedColor = null;
        for (const [organKey, colorObj] of colorLookup.entries()) {
          if (nameLower.includes(organKey)) {
            matchedColor = colorObj;
            break;
          }
        }

        const isSkin = !nameLower.includes('heart') && !nameLower.includes('liver') && !nameLower.includes('kidney');
        if (isSkin) {
          // Render outer body/skin as a semi-transparent glass shell
          mesh.material.transparent = true;
          mesh.material.opacity = 0.15;
          mesh.material.color.setRGB(0.8, 0.8, 0.8);
        } else {
          if (matchedColor) {
            // Render organs with data as solid colored shapes
            mesh.material.transparent = false;
            mesh.material.opacity = 1.0;
            mesh.material.color.copy(matchedColor);
          } else {
            // No data for this organ -> don't color it at all (remain uncolored/transparent)
            mesh.material.transparent = true;
            mesh.material.opacity = 0.15;
            mesh.material.color.setRGB(0.8, 0.8, 0.8);
          }
        }
      }
    });
  }, [meshes, colorLookup]);

  const handlePointerOver = (event) => {
    event.stopPropagation();
    const mesh = event.object;
    const nameLower = mesh.name.toLowerCase();
    const isSkin = !nameLower.includes('heart') && !nameLower.includes('liver') && !nameLower.includes('kidney');
    if (!isSkin) {
      setHoveredMesh(mesh.name);
    } else {
      setHoveredMesh(null);
    }
  };

  const handlePointerOut = (event) => {
    event.stopPropagation();
    setHoveredMesh(null);
  };

  return (
    <group 
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        if (e.object.isMesh) {
          setSelectedMesh(e.object.name);
        }
      }}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <primitive object={obj} />
    </group>
  );
}

// ------------------------------- Viewer ----------------------------------------
const isNormal = (value, range) => {
  if (!range) return true;
  const numericVal = parseFloat(value);
  if (!isNaN(numericVal)) {
    return numericVal >= range.min && numericVal <= range.max;
  }
  const valStr = String(value).trim().toLowerCase();
  if (range.type === 'binary') {
    const mapped = ['yes', 'true', '1', 'positive', 'active', 'present'].includes(valStr) ? 1 : 0;
    return mapped >= range.min && mapped <= range.max;
  }
  if (['normal', 'negative', 'no', 'none', 'false', 'absent'].includes(valStr)) {
    return true;
  }
  return false;
};

export default function ModelViewer({ 
  organ_colors, 
  hour, 
  selectedMesh, 
  setSelectedMesh, 
  obj_mapping, 
  patientId,
  organToMetrics = {},
  csvByMetric = {},
  normalRanges = {}
}) {
  const [modelType, setModelType] = useState('obj'); 
  const controlsRef = useRef(); 
  const containerRef = useRef();
  
  const [hoveredMesh, setHoveredMesh] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const cameraStatesRef = useRef({});
  const prevPatientIdRef = useRef();

  const currentColors = useMemo(() => {
    return organ_colors[hour] || {};
  }, [organ_colors, hour]);

  const handleMouseMove = (e) => {
    setMousePosition({
      x: e.clientX,
      y: e.clientY
    });
  };

  const hoveredOrganInfo = useMemo(() => {
    if (!hoveredMesh) return null;
    const nameLower = hoveredMesh.toLowerCase();
    
    let organKey = null;
    const organsList = ['heart', 'liver', 'kidney', 'lung', 'neurological', 'general'];
    for (const key of organsList) {
      if (nameLower.includes(key)) {
        organKey = key;
        break;
      }
    }
    
    if (!organKey) return null;

    const originalOrganName = Object.keys(organToMetrics || {}).find(
      (k) => k.toLowerCase() === organKey
    ) || organKey;

    const metrics = organToMetrics?.[originalOrganName] || [];
    if (metrics.length === 0) return null;

    const metricStates = metrics.map((metric) => {
      const metricData = csvByMetric?.[metric] || [];
      const currentPoint = metricData.find((d) => Number(d.time) === hour);
      const value = currentPoint ? currentPoint.metric_value : null;
      const unit = currentPoint ? currentPoint.unit : '';
      const range = normalRanges?.[organKey]?.[metric];

      let status = 'no_data';
      if (value !== null && value !== undefined) {
        status = isNormal(value, range) ? 'normal' : 'failing';
      }

      return {
        name: metric,
        value,
        unit,
        range,
        status
      };
    });

    return {
      organName: originalOrganName,
      metrics: metricStates
    };
  }, [hoveredMesh, organToMetrics, csvByMetric, normalRanges, hour]);

  useEffect(() => {
    if (!patientId) return;

    if (!controlsRef.current) {
      prevPatientIdRef.current = patientId;
      return;
    }

    const prevId = prevPatientIdRef.current;
    if (prevId && prevId !== patientId) {
      const pos = controlsRef.current.object.position;
      const tar = controlsRef.current.target;
      cameraStatesRef.current[prevId] = {
        position: [pos.x, pos.y, pos.z],
        target: [tar.x, tar.y, tar.z]
      };
    }

    const saved = cameraStatesRef.current[patientId];
    if (saved) {
      controlsRef.current.object.position.set(saved.position[0], saved.position[1], saved.position[2]);
      controlsRef.current.target.set(saved.target[0], saved.target[1], saved.target[2]);
    } else {
      controlsRef.current.object.position.set(0, 0.8, 2.5);
      controlsRef.current.target.set(0, 0.75, 0);
    }
    controlsRef.current.update();

    prevPatientIdRef.current = patientId;
  }, [patientId]);

  const handleResetView = () => {
    if (controlsRef.current) {
      controlsRef.current.object.position.set(0, 0.8, 2.5);
      controlsRef.current.target.set(0, 0.75, 0);
      controlsRef.current.update();
    }
  };
  
  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        maxWidth: '100%',
        maxHeight: '100%',
        position: 'relative',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #cbd5e1',
        overflow: 'hidden',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)'
      }}
    >
      <Canvas
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
        camera={{ position: [0, 0.8, 2.5], fov: 50 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <Suspense fallback={null}>
          {modelType === 'glb' ? (
            <GLBModel 
              groupsToShow={['Respiratory', 'Digestive', 'Cardiovascular', 'Integumentary', 'Urinary', 'lung_test', 'Brain']}
              setSelectedMesh={setSelectedMesh}
              organ_colors={currentColors}
              setHoveredMesh={setHoveredMesh}
            />
          ) : (
            <OBJModel 
              setSelectedMesh={setSelectedMesh}
              organ_colors={currentColors}
              obj_mapping={obj_mapping}
              setHoveredMesh={setHoveredMesh}
            />
          )}
        </Suspense>
        <OrbitControls ref={controlsRef} target={[0, 0.75, 0]} />
      </Canvas>

      {hoveredOrganInfo && createPortal(
        <div style={{
          position: 'fixed',
          top: mousePosition.y + 15 + 280 > window.innerHeight ? mousePosition.y - 280 : mousePosition.y + 15,
          left: mousePosition.x + 15 + 250 > window.innerWidth ? mousePosition.x - 260 : mousePosition.x + 15,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          padding: '16px',
          color: '#ffffff',
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
          fontFamily: 'Inter, sans-serif',
          minWidth: '240px',
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '800', borderBottom: '1px solid rgba(255, 255, 255, 0.15)', paddingBottom: '6px', color: '#38bdf8', textTransform: 'capitalize', letterSpacing: '0.5px' }}>
            {hoveredOrganInfo.organName} Diagnostics
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {hoveredOrganInfo.metrics.map(m => {
              let color = '#94a3b8';
              let icon = '⚪';
              let badge = 'No Data';

              if (m.status === 'normal') {
                color = '#4ade80';
                icon = '🟢';
                badge = 'Normal';
              } else if (m.status === 'failing') {
                color = '#f87171';
                icon = '🔴';
                badge = 'Alert';
              }

              return (
                <div key={m.name} style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600' }}>
                    <span style={{ color: '#e2e8f0' }}>{m.name}</span>
                    <span style={{ color, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{icon}</span> {badge}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '10px', marginTop: '2px' }}>
                    <span>
                      Value: <strong style={{ color: m.value !== null ? '#f1f5f9' : '#94a3b8' }}>{m.value !== null ? `${m.value} ${m.unit}` : 'N/A'}</strong>
                    </span>
                    {m.range && (
                      <span>
                        Range: {m.range.min} - {m.range.max}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}

      <div style={{ position: 'absolute', bottom: '15px', left: '15px', display: 'flex', gap: '10px', zIndex: 10 }}>
        <button onClick={() => setModelType(prev => prev === 'glb' ? 'obj' : 'glb')}>
          Show {modelType === 'glb' ? 'Original' : 'Anatomy'} Model
        </button>
        <button onClick={handleResetView}>
          Reset Model
        </button>
      </div>
    </div>
  );
}