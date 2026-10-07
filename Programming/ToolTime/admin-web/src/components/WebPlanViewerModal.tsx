import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { PlanDocument, Room, PlanLevel } from '../types';
import { 
  X, 
  Maximize2, 
  Home, 
  FileText, 
  Compass
} from 'lucide-react';
import { generateCadVectorFromRooms } from '../services/dwgParser';

interface WebPlanViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanDocument | null;
  initialRoom?: Room | null;
  projectName?: string;
  rooms?: Room[];
}

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 750;

export const WebPlanViewerModal: React.FC<WebPlanViewerModalProps> = ({
  isOpen,
  onClose,
  plan,
  initialRoom = null,
  projectName = 'Bauvorhaben',
  rooms = []
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });

  // Autodesk Platform Services (APS) Viewer State
  const [viewMode, setViewMode] = useState<'aps' | 'svg'>('aps');
  const [isApsLoading, setIsApsLoading] = useState<boolean>(false);
  const [apsError, setApsError] = useState<string | null>(null);
  const apsContainerRef = useRef<HTMLDivElement>(null);
  const apsViewerInstance = useRef<any>(null);

  // Sync default viewMode with plan apsUrn
  useEffect(() => {
    if (plan?.apsUrn) {
      setViewMode('aps');
    } else {
      setViewMode('svg');
    }
  }, [plan?.apsUrn, plan?.id]);

  // Load and initialize official Autodesk Viewer SDK
  useEffect(() => {
    if (!isOpen || viewMode !== 'aps' || !plan?.apsUrn) return;

    let isMounted = true;
    setIsApsLoading(true);
    setApsError(null);

    const initApsViewer = async () => {
      try {
        // 1. Inject Autodesk Viewing CSS & JS dynamically if not already in document
        if (!(window as any).Autodesk?.Viewing) {
          await new Promise<void>((resolve, reject) => {
            const existingScript = document.getElementById('aps-viewer-script');
            if (existingScript) {
              existingScript.addEventListener('load', () => resolve());
              return;
            }

            const link = document.createElement('link');
            link.id = 'aps-viewer-style';
            link.rel = 'stylesheet';
            link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css';
            document.head.appendChild(link);

            const script = document.createElement('script');
            script.id = 'aps-viewer-script';
            script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Autodesk Viewer SDK konnte nicht geladen werden'));
            document.body.appendChild(script);
          });
        }

        if (!isMounted) return;

        // 2. Initializer options with token provider
        const Autodesk = (window as any).Autodesk;
        const options = {
          env: 'AutodeskProduction2',
          api: 'streamingV2',
          getAccessToken: async (onTokenReady: (token: string, expires: number) => void) => {
            try {
              const res = await fetch('http://localhost:3001/api/aps/token');
              const data = await res.json();
              if (data.access_token) {
                onTokenReady(data.access_token, data.expires_in || 3600);
              }
            } catch (err) {
              console.error('Failed to get APS viewer token from backend:', err);
            }
          }
        };

        Autodesk.Viewing.Initializer(options, () => {
          if (!isMounted || !apsContainerRef.current) return;

          // Destroy previous viewer instance if exists
          if (apsViewerInstance.current) {
            try {
              apsViewerInstance.current.finish();
            } catch {}
            apsViewerInstance.current = null;
          }

          const viewer = new Autodesk.Viewing.GuiViewer3D(apsContainerRef.current);
          const startCode = viewer.start();
          if (startCode > 0) {
            console.error('Failed to start Autodesk Viewer, code:', startCode);
            return;
          }
          apsViewerInstance.current = viewer;

          const documentId = 'urn:' + plan.apsUrn;
          Autodesk.Viewing.Document.load(
            documentId,
            (doc: any) => {
              if (!isMounted) return;
              const defaultModel = doc.getRoot().getDefaultGeometry();
              viewer.loadDocumentNode(doc, defaultModel);
              setIsApsLoading(false);
            },
            (errorCode: any) => {
              console.warn('Autodesk Document Load Warning:', errorCode);
              if (isMounted) {
                setIsApsLoading(false);
                setApsError('Modell wird noch verarbeitet oder konnte nicht geladen werden.');
              }
            }
          );
        });
      } catch (err: any) {
        if (isMounted) {
          setIsApsLoading(false);
          setApsError(err.message || 'Autodesk Viewer Fehler');
        }
      }
    };

    initApsViewer();

    return () => {
      isMounted = false;
      if (apsViewerInstance.current) {
        try {
          apsViewerInstance.current.finish();
          apsViewerInstance.current = null;
        } catch {}
      }
    };
  }, [isOpen, viewMode, plan?.apsUrn, plan?.id]);

  const vectorData = useMemo(() => {
    if (plan?.vectorData && Array.isArray(plan.vectorData.rooms) && plan.vectorData.rooms.length > 0) {
      return plan.vectorData;
    }
    // Fallback: Generate live CAD vector from current project rooms for this floor
    const floorLabel = (plan?.floor || plan?.level || initialRoom?.floor || 'EG') as PlanLevel;
    const matchingRooms = rooms && rooms.length > 0
      ? rooms.filter(r => (r.floor || 'EG') === floorLabel)
      : (initialRoom ? [initialRoom] : []);
    
    return generateCadVectorFromRooms(
      matchingRooms.length > 0 ? matchingRooms : rooms,
      floorLabel
    );
  }, [plan, rooms, initialRoom]);

  const floorLabel = plan?.floor || plan?.level || initialRoom?.floor || 'EG';

  // Find target room in vectorData
  const targetVectorRoom = useMemo(() => {
    if (!initialRoom || !vectorData?.rooms) return null;
    return vectorData.rooms.find(r => 
      (initialRoom.id && r.id === initialRoom.id) ||
      (initialRoom.code && r.code && r.code.toLowerCase() === initialRoom.code.toLowerCase()) ||
      (initialRoom.name && r.name && (
        r.name.toLowerCase() === initialRoom.name.toLowerCase() ||
        r.name.toLowerCase().includes(initialRoom.name.toLowerCase()) ||
        initialRoom.name.toLowerCase().includes(r.name.toLowerCase())
      ))
    );
  }, [initialRoom, vectorData]);

  // Calculate container fit scale
  const getFitScale = useCallback(() => {
    if (!containerRef.current) return 0.85;
    const rect = containerRef.current.getBoundingClientRect();
    const w = rect.width > 100 ? rect.width : window.innerWidth * 0.8;
    const h = rect.height > 100 ? rect.height : window.innerHeight * 0.7;
    return Math.max(0.3, Math.min((w - 40) / CANVAS_WIDTH, (h - 40) / CANVAS_HEIGHT));
  }, []);

  const focusOnRoom = useCallback((r: { x: number; y: number; width: number; height: number }, targetScale = 1.35) => {
    const rx = r.x + r.width / 2;
    const ry = r.y + r.height / 2;
    const panX = (CANVAS_WIDTH / 2 - rx) * targetScale;
    const panY = (CANVAS_HEIGHT / 2 - ry) * targetScale;
    setScale(targetScale);
    setPan({ x: panX, y: panY });
  }, []);

  const handleFitScreen = useCallback(() => {
    const fit = getFitScale();
    setScale(fit);
    setPan({ x: 0, y: 0 });
  }, [getFitScale]);

  // Initial positioning on open
  useEffect(() => {
    if (isOpen) {
      // Short delay to ensure containerRef is rendered
      const timer = setTimeout(() => {
        if (targetVectorRoom) {
          focusOnRoom(targetVectorRoom);
        } else {
          handleFitScreen();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, targetVectorRoom, handleFitScreen, focusOnRoom]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only primary click
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setScale(prev => Math.min(5.0, Math.max(0.2, prev * zoomFactor)));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-[#090D16] w-full max-w-6xl h-[92vh] rounded-2xl shadow-2xl border border-slate-700/80 flex flex-col overflow-hidden">
        
        {/* Top Header Bar */}
        <div className="bg-[#0F172A] border-b border-slate-800 px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  {plan?.name || `Montageplan ${floorLabel}`}
                </h3>
                <span className="bg-[#0284C7] text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">
                  {floorLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
                <span>Vorhaben: <strong className="text-slate-300">{projectName}</strong></span>
                {plan?.fileName && (
                  <span>• Datei: <span className="text-slate-400 font-mono text-[11px]">{plan.fileName}</span></span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {plan?.apsUrn && (
              <div className="flex items-center bg-slate-800/90 rounded-xl p-0.5 border border-slate-700 mr-1">
                <button
                  type="button"
                  onClick={() => setViewMode('aps')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'aps'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Originale AutoCAD Vektoransicht (Autodesk Platform Services)"
                >
                  AutoCAD Original
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('svg')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'svg'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Schematische Raumaufteilung"
                >
                  Montage-Schema
                </button>
              </div>
            )}

            {(plan?.pdfUrl || plan?.downloadUrl) && !(plan.pdfUrl || plan.downloadUrl)?.startsWith('file://') && (
              <a
                href={plan.pdfUrl || plan.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
                title="Vektorisiertes Original-PDF in neuem Tab öffnen"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Original-PDF</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              title="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Room Focus Sub-Banner */}
        {initialRoom && (
          <div className="bg-blue-950/40 border-b border-blue-900/40 px-5 py-2 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center space-x-2 text-blue-200">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Fokus-Raum:</span>
              <strong className="text-white font-bold">{initialRoom.name}</strong>
              {initialRoom.code && (
                <span className="text-blue-400 font-mono">({initialRoom.code})</span>
              )}
            </div>
            {targetVectorRoom && (
              <button
                type="button"
                onClick={() => focusOnRoom(targetVectorRoom)}
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline underline-offset-2 cursor-pointer"
              >
                Raum erneut zentrieren
              </button>
            )}
          </div>
        )}

        {/* Viewport: Either Autodesk Official Viewer OR SVG Blueprint */}
        {viewMode === 'aps' && plan?.apsUrn ? (
          <div className="flex-1 relative w-full h-full bg-[#090D16] overflow-hidden">
            {isApsLoading && (
              <div className="absolute inset-0 bg-[#090D16]/90 z-20 flex flex-col items-center justify-center space-y-3">
                <div className="w-9 h-9 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-300 font-semibold tracking-wide">
                  Lade originalen AutoCAD-Plan über Autodesk Cloud...
                </p>
                <p className="text-[11px] text-slate-500">
                  Vollständige Vektoren, Layer, Schraffuren & Bemaßung
                </p>
              </div>
            )}
            {apsError && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-950/90 border border-amber-600 text-amber-200 px-4 py-2.5 rounded-xl text-xs flex items-center space-x-3 shadow-xl">
                <span>⚠️ {apsError}</span>
                <button
                  type="button"
                  onClick={() => setViewMode('svg')}
                  className="bg-amber-800 hover:bg-amber-700 text-white px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer"
                >
                  Zu Montage-Schema wechseln
                </button>
              </div>
            )}
            <div ref={apsContainerRef} className="w-full h-full" />
          </div>
        ) : (
          <>
            {/* CAD Canvas Viewport */}
            <div 
              ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className={`flex-1 overflow-hidden relative flex items-center justify-center bg-[#090D16] select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <div
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
            className="shrink-0 flex items-center justify-center"
          >
            <svg
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              viewBox="0 0 1000 750"
              className="drop-shadow-2xl"
            >
              {/* Dark Blueprint Grid Background */}
              <rect width="1000" height="750" fill="#0F172A" />

              {/* Grid Lines */}
              {Array.from({ length: 20 }).map((_, i) => (
                <line
                  key={`gx_${i}`}
                  x1={i * 50}
                  y1="0"
                  x2={i * 50}
                  y2="750"
                  stroke="#1E293B"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              ))}
              {Array.from({ length: 15 }).map((_, i) => (
                <line
                  key={`gy_${i}`}
                  x1="0"
                  y1={i * 50}
                  x2="1000"
                  y2={i * 50}
                  stroke="#1E293B"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              ))}

              {/* Outer Plan Border */}
              <rect
                x="25"
                y="25"
                width="950"
                height="700"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2.5"
              />

              {vectorData ? (
                <>
                  {/* 1. ROOMS */}
                  {vectorData.rooms?.map((r, i) => {
                    const isCurrent = Boolean(
                      initialRoom && (
                        (initialRoom.id && r.id && initialRoom.id === r.id) ||
                        (initialRoom.code && r.code && initialRoom.code.toLowerCase() === r.code.toLowerCase()) ||
                        (initialRoom.name && r.name && initialRoom.name.toLowerCase() === r.name.toLowerCase())
                      )
                    );
                    return (
                      <g key={`vr_${r.id || i}`}>
                        <rect
                          x={r.x}
                          y={r.y}
                          width={r.width}
                          height={r.height}
                          fill={isCurrent ? 'rgba(56, 189, 248, 0.22)' : (r.color || '#1E293B')}
                          stroke={isCurrent ? '#38BDF8' : '#475569'}
                          strokeWidth={isCurrent ? 3.5 : 1.5}
                          rx={3}
                        />
                        {isCurrent && (
                          <g>
                            <rect
                              x={r.x + 8}
                              y={r.y + 8}
                              width={95}
                              height={18}
                              fill="#0284C7"
                              rx={4}
                            />
                            <text
                              x={r.x + 12}
                              y={r.y + 20}
                              fill="#FFFFFF"
                              fontSize={9}
                              fontWeight="bold"
                            >
                              ★ Aktueller Raum
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* 2. WALLS */}
                  {vectorData.walls?.map((w, i) => (
                    <line
                      key={`vw_${i}`}
                      x1={w.x1}
                      y1={w.y1}
                      x2={w.x2}
                      y2={w.y2}
                      stroke={w.layer?.includes('VORWAND') ? '#38BDF8' : w.layer?.includes('AUSSEN') ? '#94A3B8' : '#64748B'}
                      strokeWidth={w.strokeWidth || 2}
                    />
                  ))}

                  {/* 3. PIPES & TRASSEN */}
                  {vectorData.pipes?.map((p, i) => {
                    const mx = (p.x1 + p.x2) / 2;
                    const my = (p.y1 + p.y2) / 2;
                    return (
                      <g key={`vp_${p.id || i}`}>
                        <line
                          x1={p.x1}
                          y1={p.y1}
                          x2={p.x2}
                          y2={p.y2}
                          stroke={p.color}
                          strokeWidth={p.strokeWidth || 3}
                        />
                        <circle cx={p.x1} cy={p.y1} r={(p.strokeWidth || 3) / 1.5} fill={p.color} />
                        <circle cx={p.x2} cy={p.y2} r={(p.strokeWidth || 3) / 1.5} fill={p.color} />
                        {p.label && (
                          <g>
                            <rect
                              x={mx - 38}
                              y={my - 8}
                              width={76}
                              height={16}
                              fill={p.color}
                              rx={3}
                            />
                            <text
                              x={mx}
                              y={my + 3.5}
                              fill="#FFFFFF"
                              fontSize={8.5}
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {p.label}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* 4. DEVICES & FIXTURES */}
                  {vectorData.devices?.map((d, i) => {
                    if (d.type === 'verteiler') {
                      return (
                        <g key={`vd_${i}`}>
                          <rect x={d.x} y={d.y} width={110} height={55} fill="#0F766E" stroke="#2DD4BF" strokeWidth={2} rx={4} />
                          <text x={d.x + 8} y={d.y + 22} fill="#FFFFFF" fontSize={10} fontWeight="bold">
                            VERTEILER
                          </text>
                          <text x={d.x + 8} y={d.y + 38} fill="#99F6E4" fontSize={9}>
                            {d.label || 'V-' + floorLabel}
                          </text>
                        </g>
                      );
                    }
                    if (d.type === 'wc') {
                      return (
                        <g key={`vd_${i}`}>
                          <circle cx={d.x} cy={d.y} r={9} fill="#3B82F6" stroke="#93C5FD" strokeWidth={1.5} />
                          <text x={d.x + 13} y={d.y + 4} fill="#E2E8F0" fontSize={9}>
                            {d.label || 'WC'}
                          </text>
                        </g>
                      );
                    }
                    if (d.type === 'waschtisch') {
                      return (
                        <g key={`vd_${i}`}>
                          <rect x={d.x - 10} y={d.y - 6} width={20} height={12} fill="#38BDF8" rx={3} />
                          <text x={d.x + 14} y={d.y + 4} fill="#E2E8F0" fontSize={9}>
                            {d.label || 'WT'}
                          </text>
                        </g>
                      );
                    }
                    if (d.type === 'dusche') {
                      return (
                        <g key={`vd_${i}`}>
                          <rect x={d.x - 16} y={d.y - 16} width={32} height={32} fill="#0284C7" stroke="#38BDF8" strokeWidth={1.5} rx={3} />
                          <line x1={d.x - 16} y1={d.y - 16} x2={d.x + 16} y2={d.y + 16} stroke="#38BDF8" strokeWidth={0.8} strokeDasharray="2,2" />
                          <line x1={d.x - 16} y1={d.y + 16} x2={d.x + 16} y2={d.y - 16} stroke="#38BDF8" strokeWidth={0.8} strokeDasharray="2,2" />
                          <circle cx={d.x} cy={d.y} r={3} fill="#FFFFFF" />
                          <text x={d.x} y={d.y + 24} fill="#E2E8F0" fontSize={8} textAnchor="middle">
                            {d.label || 'Dusche'}
                          </text>
                        </g>
                      );
                    }
                    if (d.type === 'badewanne') {
                      return (
                        <g key={`vd_${i}`}>
                          <rect x={d.x - 24} y={d.y - 12} width={48} height={24} fill="#0369A1" stroke="#38BDF8" strokeWidth={1.5} rx={6} />
                          <circle cx={d.x + 15} cy={d.y} r={2.5} fill="#FFFFFF" />
                          <text x={d.x} y={d.y + 20} fill="#E2E8F0" fontSize={8} textAnchor="middle">
                            {d.label || 'Wanne'}
                          </text>
                        </g>
                      );
                    }
                    return (
                      <g key={`vd_${i}`}>
                        <circle cx={d.x} cy={d.y} r={12} fill="#0369A1" stroke="#38BDF8" strokeWidth={1.5} />
                        <text x={d.x} y={d.y + 3} fill="#FFFFFF" fontSize={8} textAnchor="middle">
                          {d.label || d.type}
                        </text>
                      </g>
                    );
                  })}

                  {/* 5. LABELS */}
                  {vectorData.labels?.map((l, i) => (
                    <text
                      key={`vl_${i}`}
                      x={l.x}
                      y={l.y}
                      fill={l.color || '#E2E8F0'}
                      fontSize={l.size || 11}
                      fontWeight={l.bold ? 'bold' : 'normal'}
                    >
                      {l.text}
                    </text>
                  ))}

                  {/* Title Block Bottom Right */}
                  <rect x="640" y="610" width="310" height="90" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.5" rx={4} />
                  <text x="655" y="635" fill="#38BDF8" fontSize="13" fontWeight="bold">
                    BURK HAUSTECHNIK GMBH
                  </text>
                  <text x="655" y="655" fill="#E2E8F0" fontSize="11">
                    Vorhaben: {projectName} · {floorLabel}
                  </text>
                  <text x="655" y="675" fill="#94A3B8" fontSize="10">
                    Plan: {plan?.name || `Montageplan ${floorLabel}`} · CAD Vektor-Modell
                  </text>
                  <text x="655" y="692" fill="#22C55E" fontSize="9">
                    ✓ Freigegeben zur Montage · Stand 2026
                  </text>
                </>
              ) : (
                /* Fallback Graphic if no vector data */
                <g>
                  <rect x="100" y="100" width="800" height="550" fill="#1E293B" stroke="#475569" strokeWidth="2" rx={4} />
                  <text x="500" y="375" fill="#94A3B8" fontSize="16" fontWeight="bold" textAnchor="middle">
                    Keine CAD-Vektordaten hinterlegt
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Floating Controls Bar at Bottom */}
        <div className="bg-[#0F172A] border-t border-slate-800 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setScale(prev => Math.max(0.25, prev - 0.3))}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center font-bold text-base transition-colors"
              title="Herauszoomen"
            >
              −
            </button>
            <span className="text-xs font-mono font-bold text-slate-300 px-2 min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale(prev => Math.min(5.0, prev + 0.3))}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center font-bold text-base transition-colors"
              title="Heranzoomen"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleFitScreen}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 transition-colors ml-2"
              title="Gesamten Plan einpassen"
            >
              <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Ganzes Geschoss</span>
            </button>
            {targetVectorRoom && (
              <button
                type="button"
                onClick={() => focusOnRoom(targetVectorRoom)}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-colors"
                title="Direkt auf diesen Raum zentrieren"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Raum-Fokus</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400 hidden sm:block">
            Mausrad zum Zoomen • Klicken & Ziehen zum Verschieben
          </div>
        </div>
        </>
      )}

      </div>
    </div>
  );
};
