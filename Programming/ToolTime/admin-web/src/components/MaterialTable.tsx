import React, { useState, useMemo } from 'react';
import type { Position } from '../types';
import { Package, CheckCircle, Clock, Layers, Filter } from 'lucide-react';

interface MaterialTableProps {
  positions: Position[];
  searchTerm: string;
}

export const MaterialTable: React.FC<MaterialTableProps> = ({ positions, searchTerm }) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Unique groups from data
  const groups = useMemo(() => {
    const set = new Set<string>();
    positions.forEach(p => p.group && set.add(p.group));
    return Array.from(set);
  }, [positions]);

  // Filtered positions
  const filteredPositions = useMemo(() => {
    return positions.filter(p => {
      const matchesSearch = 
        !searchTerm || 
        p.posNr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.shortText.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.group.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesGroup = selectedGroup === 'all' || p.group === selectedGroup;

      const isCompleted = p.deliveredQty >= p.qty && p.qty > 0;
      const isPartial = p.deliveredQty > 0 && p.deliveredQty < p.qty;
      const isOpen = p.deliveredQty === 0;

      const matchesStatus = 
        selectedStatus === 'all' ||
        (selectedStatus === 'completed' && isCompleted) ||
        (selectedStatus === 'partial' && isPartial) ||
        (selectedStatus === 'open' && isOpen);

      return matchesSearch && matchesGroup && matchesStatus;
    });
  }, [positions, searchTerm, selectedGroup, selectedStatus]);

  // Totals
  const totalItems = positions.length;
  const completedItems = positions.filter(p => p.deliveredQty >= p.qty && p.qty > 0).length;
  const partialItems = positions.filter(p => p.deliveredQty > 0 && p.deliveredQty < p.qty).length;
  const totalValue = positions.reduce((acc, p) => acc + (p.deliveredQty * (p.unitPrice || 0)), 0);

  return (
    <div className="space-y-6">
      
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Gesamt LV-Positionen</p>
            <p className="text-2xl font-bold text-slate-800">{totalItems}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#3B82C4] flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Teilgeliefert / In Arbeit</p>
            <p className="text-2xl font-bold text-amber-600">{partialItems}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Vollständig Verbucht</p>
            <p className="text-2xl font-bold text-[#2FA36B]">{completedItems}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#2FA36B] flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Erfasster Materialwert</p>
            <p className="text-2xl font-bold text-slate-900">{totalValue > 0 ? `${totalValue.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` : 'Auf Anfrage'}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600">
            <Filter className="w-4 h-4 text-[#3B82C4]" />
            <span>Gewerk:</span>
          </div>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
          >
            <option value="all">Alle Titel / Gewerke ({groups.length})</option>
            {groups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600 ml-2">
            <span>Status:</span>
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
          >
            <option value="all">Alle Status</option>
            <option value="open">Offen</option>
            <option value="partial">Teilgeliefert</option>
            <option value="completed">Vollständig</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Zeige <span className="font-bold text-slate-800">{filteredPositions.length}</span> von <span className="font-bold text-slate-800">{positions.length}</span> Positionen
        </div>
      </div>

      {/* Main Material Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] font-semibold uppercase border-b border-slate-200">
                <th className="py-3 px-4 w-20">Pos-Nr</th>
                <th className="py-3 px-4">Gewerk / Beschreibung</th>
                <th className="py-3 px-4 w-28 text-right">Soll</th>
                <th className="py-3 px-4 w-28 text-right">Ist Geliefert</th>
                <th className="py-3 px-4 w-40">Fortschritt</th>
                <th className="py-3 px-4 w-28 text-right">Einzelpreis</th>
                <th className="py-3 px-4 w-28 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPositions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Keine LV-Positionen für diesen Filter gefunden.
                  </td>
                </tr>
              ) : (
                filteredPositions.map((pos) => {
                  const percent = pos.qty > 0 ? Math.min(100, Math.round((pos.deliveredQty / pos.qty) * 100)) : 0;
                  const isCompleted = pos.deliveredQty >= pos.qty && pos.qty > 0;
                  const isPartial = pos.deliveredQty > 0 && pos.deliveredQty < pos.qty;

                  return (
                    <tr key={pos.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#3B82C4]">
                        {pos.posNr}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 line-clamp-1">{pos.shortText}</div>
                        <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                          <span>{pos.group}</span>
                          {pos.isCutMaterial && (
                            <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.2 rounded font-medium">
                              Verschnitt (m)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-700">
                        {pos.qty} {pos.qu}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {pos.deliveredQty} {pos.qu}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                            <span>{percent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isCompleted ? 'bg-[#2FA36B]' : isPartial ? 'bg-amber-500' : 'bg-slate-200'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-mono">
                        {pos.unitPrice ? `${pos.unitPrice.toFixed(2)} €` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isCompleted ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3" />
                            <span>Vollständig</span>
                          </span>
                        ) : isPartial ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" />
                            <span>Teilgeliefert</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            <span>Offen</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
