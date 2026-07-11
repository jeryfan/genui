import { PreviewContent, zhCNLocale, type PreviewWindow } from "@jeryfan/finder-ui";

export type UnifiedPreviewProps = {
  name: string;
  content: string;
  path?: string;
  mimeType?: string;
  className?: string;
  isEditing?: boolean;
  updateEnabled?: boolean;
  onContentChange?: (content: string) => void;
};

export function UnifiedPreview({
  name,
  content,
  path = name,
  mimeType,
  className,
  isEditing = false,
  updateEnabled = false,
  onContentChange,
}: UnifiedPreviewProps) {
  const preview: PreviewWindow = {
    path,
    name,
    size: content.length,
    content,
    draftContent: content,
    isLoading: false,
    isSaving: false,
    isEditing,
    mimeType,
  };

  return (
    <div className={className}>
      <PreviewContent
        preview={preview}
        locale={zhCNLocale}
        updateEnabled={updateEnabled}
        onDraftChange={(_, nextContent) => onContentChange?.(nextContent)}
      />
    </div>
  );
}
