export const STYLES = `
:host {
  display: inline-flex;
  position: relative;
  z-index: 10;
  vertical-align: middle;
  align-items: center;
  justify-content: center;
  line-height: 1;
  user-select: none;
  margin-right: 6px;
  flex-shrink: 0;
}

.gff-heart-btn {
  all: unset;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  color: #5f6368;
  transition: transform 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.gff-heart-btn:hover {
  background-color: rgba(60, 64, 67, 0.08);
  transform: scale(1.08);
}

.gff-heart-btn:active {
  transform: scale(0.92);
}

.gff-heart-btn:focus-visible,
.gff-tag-chip:focus-visible,
.gff-action-btn:focus-visible,
.gff-open-lib-btn:focus-visible {
  outline: 2px solid #1a73e8;
  outline-offset: 2px;
}

.gff-heart-btn.favorited {
  color: #ea4335;
}

.gff-heart-icon {
  width: 20px;
  height: 20px;
  transition: fill 0.15s ease, stroke 0.15s ease;
}

.gff-heart-btn:not(.favorited) .gff-heart-icon {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}

.gff-heart-btn.favorited .gff-heart-icon {
  fill: currentColor;
  stroke: currentColor;
  stroke-width: 1;
}

.gff-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 210px;
  background: #ffffff;
  color: #202124;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.06);
  padding: 10px;
  z-index: 99999;
  display: none;
  flex-direction: column;
  gap: 10px;
  font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  box-sizing: border-box;
}

.gff-menu.visible {
  display: flex;
}

.gff-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gff-section-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #70757a;
  font-weight: 500;
}

.gff-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.gff-tag-chip {
  all: unset;
  display: inline-flex;
  align-items: center;
  border: 1px solid #dadce0;
  border-radius: 12px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
  background: transparent;
  color: #3c4043;
  transition: all 0.12s ease;
}

.gff-tag-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 5px;
  flex-shrink: 0;
}

.gff-tag-chip:hover {
  border-color: #1a73e8;
  color: #1a73e8;
}

.gff-tag-chip.active {
  background: #e8f0fe;
  border-color: #1a73e8;
  color: #1a73e8;
  font-weight: 500;
}

.gff-empty-tags {
  font-size: 12px;
  color: #70757a;
  line-height: 1.4;
}

.gff-open-lib-btn {
  all: unset;
  display: inline-block;
  margin-top: 4px;
  font-size: 11px;
  color: #1a73e8;
  cursor: pointer;
  text-decoration: underline;
}

.gff-open-lib-btn:hover {
  color: #1557b0;
}

.gff-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-top: 1px solid #f1f3f4;
  padding-top: 6px;
}

.gff-action-btn {
  all: unset;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #3c4043;
  transition: background 0.12s ease;
}

.gff-action-btn:hover {
  background: #f1f3f4;
  color: #202124;
}

.gff-toast {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #202124;
  color: #ffffff;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 100000;
}

.gff-toast.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(-2px);
}
`;
