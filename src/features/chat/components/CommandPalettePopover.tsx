import React, { useEffect, useRef } from 'react';
import type { CommandDefinition } from '@core/commands/types';
import { getCommandSourceLabel } from '@core/commands/registry';

export interface CommandPalettePopoverProps {
  commands: CommandDefinition[];
  selectedIndex: number;
  onSelectCommand: (command: CommandDefinition) => void;
  locale?: 'es' | 'en';
}

export const CommandPalettePopover: React.FC<CommandPalettePopoverProps> = ({
  commands,
  selectedIndex,
  onSelectCommand,
  locale = 'es',
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector<HTMLElement>(
        `[data-index="${selectedIndex}"]`
      );
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (commands.length === 0) {
    return null;
  }

  return (
    <div className="command-palette-popover" role="listbox" aria-label="Comandos disponibles">
      <div className="command-palette-header">
        <span className="command-palette-title">
          {locale === 'es' ? 'Comandos reconocidos' : 'Recognized commands'}
        </span>
        <span className="command-palette-hint">
          {locale === 'es' ? '↑↓ navegar · ↵ seleccionar · esc cerrar' : '↑↓ navigate · ↵ select · esc dismiss'}
        </span>
      </div>

      <div ref={listRef} className="command-palette-list">
        {commands.map((cmd, idx) => {
          const isSelected = idx === selectedIndex;
          const sourceLabel = getCommandSourceLabel(cmd.source, locale);
          const desc = locale === 'en' ? cmd.descriptionEn : cmd.description;

          return (
            <div
              key={cmd.id}
              data-index={idx}
              role="option"
              aria-selected={isSelected}
              className={`command-palette-item ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelectCommand(cmd)}
            >
              <div className="command-item-main">
                <span className="command-item-name">{cmd.name}</span>
                <span className={`command-source-badge source-${cmd.source}`}>
                  {sourceLabel}
                </span>
                {cmd.usage && cmd.usage !== cmd.name && (
                  <span className="command-item-usage">{cmd.usage}</span>
                )}
              </div>
              <div className="command-item-desc" title={desc}>
                {desc}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
