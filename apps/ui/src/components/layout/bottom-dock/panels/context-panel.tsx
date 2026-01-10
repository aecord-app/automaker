import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen,
  FileText,
  Image,
  Loader2,
  Upload,
  FilePlus,
  Save,
  Trash2,
  Pencil,
  Eye,
  MoreVertical,
  ArrowLeft,
} from 'lucide-react';
import { getElectronAPI } from '@/lib/electron';
import { getHttpApiClient } from '@/lib/http-api-client';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { sanitizeFilename } from '@/lib/image-utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Markdown } from '@/components/ui/markdown';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ContextFile {
  name: string;
  type: 'text' | 'image';
  path: string;
  description?: string;
}

interface ContextMetadata {
  files: Record<string, { description: string }>;
}

export function ContextPanel() {
  const { currentProject } = useAppStore();
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<ContextFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isDropHovering, setIsDropHovering] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [generatingDescriptions, setGeneratingDescriptions] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog states
  const [isCreateMarkdownOpen, setIsCreateMarkdownOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isEditDescriptionOpen, setIsEditDescriptionOpen] = useState(false);

  // Dialog form values
  const [newMarkdownName, setNewMarkdownName] = useState('');
  const [newMarkdownDescription, setNewMarkdownDescription] = useState('');
  const [newMarkdownContent, setNewMarkdownContent] = useState('');
  const [renameFileName, setRenameFileName] = useState('');
  const [editDescriptionValue, setEditDescriptionValue] = useState('');
  const [editDescriptionFileName, setEditDescriptionFileName] = useState('');

  const hasChanges = fileContent !== originalContent;

  // Helper functions
  const isImageFile = (filename: string): boolean => {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  };

  const isMarkdownFile = (filename: string): boolean => {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return ext === '.md' || ext === '.markdown';
  };

  const getContextPath = useCallback(() => {
    if (!currentProject) return null;
    return `${currentProject.path}/.automaker/context`;
  }, [currentProject]);

  // Load context metadata
  const loadMetadata = useCallback(async (): Promise<ContextMetadata> => {
    const contextPath = getContextPath();
    if (!contextPath) return { files: {} };

    try {
      const api = getElectronAPI();
      const metadataPath = `${contextPath}/context-metadata.json`;
      const result = await api.readFile(metadataPath);
      if (result.success && result.content) {
        return JSON.parse(result.content);
      }
    } catch {
      // Metadata file doesn't exist yet
    }
    return { files: {} };
  }, [getContextPath]);

  // Save context metadata
  const saveMetadata = useCallback(
    async (metadata: ContextMetadata) => {
      const contextPath = getContextPath();
      if (!contextPath) return;

      try {
        const api = getElectronAPI();
        const metadataPath = `${contextPath}/context-metadata.json`;
        await api.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      } catch (error) {
        console.error('Failed to save metadata:', error);
      }
    },
    [getContextPath]
  );

  const loadContextFiles = useCallback(async () => {
    const contextPath = getContextPath();
    if (!contextPath) return;

    setLoading(true);
    try {
      const api = getElectronAPI();

      // Ensure context directory exists
      await api.mkdir(contextPath);

      // Load metadata for descriptions
      const metadata = await loadMetadata();

      // Read directory contents
      const result = await api.readdir(contextPath);
      if (result.success && result.entries) {
        const contextFiles: ContextFile[] = result.entries
          .filter((entry) => entry.isFile && entry.name !== 'context-metadata.json')
          .map((entry) => ({
            name: entry.name,
            type: isImageFile(entry.name) ? 'image' : 'text',
            path: `${contextPath}/${entry.name}`,
            description: metadata.files[entry.name]?.description,
          }));
        setFiles(contextFiles);
      }
    } catch (error) {
      console.error('Error loading context files:', error);
    } finally {
      setLoading(false);
    }
  }, [getContextPath, loadMetadata]);

  useEffect(() => {
    loadContextFiles();
  }, [loadContextFiles]);

  const handleSelectFile = useCallback(async (file: ContextFile) => {
    try {
      const api = getElectronAPI();
      const result = await api.readFile(file.path);
      if (result.success && result.content !== undefined) {
        setSelectedFile(file);
        setFileContent(result.content);
        setOriginalContent(result.content);
        setIsPreviewMode(isMarkdownFile(file.name));
      }
    } catch (error) {
      console.error('Error reading file:', error);
    }
  }, []);

  // Save file content
  const handleSaveFile = useCallback(async () => {
    if (!selectedFile || !hasChanges) return;

    setIsSaving(true);
    try {
      const api = getElectronAPI();
      await api.writeFile(selectedFile.path, fileContent);
      setOriginalContent(fileContent);
      toast.success('File saved');
    } catch (error) {
      console.error('Failed to save file:', error);
      toast.error('Failed to save file');
    } finally {
      setIsSaving(false);
    }
  }, [selectedFile, fileContent, hasChanges]);

  // Generate description for a file
  const generateDescription = async (
    filePath: string,
    fileName: string,
    isImage: boolean
  ): Promise<string | undefined> => {
    try {
      const httpClient = getHttpApiClient();
      const result = isImage
        ? await httpClient.context.describeImage(filePath)
        : await httpClient.context.describeFile(filePath);

      if (result.success && result.description) {
        return result.description;
      }
    } catch (error) {
      console.error('Failed to generate description:', error);
    }
    return undefined;
  };

  // Generate description in background and update metadata
  const generateDescriptionAsync = useCallback(
    async (filePath: string, fileName: string, isImage: boolean) => {
      setGeneratingDescriptions((prev) => new Set(prev).add(fileName));

      try {
        const description = await generateDescription(filePath, fileName, isImage);

        if (description) {
          const metadata = await loadMetadata();
          metadata.files[fileName] = { description };
          await saveMetadata(metadata);
          await loadContextFiles();

          setSelectedFile((current) => {
            if (current?.name === fileName) {
              return { ...current, description };
            }
            return current;
          });
        }
      } catch (error) {
        console.error('Failed to generate description:', error);
      } finally {
        setGeneratingDescriptions((prev) => {
          const next = new Set(prev);
          next.delete(fileName);
          return next;
        });
      }
    },
    [loadMetadata, saveMetadata, loadContextFiles]
  );

  // Upload a file
  const uploadFile = async (file: globalThis.File) => {
    const contextPath = getContextPath();
    if (!contextPath) return;

    setIsUploading(true);

    try {
      const api = getElectronAPI();
      const isImage = isImageFile(file.name);

      let filePath: string;
      let fileName: string;
      let imagePathForDescription: string | undefined;

      if (isImage) {
        fileName = sanitizeFilename(file.name);

        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.readAsDataURL(file);
        });

        const base64Data = dataUrl.split(',')[1] || dataUrl;
        const mimeType = file.type || 'image/png';

        const saveResult = await api.saveImageToTemp?.(
          base64Data,
          fileName,
          mimeType,
          currentProject!.path
        );

        if (!saveResult?.success || !saveResult.path) {
          throw new Error(saveResult?.error || 'Failed to save image');
        }

        imagePathForDescription = saveResult.path;
        filePath = `${contextPath}/${fileName}`;
        await api.writeFile(filePath, dataUrl);
      } else {
        fileName = file.name;
        filePath = `${contextPath}/${fileName}`;

        const content = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.readAsText(file);
        });

        await api.writeFile(filePath, content);
      }

      await loadContextFiles();
      generateDescriptionAsync(imagePathForDescription || filePath, fileName, isImage);
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle file drop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropHovering(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    for (const file of droppedFiles) {
      await uploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropHovering(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropHovering(false);
  };

  // Handle file import via button
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFiles = e.target.files;
    if (!inputFiles || inputFiles.length === 0) return;

    for (const file of Array.from(inputFiles)) {
      await uploadFile(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Create markdown file
  const handleCreateMarkdown = async () => {
    const contextPath = getContextPath();
    if (!contextPath || !newMarkdownName.trim()) return;

    try {
      const api = getElectronAPI();
      let filename = newMarkdownName.trim();

      if (!filename.includes('.')) {
        filename += '.md';
      }

      const filePath = `${contextPath}/${filename}`;
      await api.writeFile(filePath, newMarkdownContent);

      if (newMarkdownDescription.trim()) {
        const metadata = await loadMetadata();
        metadata.files[filename] = { description: newMarkdownDescription.trim() };
        await saveMetadata(metadata);
      }

      await loadContextFiles();
      setIsCreateMarkdownOpen(false);
      setNewMarkdownName('');
      setNewMarkdownDescription('');
      setNewMarkdownContent('');
      toast.success('Markdown file created');
    } catch (error) {
      console.error('Failed to create markdown:', error);
      toast.error('Failed to create file');
    }
  };

  // Delete selected file
  const handleDeleteFile = async () => {
    if (!selectedFile) return;

    try {
      const api = getElectronAPI();
      await api.deleteFile(selectedFile.path);

      const metadata = await loadMetadata();
      delete metadata.files[selectedFile.name];
      await saveMetadata(metadata);

      setIsDeleteDialogOpen(false);
      setSelectedFile(null);
      setFileContent('');
      setOriginalContent('');
      await loadContextFiles();
      toast.success('File deleted');
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast.error('Failed to delete file');
    }
  };

  // Rename selected file
  const handleRenameFile = async () => {
    const contextPath = getContextPath();
    if (!selectedFile || !contextPath || !renameFileName.trim()) return;

    const newName = renameFileName.trim();
    if (newName === selectedFile.name) {
      setIsRenameDialogOpen(false);
      return;
    }

    try {
      const api = getElectronAPI();
      const newPath = `${contextPath}/${newName}`;

      const exists = await api.exists(newPath);
      if (exists) {
        toast.error('A file with this name already exists');
        return;
      }

      const result = await api.readFile(selectedFile.path);
      if (!result.success || result.content === undefined) {
        toast.error('Failed to read file for rename');
        return;
      }

      await api.writeFile(newPath, result.content);
      await api.deleteFile(selectedFile.path);

      const metadata = await loadMetadata();
      if (metadata.files[selectedFile.name]) {
        metadata.files[newName] = metadata.files[selectedFile.name];
        delete metadata.files[selectedFile.name];
        await saveMetadata(metadata);
      }

      setIsRenameDialogOpen(false);
      setRenameFileName('');
      await loadContextFiles();

      const renamedFile: ContextFile = {
        name: newName,
        type: isImageFile(newName) ? 'image' : 'text',
        path: newPath,
        description: metadata.files[newName]?.description,
      };
      setSelectedFile(renamedFile);
      toast.success('File renamed');
    } catch (error) {
      console.error('Failed to rename file:', error);
      toast.error('Failed to rename file');
    }
  };

  // Save edited description
  const handleSaveDescription = async () => {
    if (!editDescriptionFileName) return;

    try {
      const metadata = await loadMetadata();
      metadata.files[editDescriptionFileName] = { description: editDescriptionValue.trim() };
      await saveMetadata(metadata);

      if (selectedFile?.name === editDescriptionFileName) {
        setSelectedFile({ ...selectedFile, description: editDescriptionValue.trim() });
      }

      await loadContextFiles();
      setIsEditDescriptionOpen(false);
      setEditDescriptionValue('');
      setEditDescriptionFileName('');
      toast.success('Description saved');
    } catch (error) {
      console.error('Failed to save description:', error);
      toast.error('Failed to save description');
    }
  };

  // Delete file from list (dropdown action)
  const handleDeleteFromList = async (file: ContextFile) => {
    try {
      const api = getElectronAPI();
      await api.deleteFile(file.path);

      const metadata = await loadMetadata();
      delete metadata.files[file.name];
      await saveMetadata(metadata);

      if (selectedFile?.path === file.path) {
        setSelectedFile(null);
        setFileContent('');
        setOriginalContent('');
      }

      await loadContextFiles();
      toast.success('File deleted');
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast.error('Failed to delete file');
    }
  };

  // Go back to file list
  const handleBack = useCallback(() => {
    setSelectedFile(null);
    setFileContent('');
    setOriginalContent('');
    setIsPreviewMode(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'h-full flex flex-col relative',
        isDropHovering && 'ring-2 ring-primary ring-inset'
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Drop overlay */}
      {isDropHovering && (
        <div className="absolute inset-0 bg-primary/10 z-50 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center text-primary">
            <Upload className="w-8 h-8 mb-1" />
            <span className="text-sm font-medium">Drop files to upload</span>
          </div>
        </div>
      )}

      {/* Uploading overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-background/80 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary mb-1" />
            <span className="text-xs font-medium">Uploading...</span>
          </div>
        </div>
      )}

      {/* Single View: Either File List OR File Content */}
      {!selectedFile ? (
        /* File List View */
        <>
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
            <span className="text-xs font-medium">Context Files</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsCreateMarkdownOpen(true)}
                title="Create markdown"
              >
                <FilePlus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleImportClick}
                disabled={isUploading}
                title="Import file"
              >
                <Upload className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {files.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-xs text-muted-foreground">No context files</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Drop files here or click + to add
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {files.map((file) => {
                  const isGenerating = generatingDescriptions.has(file.name);
                  return (
                    <div
                      key={file.name}
                      className={cn(
                        'group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer',
                        'text-sm transition-colors',
                        'hover:bg-accent/50'
                      )}
                      onClick={() => handleSelectFile(file)}
                    >
                      {file.type === 'image' ? (
                        <Image className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="truncate block font-medium">{file.name}</span>
                        {isGenerating ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Generating description...
                          </span>
                        ) : file.description ? (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {file.description}
                          </span>
                        ) : null}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded transition-opacity"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameFileName(file.name);
                              setSelectedFile(file);
                              setIsRenameDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-3 h-3 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditDescriptionFileName(file.name);
                              setEditDescriptionValue(file.description || '');
                              setIsEditDescriptionOpen(true);
                            }}
                          >
                            <FileText className="w-3 h-3 mr-2" />
                            Edit Description
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFromList(file);
                            }}
                            className="text-red-500 focus:text-red-500"
                          >
                            <Trash2 className="w-3 h-3 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* File Content View */
        <>
          <div className="flex items-center justify-between px-2 py-2 border-b border-border/50">
            <div className="flex items-center gap-2 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={handleBack}
                title="Back to files"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium truncate">{selectedFile.name}</span>
              {hasChanges && <span className="text-[10px] text-amber-500 shrink-0">Unsaved</span>}
            </div>
            <div className="flex items-center gap-1">
              {selectedFile.type === 'text' && isMarkdownFile(selectedFile.name) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsPreviewMode(!isPreviewMode)}
                  title={isPreviewMode ? 'Edit' : 'Preview'}
                >
                  {isPreviewMode ? (
                    <Pencil className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
              {selectedFile.type === 'text' && hasChanges && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={handleSaveFile}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5 mr-1" />
                      Save
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-500 hover:text-red-400"
                onClick={() => setIsDeleteDialogOpen(true)}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Description section */}
          <div className="px-2 pt-2">
            <div className="bg-muted/30 rounded p-2 text-xs">
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">
                    Description
                  </span>
                  {generatingDescriptions.has(selectedFile.name) ? (
                    <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Generating...</span>
                    </div>
                  ) : selectedFile.description ? (
                    <p className="text-xs mt-0.5">{selectedFile.description}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">No description</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={() => {
                    setEditDescriptionFileName(selectedFile.name);
                    setEditDescriptionValue(selectedFile.description || '');
                    setIsEditDescriptionOpen(true);
                  }}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-auto p-2">
            {selectedFile.type === 'image' ? (
              <div className="h-full flex items-center justify-center bg-muted/20 rounded">
                <img
                  src={fileContent}
                  alt={selectedFile.name}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : isPreviewMode && isMarkdownFile(selectedFile.name) ? (
              <Card className="h-full overflow-auto p-3">
                <Markdown>{fileContent}</Markdown>
              </Card>
            ) : (
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                className={cn(
                  'w-full h-full p-2 font-mono text-xs bg-muted/30 rounded resize-none',
                  'focus:outline-none focus:ring-1 focus:ring-ring'
                )}
                placeholder="Enter content..."
                spellCheck={false}
              />
            )}
          </div>
        </>
      )}

      {/* Create Markdown Dialog */}
      <Dialog open={isCreateMarkdownOpen} onOpenChange={setIsCreateMarkdownOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Markdown File</DialogTitle>
            <DialogDescription>Create a new markdown file for AI context.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="md-filename" className="text-xs">
                File Name
              </Label>
              <Input
                id="md-filename"
                value={newMarkdownName}
                onChange={(e) => setNewMarkdownName(e.target.value)}
                placeholder="context-file.md"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="md-description" className="text-xs">
                Description
              </Label>
              <Input
                id="md-description"
                value={newMarkdownDescription}
                onChange={(e) => setNewMarkdownDescription(e.target.value)}
                placeholder="e.g., Coding style guidelines"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="md-content" className="text-xs">
                Content
              </Label>
              <Textarea
                id="md-content"
                value={newMarkdownContent}
                onChange={(e) => setNewMarkdownContent(e.target.value)}
                placeholder="Enter markdown content..."
                className="h-32 text-sm font-mono resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setIsCreateMarkdownOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateMarkdown} disabled={!newMarkdownName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedFile?.name}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteFile}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>Enter a new name for "{selectedFile?.name}".</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={renameFileName}
              onChange={(e) => setRenameFileName(e.target.value)}
              placeholder="Enter new filename"
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameFileName.trim()) {
                  handleRenameFile();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRenameFile}
              disabled={!renameFileName.trim() || renameFileName === selectedFile?.name}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Description Dialog */}
      <Dialog open={isEditDescriptionOpen} onOpenChange={setIsEditDescriptionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Description</DialogTitle>
            <DialogDescription>
              Update the description for "{editDescriptionFileName}".
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={editDescriptionValue}
              onChange={(e) => setEditDescriptionValue(e.target.value)}
              placeholder="Enter description..."
              className="h-24 text-sm resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setIsEditDescriptionOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveDescription}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
