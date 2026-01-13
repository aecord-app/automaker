import { useState } from 'react';
import { X, Search } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IconPickerProps {
  selectedIcon: string | null;
  onSelectIcon: (icon: string | null) => void;
}

// Popular project-related icons
const POPULAR_ICONS = [
  'Folder',
  'FolderOpen',
  'FolderCode',
  'FolderGit',
  'FolderKanban',
  'Package',
  'Box',
  'Boxes',
  'Code',
  'Code2',
  'Braces',
  'FileCode',
  'Terminal',
  'Globe',
  'Server',
  'Database',
  'Layout',
  'Layers',
  'Blocks',
  'Component',
  'Puzzle',
  'Cog',
  'Wrench',
  'Hammer',
  'Zap',
  'Rocket',
  'Sparkles',
  'Star',
  'Heart',
  'Shield',
  'Lock',
  'Key',
  'Cpu',
  'CircuitBoard',
  'Workflow',
];

export function IconPicker({ selectedIcon, onSelectIcon }: IconPickerProps) {
  const [search, setSearch] = useState('');

  const filteredIcons = POPULAR_ICONS.filter((icon) =>
    icon.toLowerCase().includes(search.toLowerCase())
  );

  const getIconComponent = (iconName: string) => {
    return (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[iconName];
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search icons..."
          className="pl-9"
        />
      </div>

      {/* Selected Icon Display */}
      {selectedIcon && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-accent/50 border border-border">
          <div className="flex items-center gap-2 flex-1">
            {(() => {
              const IconComponent = getIconComponent(selectedIcon);
              return IconComponent ? <IconComponent className="w-5 h-5 text-brand-500" /> : null;
            })()}
            <span className="text-sm font-medium">{selectedIcon}</span>
          </div>
          <button
            onClick={() => onSelectIcon(null)}
            className="p-1 hover:bg-background rounded transition-colors"
            title="Clear icon"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Icons Grid */}
      <ScrollArea className="h-64 rounded-md border">
        <div className="grid grid-cols-6 gap-1 p-2">
          {filteredIcons.map((iconName) => {
            const IconComponent = getIconComponent(iconName);
            if (!IconComponent) return null;

            const isSelected = selectedIcon === iconName;

            return (
              <button
                key={iconName}
                onClick={() => onSelectIcon(iconName)}
                className={cn(
                  'aspect-square rounded-md flex items-center justify-center',
                  'transition-all duration-150',
                  'hover:bg-accent hover:scale-110',
                  isSelected
                    ? 'bg-brand-500/20 border-2 border-brand-500'
                    : 'border border-transparent'
                )}
                title={iconName}
              >
                <IconComponent
                  className={cn('w-5 h-5', isSelected ? 'text-brand-500' : 'text-foreground')}
                />
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
