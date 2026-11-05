import React, { useState, useRef } from "react";
import { UploadCloud, Plus, FileSpreadsheet, LayoutGrid, Move, Check } from "lucide-react";
import {
  inspectUpload,
  commitUpload,
  cancelUpload,
  deleteCard,
  updateDashboardLayout,
} from "../../services/api";
import { SheetPickerModal } from "./SheetPickerModal";
import { ConfirmDialog } from "../common/ConfirmDialog";
import type { TableItem, CardItem, FilterItem, MetricItem, UploadInspection, RelationshipItem } from "../../types/larper";
import { ParameterBar } from "../parameters/ParameterBar";
import { CanvasCardRenderer } from "./CanvasCardRenderer";
import { CardBuilderModal } from "../CardBuilder/CardBuilderModal";
import { GridLayout } from "../grid/GridLayout";
import type { Layout } from "react-grid-layout";

export interface CanvasViewProps {
  dashboardId: string;
  tables: TableItem[];
  cards: CardItem[];
  filters: FilterItem[];
  metrics: MetricItem[];
  relationships?: RelationshipItem[];
  onRefresh: () => void;
  onLayoutSaved?: (layouts: { id: string; x: number; y: number; w: number; h: number }[]) => void;
}
export const CanvasView: React.FC<CanvasViewProps> = ({
  dashboardId,
  tables,
  cards,
  filters,
  metrics,
  relationships = [],
  onRefresh,
  onLayoutSaved,
}) => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState<boolean>(false);
  const [isEditingLayout, setIsEditingLayout] = useState<boolean>(true);
  const [editingCard, setEditingCard] = useState<CardItem | null>(null);
  const [activeFilterValues, setActiveFilterValues] = useState<Record<string, unknown>>({});
  const [pendingInspection, setPendingInspection] = useState<UploadInspection | null>(null);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const [isDeletingCard, setIsDeletingCard] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLayoutChange = async (layouts: Layout[]) => {
    const payload = layouts.map((l) => ({
      id: l.i,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
    }));
    try {
      await updateDashboardLayout(dashboardId, payload);
      onLayoutSaved?.(payload);
    } catch (err) {
      console.error("Failed to save layout:", err);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const inspection = await inspectUpload(dashboardId, file);
      if (inspection.is_excel) {
        setPendingInspection(inspection);
        return;
      }
      const result = await commitUpload(
        dashboardId,
        inspection.upload_id,
        inspection.sheets.map((sheet) => sheet.name)
      );
      onRefresh();
      if (result.skipped.length > 0) {
        alert(
          `Imported ${result.tables.length} table(s).\n\n` + result.skipped.join("\n")
        );
      }
    } catch (err: unknown) {
      alert(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmSheets = async (sheets: string[]) => {
    if (!pendingInspection) return;
    setIsUploading(true);
    try {
      const result = await commitUpload(
        dashboardId,
        pendingInspection.upload_id,
        sheets
      );
      setPendingInspection(null);
      onRefresh();
      if (result.skipped.length > 0) {
        alert(
          `Imported ${result.tables.length} table(s).\n\n` + result.skipped.join("\n")
        );
      }
    } catch (err: unknown) {
      alert(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelSheets = () => {
    if (pendingInspection) {
      void cancelUpload(dashboardId, pendingInspection.upload_id);
    }
    setPendingInspection(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDeleteCard = (cardId: string) => {
    setCardToDelete(cardId);
  };

  const handleConfirmDeleteCard = async () => {
    if (!cardToDelete) return;
    setIsDeletingCard(true);
    try {
      await deleteCard(dashboardId, cardToDelete);
      setCardToDelete(null);
      onRefresh();
    } catch (err: unknown) {
      alert(`Failed to delete card: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeletingCard(false);
    }
  };

  // If no tables uploaded yet -> Empty Canvas Dropzone
  if (tables.length === 0) {
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          borderRadius: "var(--mb-radius-card)",
          border: "2px dashed #cbd5e1",
          padding: "5rem 2rem",
          textAlign: "center",
          boxShadow: "var(--mb-shadow-card)",
          margin: "1rem 0",
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(80, 158, 227, 0.12)",
            color: "var(--mb-color-brand)",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1rem",
          }}
        >
          <UploadCloud size={32} />
        </div>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--mb-color-text-primary)", marginBottom: "0.5rem" }}>
          Upload Data to Build Your Dashboard
        </h3>
        <p style={{ fontSize: "0.875rem", color: "var(--mb-color-text-muted)", maxWidth: "480px", marginBottom: "1.5rem" }}>
          Drag and drop a <strong>.csv</strong> or <strong>.xlsx</strong> file here, or browse files on your computer.
          Your data is automatically ingested into high-speed Parquet storage.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.json"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            backgroundColor: "var(--mb-color-brand)",
            color: "#ffffff",
            border: "none",
            borderRadius: "var(--mb-radius-btn)",
            padding: "0.625rem 1.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: isUploading ? "not-allowed" : "pointer",
            boxShadow: "0 2px 4px rgba(80, 158, 227, 0.3)",
          }}
        >
          <FileSpreadsheet size={16} />
          {isUploading ? "Ingesting Table..." : "Browse Files"}
        </button>

        {pendingInspection && (
          <SheetPickerModal
            filename={pendingInspection.filename}
            sheets={pendingInspection.sheets}
            isImporting={isUploading}
            onCancel={handleCancelSheets}
            onConfirm={handleConfirmSheets}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "3rem" }}>
      {/* Canvas Top Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#ffffff",
          padding: "0.75rem 1.25rem",
          borderRadius: "var(--mb-radius-card)",
          border: "1px solid var(--mb-color-border-card)",
          boxShadow: "var(--mb-shadow-card)",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <LayoutGrid size={18} color="var(--mb-color-brand)" />
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
            Canvas Cards ({cards.length})
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--mb-color-text-muted)" }}>
            | Active Table: <strong>{tables[0]?.display_name}</strong> ({tables[0]?.row_count.toLocaleString()} rows)
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              backgroundColor: "transparent",
              border: "1px solid var(--mb-color-border-card)",
              borderRadius: "var(--mb-radius-btn)",
              padding: "0.375rem 0.75rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--mb-color-text-secondary)",
              cursor: "pointer",
            }}
          >
            <UploadCloud size={13} />
            {isUploading ? "Uploading..." : "+ Add Another CSV"}
          </button>

          {/* Metabase Drag & Resize Layout Toggle */}
          {cards.length > 0 && (
            <button
              type="button"
              onClick={() => setIsEditingLayout(!isEditingLayout)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                backgroundColor: isEditingLayout ? "var(--mb-color-brand)" : "#ffffff",
                color: isEditingLayout ? "#ffffff" : "var(--mb-color-text-secondary)",
                border: isEditingLayout ? "none" : "1px solid var(--mb-color-border-card)",
                borderRadius: "var(--mb-radius-btn)",
                padding: "0.375rem 0.75rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: isEditingLayout ? "0 1px 3px rgba(80, 158, 227, 0.4)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {isEditingLayout ? <Check size={13} /> : <Move size={13} />}
              {isEditingLayout ? "Lock Canvas (View Only)" : "Unlock Canvas (Rearrange)"}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setEditingCard(null);
              setIsBuilderOpen(true);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              backgroundColor: "var(--mb-color-brand)",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--mb-radius-btn)",
              padding: "0.4rem 1rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(80, 158, 227, 0.3)",
            }}
          >
            <Plus size={14} />
            Add Visual Card
          </button>
        </div>
      </div>

      {/* Metabase Replicated Filter & Parameter Bar */}
      {tables.length > 0 && (
        <ParameterBar
          dashboardId={dashboardId}
          filters={filters}
          activeValues={activeFilterValues}
          onFilterChange={(filterId, val) => {
            setActiveFilterValues((prev) => ({ ...prev, [filterId]: val }));
          }}
          onResetAll={() => setActiveFilterValues({})}
          tables={tables}
          onRefreshFilters={onRefresh}
          isEditing={isEditingLayout}
        />
      )}

      {/* Cards Grid */}
      {cards.length === 0 ? (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "var(--mb-radius-card)",
            border: "1px dashed #cbd5e1",
            padding: "4rem 2rem",
            textAlign: "center",
          }}
        >
          <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--mb-color-text-primary)", marginBottom: "0.5rem" }}>
            Ready to Build!
          </h4>
          <p style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", maxWidth: "420px", margin: "0 auto 1.25rem auto" }}>
            Table <strong>{tables[0]?.display_name}</strong> is loaded with {tables[0]?.columns.length} columns. Click "+ Add Visual Card" to configure and place your first chart.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingCard(null);
              setIsBuilderOpen(true);
            }}
            style={{
              backgroundColor: "var(--mb-color-brand)",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--mb-radius-btn)",
              padding: "0.5rem 1.25rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add First Visual Card
          </button>
        </div>
      ) : (
        <GridLayout
          cards={cards}
          isEditing={isEditingLayout}
          onLayoutChange={handleLayoutChange}
          renderCard={(card) => (
            <CanvasCardRenderer
              dashboardId={dashboardId}
              card={card}
              onDelete={handleDeleteCard}
              onEdit={(c) => {
                setEditingCard(c);
                setIsBuilderOpen(true);
              }}
              isEditing={isEditingLayout}
              activeFilters={activeFilterValues}
              dashboardFilters={filters}
            />
          )}
        />
      )}

      {/* Visual Card Creator / Editor Modal */}
      <CardBuilderModal
        dashboardId={dashboardId}
        tables={tables}
        relationships={relationships}
        metrics={metrics}
        isOpen={isBuilderOpen}
        onClose={() => {
          setIsBuilderOpen(false);
          setEditingCard(null);
        }}
        onCardCreated={onRefresh}
        editingCard={editingCard}
      />

      {pendingInspection && (
        <SheetPickerModal
          filename={pendingInspection.filename}
          sheets={pendingInspection.sheets}
          isImporting={isUploading}
          onCancel={handleCancelSheets}
          onConfirm={handleConfirmSheets}
        />
      )}

      <ConfirmDialog
        isOpen={cardToDelete !== null}
        title="Delete this visual card?"
        message="This removes the card from the dashboard. The underlying table and other cards stay untouched."
        confirmLabel="Delete card"
        isBusy={isDeletingCard}
        onCancel={() => setCardToDelete(null)}
        onConfirm={handleConfirmDeleteCard}
      />
    </div>
  );
};
