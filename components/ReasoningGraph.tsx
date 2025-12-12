import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line, Text, Float, OrbitControls, Html } from '@react-three/drei';
import type * as THREE from 'three'; // Type-only import to prevent multiple instances
import * as d3 from 'd3';
import { ExplainTrace, AppMode } from '../types';
import { RotateCw, Play, Download } from 'lucide-react';

// Define constants locally to avoid runtime import of THREE
const MOUSE = { LEFT: 0, MIDDLE: 1, RIGHT: 2, ROTATE: 0, DOLLY: 1, PAN: 2 };
const TOUCH = { ROTATE: 0, PAN: 1, DOLLY_PAN: 2, DOLLY_ROTATE: 3 };

interface Point3D { x: number; y: number; z: number; }

const distance3D = (p1: Point3D, p2: Point3D) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2) + Math.pow(p2.z - p1.z, 2));
};

interface ReasoningGraphProps {
  mode: AppMode;
  data: ExplainTrace | null;
  onCapture?: (dataUrl: string) => void;
}

// Helper to map node types to colors
const getNodeColor = (type: string) => {
  switch (type) {
    case 'intent': return '#be185d'; // Dark Pink
    case 'fact': return '#1d4ed8'; // Dark Blue
    case 'intermediate': return '#a16207'; // Dark Yellow/Brown
    case 'conclusion': return '#15803d'; // Dark Green
    case 'constraint': return '#b91c1c'; // Dark Red
    case 'context': return '#7e22ce'; // Dark Purple
    default: return '#475569'; // Slate
  }
};

// --- Idle / Thinking Particles ---
const IdleParticles = () => {
  const count = 40;
  // Use plain objects to avoid frozen object issues
  const particles = useMemo(() => {
    return new Array(count).fill(0).map(() => ({
      x: (Math.random() - 0.5) * 10,
      y: (Math.random() - 0.5) * 5,
      z: (Math.random() - 0.5) * 5,
      offset: Math.random() * 100,
      scale: 0.05 + Math.random() * 0.1,
      color: '#cbd5e1'
    }));
  }, []);

  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    groupRef.current.rotation.y = time * 0.05;
    
    // Safely update children
    const children = groupRef.current.children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const p = particles[i];
        // Use 'isMesh' property check instead of instanceof THREE.Mesh to avoid import
        if ((child as any).isMesh && p) {
             child.position.set(
                 p.x,
                 p.y + Math.sin(time + p.offset) * 0.2,
                 p.z
             );
        }
    }
  });

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[p.scale, 16, 16]} />
          <meshStandardMaterial color={p.color} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
};

const ThinkingParticles = () => {
  const count = 50;
  const particles = useMemo(() => {
    return new Array(count).fill(0).map(() => ({
      x: (Math.random() - 0.5) * 15,
      y: (Math.random() - 0.5) * 6,
      z: (Math.random() - 0.5) * 6,
      offset: Math.random() * 100,
      color: getNodeColor(['intent', 'fact', 'context'][Math.floor(Math.random() * 3)])
    }));
  }, []);

  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    groupRef.current.rotation.y = time * 0.1;
    
    const children = groupRef.current.children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const p = particles[i];
        if ((child as any).isMesh && p) {
             child.position.set(
                 p.x,
                 p.y + Math.sin(time + p.offset) * 0.5,
                 p.z
             );
        }
    }
  });

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color={p.color} />
        </mesh>
      ))}
    </group>
  );
};

// --- Visualization Graph Component ---
interface VisualizedGraphProps {
  data: ExplainTrace;
  onReplay: () => void;
}

const VisualizedGraph: React.FC<VisualizedGraphProps> = ({ data, onReplay }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [animationProgress, setAnimationProgress] = useState(0);

  // Entrance Animation
  useEffect(() => {
    setAnimationProgress(0);
    let start: number;
    let animId: number;
    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / 1500, 1); // 1.5s duration
      setAnimationProgress(d3.easeCubicOut(progress));
      
      if (progress < 1) {
        animId = requestAnimationFrame(animate);
      }
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [data, onReplay]); 
  
  // Use D3 force simulation for layout
  const layout = useMemo(() => {
    // Strict null checks to prevent crashes
    if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) {
        return { nodePositions: new Map<string, Point3D>() };
    }

    const nodes = data.nodes;
    const edges = Array.isArray(data.edges) ? data.edges : [];
    const stages = data.stages || [];

    // 1. Prepare nodes and links for D3
    const nodeIds = new Set(nodes.map(n => n.id));
    
    // Explicit shallow copy for D3 to mutate. 
    // CRITICAL: Initialize x/y with random values to avoid (0,0) singularity which causes NaNs in forceManyBody
    const d3Nodes = nodes.map(n => ({ 
        ...n,
        x: Math.random() * 10 - 5,
        y: Math.random() * 10 - 5
    })) as any[]; 

    const d3Links = edges
      .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map(e => ({ source: e.source, target: e.target, strength: e.strength }));

    // 2. Setup simulation
    // Compacted the layout by 50%
    const stageWidth = 6; 
    
    // Map stage IDs to X targets
    const stageIds = stages.map(s => s.id);
    const stageCount = stageIds.length;
    
    const stageX: Record<string, number> = {};
    if (stageCount > 0) {
        stageIds.forEach((id, index) => {
            const t = index / (stageCount - 1 || 1); 
            stageX[id] = -stageWidth/2 + t * stageWidth;
        });
    }

    try {
        const simulation = d3.forceSimulation(d3Nodes)
          // Reduced link distance to 1 (was 2)
          .force("link", d3.forceLink(d3Links).id((d: any) => d.id).distance(1).strength(0.5))
          // Reduced charge strength to -10 (was -20)
          .force("charge", d3.forceManyBody().strength(-10)) 
          .force("x", d3.forceX((d: any) => stageX[d.stage_id] || 0).strength(1.5)) 
          .force("y", d3.forceY(0).strength(0.8)) 
          // Reduced collide radius to 0.4 (was 0.6)
          .force("collide", d3.forceCollide().radius(0.4).iterations(3)) 
          .stop();

        // Run simulation synchronously with NaN check
        for (let i = 0; i < 300; i++) {
            simulation.tick();
            // Emergency break if values explode
            if (d3Nodes.length > 0 && !Number.isFinite(d3Nodes[0].x)) break;
        }
    } catch (e) {
        console.warn("D3 Simulation failed", e);
    }

    // 3. Convert back to Three.js vectors with 3D Depth
    const nodePositions = new Map<string, Point3D>();
    // Reduced Z spread to 1.5 (was 3.0)
    const zSpread = 1.5; 
    
    d3Nodes.forEach((node: any) => {
        // Strict Fallbacks and Clamping for NaN/Infinity/Overflow
        let x = Number.isFinite(node.x) ? node.x : 0;
        let y = Number.isFinite(node.y) ? node.y : 0;
        
        // Clamp values to sane ranges to prevent geometry buffer overflow
        x = Math.max(-50, Math.min(50, x));
        y = Math.max(-50, Math.min(50, y));

        // Pseudo-random Z based on ID hash or index to be deterministic
        const indexVal = node.index || 0;
        const pseudoRandomZ = ((indexVal * 1337) % 100) / 100 - 0.5;
        const z = Number.isFinite(pseudoRandomZ) ? pseudoRandomZ * zSpread : 0;
        
        nodePositions.set(node.id, { x, y, z });
    });

    return { nodePositions };
  }, [data]);

  // If layout failed or empty
  if (!data || !layout.nodePositions || layout.nodePositions.size === 0) return null;

  return (
    <group ref={groupRef}>
      {/* Edges */}
      {data.edges && data.edges.map((edge, i) => {
        const start = layout.nodePositions.get(edge.source);
        const end = layout.nodePositions.get(edge.target);
        
        // Critical safety checks for Line component
        if (!start || !end) return null;
        
        // Ensure coordinates are finite numbers
        if (!Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(start.z)) return null;
        if (!Number.isFinite(end.x) || !Number.isFinite(end.y) || !Number.isFinite(end.z)) return null;
        
        // Prevent zero-length or extremely short lines which cause buffer errors
        if (distance3D(start, end) < 0.01) return null;
        
        // Convert to array tuples to avoid Vector3 mutation issues in drei/Line
        const points: [number, number, number][] = [
            [start.x, start.y, start.z],
            [end.x, end.y, end.z]
        ];

        return (
            <Line
                key={`edge-${edge.source}-${edge.target}-${i}`}
                points={points}
                color="#94a3b8" // Slate 400
                opacity={Math.max(0.1, 0.5 * animationProgress)} // Minimum opacity
                transparent
                lineWidth={Math.max(0.1, 1 * animationProgress)} // Minimum width to avoid buffer error
            />
        );
      })}

      {/* Nodes */}
      {data.nodes && data.nodes.map((node) => {
        const pos = layout.nodePositions.get(node.id);
        if (!pos) return null;
        
        // Double check position safety
        if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return null;
        
        const scale = Math.max(0.01, animationProgress); // Avoid scale 0
        const safeImportance = Number.isFinite(node.importance) ? node.importance : 0.5;
        const safeRadius = Math.max(0.1, 0.25 + (safeImportance * 0.1)); // Ensure radius is positive

        return (
            <group key={node.id} position={[pos.x, pos.y, pos.z]} scale={[scale, scale, scale]}>
                <Float speed={2} rotationIntensity={0.1} floatIntensity={0.2}>
                    <mesh>
                        <sphereGeometry args={[safeRadius, 32, 32]} />
                        <meshStandardMaterial 
                            color={getNodeColor(node.type)} 
                            roughness={0.3}
                        />
                    </mesh>
                    <Text
                        position={[0, -0.4, 0]} // Below node
                        fontSize={0.18} // Readable size
                        color="#1e293b" // Slate 800
                        anchorX="center"
                        anchorY="top"
                        maxWidth={2.0}
                        textAlign="center"
                        outlineWidth={0.01}
                        outlineColor="#ffffff"
                    >
                        {String(node.label || "Node")} {/* Explicit string cast */}
                    </Text>
                </Float>
            </group>
        );
      })}
      
      {/* Stage Labels */}
      {(data.stages || []).map((stage) => {
         const nodesInStage = data.nodes.filter(n => n.stage_id === stage.id);
         if (nodesInStage.length === 0) return null;
         
         let sumX = 0;
         let count = 0;
         nodesInStage.forEach(n => {
             const p = layout.nodePositions.get(n.id);
             if (p) { sumX += p.x; count++; }
         });
         const avgX = count > 0 ? sumX / count : 0;
         
         if (!Number.isFinite(avgX)) return null;

         return (
             <Text
                key={stage.id}
                position={[avgX, 2.5, -2]} 
                fontSize={0.3}
                color="#334155"
                anchorX="center"
                anchorY="bottom"
                font="https://fonts.gstatic.com/s/raleway/v14/1Ptrg8zYS_SKggPNwK4vaqI.woff"
                fillOpacity={Math.max(0.01, animationProgress)}
             >
                {String(stage.label || "Stage")}
             </Text>
         );
      })}
    </group>
  );
};

export const ReasoningGraph: React.FC<ReasoningGraphProps> = React.memo(({ mode, data, onCapture }) => {
  const { gl, scene, camera } = useThree();
  const [autoRotate, setAutoRotate] = useState(false); 
  const [replayTrigger, setReplayTrigger] = useState(0);

  useEffect(() => {
    if (onCapture) {
       const timer = setTimeout(() => {
         gl.render(scene, camera);
         const dataUrl = gl.domElement.toDataURL('image/png', 0.8);
         onCapture(dataUrl);
       }, 800); 
       return () => clearTimeout(timer);
    }
  }, [onCapture, gl, scene, camera]);

  const handleDownload = () => {
    gl.render(scene, camera);
    const dataUrl = gl.domElement.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.href = dataUrl;
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    link.download = `neuroviz-reasoning-${timestamp}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Memoize controls config to avoid re-creation
  const mouseButtons = useMemo(() => ({
    LEFT: MOUSE.PAN,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.ROTATE
  }), []);
  
  const touches = useMemo(() => ({
    ONE: TOUCH.PAN,
    TWO: TOUCH.DOLLY_ROTATE
  }), []);

  return (
    <>
      <color attach="background" args={['#ffffff']} /> 
      
      <ambientLight intensity={0.9} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, 5, -10]} intensity={0.5} />
      <spotLight position={[0, 10, 0]} intensity={0.4} angle={0.5} />
      
      <OrbitControls 
        makeDefault 
        enableDamping 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        dampingFactor={0.05} 
        minDistance={2} 
        maxDistance={20} 
        autoRotate={mode === AppMode.VISUALIZING && autoRotate}
        autoRotateSpeed={1.0}
        mouseButtons={mouseButtons}
        touches={touches}
        screenSpacePanning={true} 
      />

      {mode === AppMode.IDLE && <IdleParticles />}
      {mode === AppMode.THINKING && <ThinkingParticles />}
      {mode === AppMode.VISUALIZING && data && (
        <VisualizedGraph 
            data={data} 
            onReplay={() => setReplayTrigger(prev => prev + 1)} 
            key={replayTrigger}
        />
      )}

      {/* On-screen Controls */}
      <Html fullscreen style={{ pointerEvents: 'none' }} zIndexRange={[100, 0]}>
         <div className="absolute bottom-4 right-4 flex gap-2 pointer-events-auto">
            {mode === AppMode.VISUALIZING && (
                <>
                    <button 
                        onClick={() => setAutoRotate(!autoRotate)}
                        className={`p-2 rounded-full shadow-md border transition-colors ${autoRotate ? 'bg-blue-100 text-blue-600 border-blue-300' : 'bg-white text-slate-500 border-slate-200'}`}
                        title="Toggle Auto-Rotation"
                    >
                        <RotateCw size={18} className={autoRotate ? 'animate-spin-slow' : ''} />
                    </button>
                    <button 
                        onClick={() => setReplayTrigger(prev => prev + 1)}
                        className="p-2 rounded-full shadow-md border bg-white text-slate-500 border-slate-200 hover:text-blue-600 hover:border-blue-300 transition-colors"
                        title="Replay Animation"
                    >
                        <Play size={18} />
                    </button>
                    <button 
                        onClick={handleDownload}
                        className="p-2 rounded-full shadow-md border bg-white text-slate-500 border-slate-200 hover:text-blue-600 hover:border-blue-300 transition-colors"
                        title="Download Image"
                    >
                        <Download size={18} />
                    </button>
                </>
            )}
         </div>
      </Html>
    </>
  );
});