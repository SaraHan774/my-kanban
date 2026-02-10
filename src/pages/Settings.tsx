import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { DEFAULT_FONT_SETTINGS, FontSettings } from '@/services/configService';
import { AppSlashCommand } from '@/data/defaultSlashCommands';
import './Settings.css';

const SANS_FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Pretendard', label: 'Pretendard' },
  { value: 'Noto Sans', label: 'Noto Sans' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro' },
  { value: 'System Default', label: 'System Default' },
];

const MONO_FONT_OPTIONS = [
  { value: 'Fira Code', label: 'Fira Code' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Source Code Pro', label: 'Source Code Pro' },
];

const DEFAULT_PALETTE = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function Settings() {
  const {
    slashCommands, addSlashCommand, updateSlashCommand, removeSlashCommand, resetSlashCommands,
    pages, columnColors, setColumnColor, removeColumnColor,
    fontSettings, setFontSettings,
  } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [formKey, setFormKey] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formIcon, setFormIcon] = useState('');
  const [formInsert, setFormInsert] = useState('');
  const [formCursorOffset, setFormCursorOffset] = useState('');
  const [formError, setFormError] = useState('');

  const startEdit = (cmd: AppSlashCommand) => {
    setEditingId(cmd.id);
    setIsAdding(false);
    setFormKey(cmd.key);
    setFormLabel(cmd.label);
    setFormIcon(cmd.icon);
    setFormInsert(cmd.insert);
    setFormCursorOffset(cmd.cursorOffset?.toString() || '');
    setFormError('');
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormKey('');
    setFormLabel('');
    setFormIcon('');
    setFormInsert('');
    setFormCursorOffset('');
    setFormError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormError('');
  };

  const validateAndSave = () => {
    const key = formKey.toLowerCase().trim();

    if (!key || !formLabel.trim() || !formIcon.trim() || !formInsert) {
      setFormError('Key, Label, Icon, and Insert text are all required.');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(key)) {
      setFormError('Key must contain only lowercase letters, numbers, and hyphens.');
      return;
    }

    // Check duplicate key (exclude current editing item)
    const duplicate = slashCommands.find((c) => c.key === key && c.id !== editingId);
    if (duplicate) {
      setFormError(`Key "/${key}" is already used by "${duplicate.label}".`);
      return;
    }

    const cursorOffset = formCursorOffset ? parseInt(formCursorOffset, 10) : undefined;
    if (formCursorOffset && (isNaN(cursorOffset!) || cursorOffset! < 0)) {
      setFormError('Cursor offset must be a non-negative number.');
      return;
    }

    if (editingId) {
      const existing = slashCommands.find((c) => c.id === editingId);
      updateSlashCommand({
        id: editingId,
        key,
        label: formLabel.trim(),
        icon: formIcon.trim(),
        insert: formInsert,
        cursorOffset,
        builtin: existing?.builtin,
      });
    } else {
      addSlashCommand({
        id: `custom-${Date.now()}`,
        key,
        label: formLabel.trim(),
        icon: formIcon.trim(),
        insert: formInsert,
        cursorOffset,
      });
    }

    cancelEdit();
  };

  const handleDelete = (cmd: AppSlashCommand) => {
    if (!window.confirm(`Delete command "/${cmd.key}"?`)) return;
    removeSlashCommand(cmd.id);
    if (editingId === cmd.id) cancelEdit();
  };

  const handleReset = () => {
    if (!window.confirm('Reset all commands to defaults? Custom commands will be removed.')) return;
    resetSlashCommands();
    cancelEdit();
  };

  const renderForm = () => (
    <div className="settings-form">
      <div className="settings-form-row">
        <div className="settings-form-field">
          <label>Key</label>
          <div className="settings-key-input">
            <span className="settings-key-prefix">/</span>
            <input
              type="text"
              value={formKey}
              onChange={(e) => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="command-key"
            />
          </div>
        </div>
        <div className="settings-form-field">
          <label>Label</label>
          <input
            type="text"
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            placeholder="Display name"
          />
        </div>
        <div className="settings-form-field settings-form-field-sm">
          <label>Icon</label>
          <input
            type="text"
            value={formIcon}
            onChange={(e) => setFormIcon(e.target.value)}
            placeholder="emoji"
          />
        </div>
      </div>
      <div className="settings-form-field">
        <label>Insert Text</label>
        <textarea
          value={formInsert}
          onChange={(e) => setFormInsert(e.target.value)}
          placeholder="Text to insert when command is executed..."
          rows={3}
        />
        {formInsert && (
          <div className="settings-preview">
            <span className="settings-preview-label">Preview:</span>
            <pre>{formInsert}</pre>
          </div>
        )}
      </div>
      <div className="settings-form-field settings-form-field-sm">
        <label>Cursor Offset (from end)</label>
        <input
          type="number"
          value={formCursorOffset}
          onChange={(e) => setFormCursorOffset(e.target.value)}
          placeholder="0"
          min="0"
        />
      </div>
      {formError && <div className="settings-error">{formError}</div>}
      <div className="settings-form-actions">
        <button className="btn btn-primary" onClick={validateAndSave}>
          {editingId ? 'Update' : 'Add'}
        </button>
        <button className="btn btn-secondary" onClick={cancelEdit}>
          Cancel
        </button>
      </div>
    </div>
  );

  // Derive existing columns from all pages
  const existingColumns = Array.from(
    pages.map(p => p.kanbanColumn).filter(Boolean).reduce((map, col) => {
      const key = (col as string).toLowerCase();
      if (!map.has(key)) map.set(key, col as string);
      return map;
    }, new Map<string, string>()).values()
  );

  const getColumnColor = (col: string, idx: number) => {
    return columnColors[col.toLowerCase()] || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];
  };

  const updateFont = (patch: Partial<FontSettings>) => {
    setFontSettings({ ...fontSettings, ...patch });
  };

  const resetFontSettings = () => {
    setFontSettings(DEFAULT_FONT_SETTINGS);
  };

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <section className="settings-section">
        <div className="settings-section-header">
          <h2>Typography</h2>
          <div className="settings-section-actions">
            <button className="btn btn-secondary" onClick={resetFontSettings}>
              Reset to Defaults
            </button>
          </div>
        </div>

        <div className="settings-typography-grid">
          <div className="settings-typography-row">
            <div className="settings-typography-field">
              <label>Font Family</label>
              <select
                value={fontSettings.fontFamily}
                onChange={(e) => updateFont({ fontFamily: e.target.value })}
                className="settings-select"
              >
                {SANS_FONT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="settings-typography-field">
              <label>Monospace Font</label>
              <select
                value={fontSettings.monoFontFamily}
                onChange={(e) => updateFont({ monoFontFamily: e.target.value })}
                className="settings-select"
              >
                {MONO_FONT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-typography-row">
            <div className="settings-typography-field">
              <label>Font Size: {fontSettings.fontSize}px</label>
              <input
                type="range"
                min={12}
                max={20}
                step={1}
                value={fontSettings.fontSize}
                onChange={(e) => updateFont({ fontSize: Number(e.target.value) })}
                className="settings-range"
              />
              <div className="settings-range-labels">
                <span>12px</span>
                <span>20px</span>
              </div>
            </div>

            <div className="settings-typography-field">
              <label>Line Height: {fontSettings.lineHeight.toFixed(1)}</label>
              <input
                type="range"
                min={1.2}
                max={2.0}
                step={0.1}
                value={fontSettings.lineHeight}
                onChange={(e) => updateFont({ lineHeight: Number(e.target.value) })}
                className="settings-range"
              />
              <div className="settings-range-labels">
                <span>1.2</span>
                <span>2.0</span>
              </div>
            </div>
          </div>

          <div className="settings-typography-preview">
            <p className="settings-typography-preview-label">Preview</p>
            <p
              className="settings-typography-preview-text"
              style={{
                fontFamily: fontSettings.fontFamily === 'System Default'
                  ? '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'
                  : `'${fontSettings.fontFamily}', sans-serif`,
                fontSize: `${fontSettings.fontSize}px`,
                lineHeight: fontSettings.lineHeight,
              }}
            >
              The quick brown fox jumps over the lazy dog. 0123456789
            </p>
            <p
              className="settings-typography-preview-text"
              style={{
                fontFamily: `'${fontSettings.monoFontFamily}', monospace`,
                fontSize: `${fontSettings.fontSize}px`,
                lineHeight: fontSettings.lineHeight,
              }}
            >
              {'const hello = "world"; // monospace preview'}
            </p>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-header">
          <h2>Column Colors</h2>
        </div>

        {existingColumns.length === 0 ? (
          <p className="settings-empty-hint">No columns yet. Assign a column to a page to see it here.</p>
        ) : (
          <div className="settings-color-list">
            {existingColumns.map((col, idx) => {
              const color = getColumnColor(col, idx);
              const isCustom = !!columnColors[col.toLowerCase()];
              return (
                <div key={col} className="settings-color-row">
                  <span className="settings-color-chip" style={{ backgroundColor: color }}>
                    {col}
                  </span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColumnColor(col, e.target.value)}
                    className="settings-color-input"
                    title={`Change color for "${col}"`}
                  />
                  {isCustom && (
                    <button
                      className="settings-cmd-btn"
                      onClick={() => removeColumnColor(col)}
                      title="Reset to default"
                    >
                      Reset
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="settings-section">
        <div className="settings-section-header">
          <h2>Slash Commands</h2>
          <div className="settings-section-actions">
            <button className="btn btn-secondary" onClick={handleReset}>
              Reset to Defaults
            </button>
            <button className="btn btn-primary" onClick={startAdd}>
              + Add Command
            </button>
          </div>
        </div>

        {isAdding && renderForm()}

        <div className="settings-commands-list">
          {slashCommands.map((cmd) => (
            <div key={cmd.id}>
              <div className="settings-command-row">
                <span className="settings-cmd-icon">{cmd.icon}</span>
                <span className="settings-cmd-key">/{cmd.key}</span>
                <span className="settings-cmd-label">{cmd.label}</span>
                {cmd.builtin && <span className="settings-cmd-badge">built-in</span>}
                <div className="settings-cmd-actions">
                  <button className="settings-cmd-btn" onClick={() => startEdit(cmd)}>
                    Edit
                  </button>
                  <button
                    className="settings-cmd-btn settings-cmd-btn-danger"
                    onClick={() => handleDelete(cmd)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {editingId === cmd.id && renderForm()}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
