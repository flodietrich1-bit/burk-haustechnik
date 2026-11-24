import React from 'react';
import type { Position, Project, User, MeasurementSection } from '../../types';
import { LvPositionModal } from '../lv/LvPositionModal';
import { LvAliasModal } from '../lv/LvAliasModal';
import { LvOriginalEditModal } from '../lv/LvOriginalEditModal';
import { LvExcelImportModal } from '../lv/LvExcelImportModal';
import { BillingExportModal } from '../export/BillingExportModal';

interface MaterialTableModalsProps {
  projectId: string;
  positions: Position[];
  sections: MeasurementSection[];
  project: Project | null;
  currentUser: User | null;
  isAddOpen: boolean;
  onCloseAdd: () => void;
  onSaveNew: (data: any, insertAfter?: Position) => Promise<void>;
  insertAfterTarget?: Position;
  defaultTradeTarget?: string;
  aliasModalPos: Position | null;
  aliasModalMode: 'alias' | 'info';
  onCloseAlias: () => void;
  onSaveAlias: (posId: string, updates: Partial<Position>) => Promise<void>;
  editOriginalPos: Position | null;
  onCloseOriginal: () => void;
  onSaveOriginal: (posId: string, updates: Partial<Position>) => Promise<void>;
  isExcelOpen: boolean;
  onCloseExcel: () => void;
  onImportExcel: (imported: Partial<Position>[]) => Promise<void>;
  onCleanCustom?: () => Promise<void> | void;
  isExportOpen: boolean;
  onCloseExport: () => void;
}

export const MaterialTableModals: React.FC<MaterialTableModalsProps> = ({
  projectId,
  positions,
  sections,
  project,
  currentUser,
  isAddOpen,
  onCloseAdd,
  onSaveNew,
  insertAfterTarget,
  defaultTradeTarget,
  aliasModalPos,
  aliasModalMode,
  onCloseAlias,
  onSaveAlias,
  editOriginalPos,
  onCloseOriginal,
  onSaveOriginal,
  isExcelOpen,
  onCloseExcel,
  onImportExcel,
  onCleanCustom,
  isExportOpen,
  onCloseExport
}) => {
  return (
    <>
      {isAddOpen && (
        <LvPositionModal
          isOpen={isAddOpen}
          onClose={onCloseAdd}
          onSave={onSaveNew}
          existingPositions={positions}
          insertAfterPosition={insertAfterTarget}
          defaultTradeCategory={defaultTradeTarget}
        />
      )}

      {aliasModalPos && (
        <LvAliasModal
          isOpen={Boolean(aliasModalPos)}
          onClose={onCloseAlias}
          position={aliasModalPos}
          mode={aliasModalMode}
          onSave={onSaveAlias}
        />
      )}

      {editOriginalPos && (
        <LvOriginalEditModal
          isOpen={Boolean(editOriginalPos)}
          onClose={onCloseOriginal}
          position={editOriginalPos}
          onSave={onSaveOriginal}
        />
      )}

      {isExcelOpen && projectId && (
        <LvExcelImportModal
          isOpen={isExcelOpen}
          onClose={onCloseExcel}
          existingPositions={positions}
          onImport={onImportExcel}
          onCleanCustom={onCleanCustom}
        />
      )}

      {isExportOpen && (
        <BillingExportModal
          isOpen={isExportOpen}
          onClose={onCloseExport}
          positions={positions}
          sections={sections}
          project={project || ({ id: projectId, name: 'Projekt', tenantId: '' } as any)}
          currentUser={currentUser}
        />
      )}
    </>
  );
};
