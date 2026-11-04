import React, { useState, useEffect } from "react";
import ReactGridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import styles from "./GridLayout.module.css";
import type { CardItem } from "../../types/larper";

const AutoWidthGrid = WidthProvider(ReactGridLayout);

export interface GridLayoutProps {
  cards: CardItem[];
  isEditing: boolean;
  onLayoutChange: (layouts: Layout[]) => void;
  renderCard: (card: CardItem) => React.ReactNode;
}

export const GridLayout: React.FC<GridLayoutProps> = ({
  cards,
  isEditing,
  onLayoutChange,
  renderCard,
}) => {
  const buildLayout = (items: CardItem[]): Layout[] => {
    return items.map((c, idx) => ({
      i: c.id,
      x: typeof c.grid_layout?.x === "number" ? c.grid_layout.x : (idx * 6) % 18,
      y: typeof c.grid_layout?.y === "number" ? c.grid_layout.y : Math.floor(idx / 3) * 6,
      w: typeof c.grid_layout?.w === "number" ? c.grid_layout.w : 6,
      h: typeof c.grid_layout?.h === "number" ? c.grid_layout.h : 6,
      minW: 3,
      minH: 3,
    }));
  };

  const [currentLayout, setCurrentLayout] = useState<Layout[]>(buildLayout(cards));

  useEffect(() => {
    setCurrentLayout(buildLayout(cards));
  }, [cards]);

  const handleLayoutChange = (newLayout: Layout[]) => {
    setCurrentLayout(newLayout);
  };

  const commitLayout = (newLayout: Layout[]) => {
    if (isEditing) {
      onLayoutChange(newLayout);
    }
  };

  return (
    <div className={`${styles.gridContainer} ${isEditing ? styles.gridEditing : ""}`}>
      <AutoWidthGrid
        className="layout"
        layout={currentLayout}
        cols={18}
        rowHeight={50}
        margin={[16, 16]}
        isDraggable={isEditing}
        isResizable={isEditing}
        onLayoutChange={handleLayoutChange}
        onDragStart={() => document.body.classList.add("react-grid-layout-dragging")}
        onDragStop={(layout) => {
          document.body.classList.remove("react-grid-layout-dragging");
          commitLayout(layout);
        }}
        onResizeStart={() => document.body.classList.add("react-grid-layout-dragging")}
        onResizeStop={(layout) => {
          document.body.classList.remove("react-grid-layout-dragging");
          commitLayout(layout);
        }}
        draggableCancel="button, select, input, textarea, a, [data-dontdrag]"
      >
        {cards.map((card) => (
          <div key={card.id}>
            {renderCard(card)}
          </div>
        ))}
      </AutoWidthGrid>
    </div>
  );
};
