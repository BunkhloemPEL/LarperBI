import React from "react";
import { LayoutGrid, Table2, Terminal, Link2, Layers } from "lucide-react";
import styles from "./DashboardSidebar.module.css";

export type DashboardTab = "canvas" | "data" | "python_lab" | "model" | "gallery";

export interface DashboardSidebarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  modelCount: number;
  galleryCount: number;
}

interface SidebarItem {
  id: DashboardTab;
  label: string;
  title: string;
  icon: React.ComponentType<{ size?: number | string; color?: string }>;
  badge?: number;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeTab,
  onTabChange,
  modelCount,
  galleryCount,
}) => {
  const items: SidebarItem[] = [
    { id: "canvas", label: "Canvas", title: "Dashboard Canvas", icon: LayoutGrid },
    { id: "data", label: "Data", title: "Data View (row browser)", icon: Table2 },
    { id: "python_lab", label: "Notebook", title: "Jupyter Notebook (EDA)", icon: Terminal },
    { id: "model", label: "Model", title: `Data Model (${modelCount})`, icon: Link2, badge: modelCount },
    { id: "gallery", label: "Gallery", title: `Visual Gallery (${galleryCount})`, icon: Layers, badge: galleryCount },
  ];

  return (
    <aside className={styles.rail} aria-label="Dashboard sections">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <React.Fragment key={item.id}>
            {item.id === "gallery" && <div className={styles.divider} />}
            <button
              type="button"
              onClick={() => onTabChange(item.id)}
              title={item.title}
              aria-label={item.title}
              aria-current={isActive ? "page" : undefined}
              className={`${styles.item} ${isActive ? styles.active : ""}`}
            >
              <Icon size={19} color={isActive ? "var(--mb-color-brand)" : "#64748b"} />
              <span className={styles.label}>{item.label}</span>
              {typeof item.badge === "number" && item.badge > 0 && (
                <span aria-hidden="true" className={`${styles.badge} ${isActive ? styles.badgeActive : ""}`}>
                  {item.badge}
                </span>
              )}
            </button>
          </React.Fragment>
        );
      })}
    </aside>
  );
};
