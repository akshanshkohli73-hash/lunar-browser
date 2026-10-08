import React, { useState } from 'react';

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  tabs: { title: string; url: string }[];
}

interface WorkspacesBarProps {
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
}

export const DEFAULT_WORKSPACES: Workspace[] = [
  { id: 'personal', name: 'Personal', icon: '🏠', tabs: [] },
  { id: 'school', name: 'School', icon: '🎓', tabs: [] },
  { id: 'coding', name: 'Coding', icon: '💻', tabs: [] },
  { id: 'gaming', name: 'Gaming', icon: '🎮', tabs: [] },
  { id: 'research', name: 'Research', icon: '🔬', tabs: [] },
];

export const WorkspacesBar: React.FC<WorkspacesBarProps> = ({ activeWorkspaceId, onSelectWorkspace }) => {
  const [workspaces] = useState<Workspace[]>(DEFAULT_WORKSPACES);

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-[var(--lunar-bg-secondary)] border-b border-[var(--lunar-border)] text-xs">
      <span className="text-[10px] uppercase font-mono text-[var(--lunar-text-muted)] mr-2">Workspaces:</span>
      {workspaces.map((ws) => (
        <button
          key={ws.id}
          onClick={() => onSelectWorkspace(ws.id)}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${
            activeWorkspaceId === ws.id
              ? 'bg-[var(--lunar-surface)] border border-[var(--lunar-primary)] text-[var(--lunar-primary)] font-semibold'
              : 'hover:bg-[var(--lunar-surface-hover)] text-[var(--lunar-text-muted)]'
          }`}
        >
          <span>{ws.icon}</span>
          <span>{ws.name}</span>
        </button>
      ))}
    </div>
  );
};

export default WorkspacesBar;
