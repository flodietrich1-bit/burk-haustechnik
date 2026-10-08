import React, { useState, useRef, useEffect } from 'react';
import type { PlanDocument, Room } from '../types';
import { 
  X, 
  FileText, 
  Compass,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface WebPlanViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanDocument | null;
  initialRoom?: Room | null;
  projectName?: string;
  rooms?: Room[];
}

export const WebPlanViewerModal: React.FC<WebPlanViewerModalProps> = ({
  isOpen,
  onClose,
  plan,
  projectName = 'Bauvorhaben'
}) => {
  // Autodesk Platform Services (APS) Viewer State
  const [isApsLoading, setIsApsLoading] = useState<boolean>(true);
  const [apsStatus, setApsStatus] = useState<'checking' | 'inprogress' | 'success' | 'failed' | null>(null);
  const [apsProgress, setApsProgress] = useState<string>('');
  const [apsError, setApsError] = useState<string | null>(null);
  const apsContainerRef = useRef<HTMLDivElement>(null);
  const apsViewerInstance = useRef<any>(null);

  const floorLabel = plan?.floor || plan?.level || 'EG';

  // Load and initialize official Autodesk Viewer SDK with manifest check & polling
  useEffect(() => {
    if (!isOpen) return;

    if (!plan?.apsUrn) {
      setIsApsLoading(false);
      setApsStatus(null);
      setApsError(null);
      return;
    }

    let isMounted = true;
    let pollTimer: any = null;
    setIsApsLoading(true);
    setApsError(null);
    setApsStatus('checking');

    const checkManifestAndInit = async () => {
      try {
        // A. Check manifest status from backend
        let isReady = false;
        try {
          const manifestRes = await fetch(`http://localhost:3001/api/aps/manifest/${plan.apsUrn}`);
          if (manifestRes.ok) {
            const manifestData = await manifestRes.json();
            if (manifestData.status === 'success') {
              isReady = true;
              setApsStatus('success');
            } else if (manifestData.status === 'inprogress') {
              setApsStatus('inprogress');
              setApsProgress(manifestData.progress || 'wird berechnet...');
              // Poll manifest every 3 seconds
              pollTimer = setInterval(async () => {
                if (!isMounted) return;
                try {
                  const pollRes = await fetch(`http://localhost:3001/api/aps/manifest/${plan.apsUrn}`);
                  if (pollRes.ok) {
                    const pData = await pollRes.json();
                    if (pData.status === 'success') {
                      clearInterval(pollTimer);
                      pollTimer = null;
                      if (isMounted) {
                        setApsStatus('success');
                        loadModelIntoViewer();
                      }
                    } else if (pData.status === 'inprogress') {
                      if (isMounted) setApsProgress(pData.progress || 'wird berechnet...');
                    } else if (pData.status === 'failed') {
                      clearInterval(pollTimer);
                      pollTimer = null;
                      if (isMounted) {
                        setIsApsLoading(false);
                        setApsStatus('failed');
                        setApsError('Konvertierung in Autodesk fehlgeschlagen.');
                      }
                    }
                  }
                } catch {}
              }, 3000);
            }
          }
        } catch (e) {
          console.warn('Could not check manifest status, proceeding to viewer directly:', e);
          isReady = true;
        }

        // B. Ensure Autodesk Viewing CSS & JS are present in document
        if (!(window as any).Autodesk?.Viewing) {
          await new Promise<void>((resolve, reject) => {
            if ((window as any).Autodesk?.Viewing) {
              resolve();
              return;
            }
            const existingScript = document.getElementById('aps-viewer-script') as HTMLScriptElement | null;
            if (existingScript) {
              existingScript.addEventListener('load', () => resolve(), { once: true });
              setTimeout(() => {
                if ((window as any).Autodesk?.Viewing) resolve();
              }, 1500);
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

        // C. If already ready, start viewer immediately
        if (isReady) {
          loadModelIntoViewer();
        }
      } catch (err: any) {
        if (isMounted) {
          setIsApsLoading(false);
          setApsError(err.message || 'Autodesk Viewer Fehler');
        }
      }
    };

    const loadModelIntoViewer = () => {
      const Autodesk = (window as any).Autodesk;
      if (!Autodesk?.Viewing) {
        setIsApsLoading(false);
        setApsError('Autodesk Viewer SDK nicht geladen.');
        return;
      }

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
          setIsApsLoading(false);
          setApsError('Autodesk Viewer Initialisierung fehlgeschlagen.');
          return;
        }
        apsViewerInstance.current = viewer;

        const documentId = 'urn:' + plan.apsUrn;
        Autodesk.Viewing.Document.load(
          documentId,
          (doc: any) => {
            if (!isMounted) return;
            let viewable = doc.getRoot().getDefaultGeometry();
            if (!viewable) {
              const views2d = doc.getRoot().search({ role: '2d' });
              if (views2d && views2d.length > 0) {
                viewable = views2d[0];
              } else {
                const geometries = doc.getRoot().search({ type: 'geometry' });
                if (geometries && geometries.length > 0) {
                  viewable = geometries[0];
                }
              }
            }

            if (viewable) {
              viewer.loadDocumentNode(doc, viewable).then(() => {
                if (isMounted) setIsApsLoading(false);
              }).catch(() => {
                if (isMounted) setIsApsLoading(false);
              });
              setTimeout(() => {
                if (isMounted) setIsApsLoading(false);
              }, 2000);
            } else {
              setIsApsLoading(false);
              setApsError('Keine 2D-Ansicht in der AutoCAD-Datei gefunden.');
            }
          },
          (errorCode: any, errorMsg: any) => {
            console.warn('Autodesk Document Load Warning:', errorCode, errorMsg);
            if (isMounted) {
              setIsApsLoading(false);
              setApsError('Modell konnte nicht geladen werden (' + (errorMsg || errorCode) + ').');
            }
          }
        );
      });
    };

    checkManifestAndInit();

    return () => {
      isMounted = false;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (apsViewerInstance.current) {
        try {
          apsViewerInstance.current.finish();
          apsViewerInstance.current = null;
        } catch {}
      }
    };
  }, [isOpen, plan?.apsUrn, plan?.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#090D16] border border-slate-800 rounded-2xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header Bar */}
        <div className="bg-[#0F172A] border-b border-slate-800 px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  {plan?.title || plan?.name || `AutoCAD Plan ${floorLabel}`}
                </h3>
                <span className="bg-[#0284C7] text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">
                  {floorLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
                <span>Vorhaben: <strong className="text-slate-300">{projectName}</strong></span>
                {(plan?.sourceFileName || plan?.fileName) && (
                  <span>• Datei: <span className="text-slate-400 font-mono text-[11px]">{plan.sourceFileName || plan.fileName}</span></span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
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
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport: Official Autodesk WebGL Viewer */}
        <div className="flex-1 relative w-full h-full bg-[#090D16] overflow-hidden">
          {isApsLoading && (
            <div className="absolute inset-0 bg-[#090D16]/95 z-20 flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-lg mx-auto">
              <div className="relative">
                <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-100">
                  {apsStatus === 'inprogress' 
                    ? 'Autodesk Cloud berechnet originale DWG-Vektoren...' 
                    : 'Lade originalen AutoCAD-Plan...'}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {apsStatus === 'inprogress'
                    ? 'Aufgrund der Dateigröße und Detailtiefe (Wände, Schraffuren, Rohrnetze) bereitet Autodesk den Plan vor.'
                    : 'Vollständige Vektoren, Layer, Schraffuren, Sanitärobjekte & Bemaßung.'}
                </p>
                {apsStatus === 'inprogress' && (
                  <div className="inline-flex items-center space-x-1.5 bg-blue-950/70 border border-blue-500/30 text-blue-300 px-3 py-1 rounded-full text-[11px] font-mono mt-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <span>Status: {apsProgress || 'wird verarbeitet...'}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {apsError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-950/90 border border-amber-600 text-amber-200 px-4 py-2.5 rounded-xl text-xs flex items-center space-x-3 shadow-xl">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{apsError}</span>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="bg-amber-800 hover:bg-amber-700 text-white px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Neu laden</span>
              </button>
            </div>
          )}

          {!plan?.apsUrn && !isApsLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <p className="text-sm font-semibold text-slate-300">Kein AutoCAD-Plan hinterlegt</p>
              <p className="text-xs text-slate-500 mt-1">Lade eine DWG-Datei hoch, um den Ausführungsplan anzuzeigen.</p>
            </div>
          )}

          {/* Container for Autodesk GuiViewer3D */}
          <div ref={apsContainerRef} className="w-full h-full" />
        </div>

      </div>
    </div>
  );
};
