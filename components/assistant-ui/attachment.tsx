"use client";

import { type PropsWithChildren, useEffect, useState, type FC } from "react";
import {
  XIcon,
  PlusIcon,
  FileText,
  Loader2Icon,
  AlertCircleIcon,
} from "lucide-react";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAuiState,
  useAui,
} from "@assistant-ui/react";
import { useShallow } from "zustand/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UnifiedPreview } from "@/components/preview/unified-preview";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { cn } from "@/lib/utils";

const useFileObjectUrl = (file: File | undefined) => {
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!file) {
      setSrc(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return src;
};

const parseDataUrlMimeType = (value: string | undefined) => {
  const match = value?.match(/^data:([^;,]+)[;,]/);
  return match?.[1];
};

function unwrapAttachmentText(text: string) {
  const start = text.indexOf("\n");
  const end = text.lastIndexOf("\n</attachment>");

  if (text.startsWith("<attachment ") && start !== -1 && end !== -1) {
    return text.slice(start + 1, end);
  }

  return text;
}

const useAttachmentImageSrc = () => {
  const { file, src } = useAuiState(
    useShallow((s): { file?: File; src?: string } => {
      if (s.attachment.type !== "image") return {};
      if (s.attachment.file) return { file: s.attachment.file };
      const src = s.attachment.content?.filter((c) => c.type === "image")[0]
        ?.image;
      if (!src) return {};
      return { src };
    }),
  );

  return useFileObjectUrl(file) ?? src;
};

const useAttachmentPreview = () => {
  const { file, contentText, contentUrl, contentType, fileType, name } = useAuiState(
    useShallow(
      (s): {
        file?: File;
        contentText?: string;
        contentUrl?: string;
        contentType?: string;
        fileType?: string;
        name: string;
      } => {
        const text = s.attachment.content
          ?.filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("\n");
        const image = s.attachment.content?.filter((part) => part.type === "image")[0]
          ?.image;

        return {
          file: s.attachment.file,
          contentText: text ? unwrapAttachmentText(text) : undefined,
          contentUrl: image,
          contentType: s.attachment.contentType,
          fileType: s.attachment.file?.type,
          name: s.attachment.name,
        };
      },
    ),
  );
  const objectUrl = useFileObjectUrl(file);
  const content = contentText ?? objectUrl ?? contentUrl;

  if (!content) return undefined;

  return {
    name: name || file?.name || "attachment",
    mimeType: contentType || fileType || parseDataUrlMimeType(content),
    content,
  };
};

const AttachmentPreviewDialog: FC<PropsWithChildren> = ({ children }) => {
  const preview = useAttachmentPreview();

  if (!preview) return children;

  const title = preview.name || "附件预览";

  return (
    <Dialog>
      <DialogTrigger
        className="aui-attachment-preview-trigger hover:bg-accent/50 cursor-pointer transition-colors"
      >
        {children}
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="aui-attachment-preview-dialog-content top-[74px] grid h-[min(592px,calc(100dvh-104px))] w-[min(780px,calc(100vw-60px))] translate-y-0 grid-rows-[52px_minmax(0,1fr)_55px] gap-0 overflow-hidden rounded-2xl bg-white p-0 pb-4 text-[#0d0d0d] shadow-[0_8px_12px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.62)] ring-0 sm:max-w-none"
      >
        <header className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_min-content] items-center gap-3 border-b border-black/5 px-4 py-2.5 select-none">
          <DialogTitle className="truncate text-lg leading-normal font-normal text-[#0d0d0d]">
            {title}
          </DialogTitle>
        </header>

        <div className="min-h-0 overflow-hidden px-5">
          <UnifiedPreview
            name={preview.name}
            content={preview.content}
            mimeType={preview.mimeType}
            className="h-full overflow-hidden bg-white text-[#0d0d0d]"
          />
        </div>

        <footer className="z-10 flex items-center justify-end gap-3 border-t border-black/7 px-4 pt-4">
          <DialogClose className="inline-flex min-w-20 cursor-pointer items-center justify-center rounded-lg border border-black/12 bg-white px-4 py-2 text-sm font-medium text-[#0d0d0d] transition-colors hover:bg-[#f5f5f5] active:bg-[#ebebeb]">
            关闭
          </DialogClose>
        </footer>
      </DialogContent>
    </Dialog>
  );
};

const AttachmentThumb: FC = () => {
  const src = useAttachmentImageSrc();

  return (
    <Avatar className="aui-attachment-tile-avatar h-full w-full rounded-none">
      <AvatarImage
        src={src}
        alt="Attachment preview"
        className="aui-attachment-tile-image object-cover"
      />
      <AvatarFallback>
        <FileText className="aui-attachment-tile-fallback-icon text-muted-foreground size-8" />
      </AvatarFallback>
    </Avatar>
  );
};

const AttachmentUI: FC = () => {
  const aui = useAui();
  const isComposer = aui.attachment.source !== "message";

  const isImage = useAuiState((s) => s.attachment.type === "image");
  const typeLabel = useAuiState((s) => {
    const type = s.attachment.type;
    switch (type) {
      case "image":
        return "Image";
      case "document":
        return "Document";
      case "file":
        return "File";
      default:
        return type;
    }
  });

  const uploadState = useAuiState((s) =>
    s.attachment.status.type === "running"
      ? "uploading"
      : s.attachment.status.type === "incomplete" &&
          s.attachment.status.reason === "error"
        ? "error"
        : undefined,
  );
  const isUploading = uploadState === "uploading";
  const isError = uploadState === "error";

  return (
    <Tooltip>
      <AttachmentPrimitive.Root
        className={cn(
          "aui-attachment-root relative",
          isImage &&
            !isComposer &&
            "aui-attachment-root-message only:*:first:size-24",
        )}
      >
        <AttachmentPreviewDialog>
          <TooltipTrigger render={<div className={cn(
                                  "aui-attachment-tile bg-muted relative size-14 cursor-pointer overflow-hidden rounded-[calc(var(--composer-radius)-var(--composer-padding))] border transition-opacity hover:opacity-75",
                                  isError && "border-destructive",
                                )} role="button" tabIndex={0} aria-label={`${typeLabel} attachment${
                                  isError ? ", upload failed" : isUploading ? ", uploading" : ""
                                }`} />}><AttachmentThumb />{isUploading && (
                                  <div
                                    aria-hidden="true"
                                    className="aui-attachment-tile-uploading bg-background/60 absolute inset-0 flex items-center justify-center backdrop-blur-[1px]"
                                  >
                                    <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
                                  </div>
                                )}{isError && (
                                  <div
                                    aria-hidden="true"
                                    className="aui-attachment-tile-error bg-destructive/10 absolute inset-0 flex items-center justify-center"
                                  >
                                    <AlertCircleIcon className="text-destructive size-5" />
                                  </div>
                                )}</TooltipTrigger>
        </AttachmentPreviewDialog>
        {isComposer && <AttachmentRemove />}
      </AttachmentPrimitive.Root>
      <TooltipContent side="top">
        <AttachmentPrimitive.Name />
      </TooltipContent>
    </Tooltip>
  );
};

const AttachmentRemove: FC = () => {
  return (
    <AttachmentPrimitive.Remove render={<TooltipIconButton tooltip="Remove file" className="aui-attachment-tile-remove text-muted-foreground hover:[&_svg]:text-destructive absolute end-1.5 top-1.5 size-3.5 rounded-full bg-white opacity-100 shadow-sm hover:bg-white! [&_svg]:text-black" side="top" />}><XIcon className="aui-attachment-remove-icon size-3 dark:stroke-[2.5px]" /></AttachmentPrimitive.Remove>
  );
};

export const UserMessageAttachments: FC = () => {
  return (
    <div className="aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2">
      <MessagePrimitive.Attachments>
        {() => <AttachmentUI />}
      </MessagePrimitive.Attachments>
    </div>
  );
};

export const ComposerAttachments: FC = () => {
  return (
    <div className="aui-composer-attachments flex w-full flex-row items-center gap-2 overflow-x-auto empty:hidden">
      <ComposerPrimitive.Attachments>
        {() => <AttachmentUI />}
      </ComposerPrimitive.Attachments>
    </div>
  );
};

export const ComposerAddAttachment: FC = () => {
  return (
    <ComposerPrimitive.AddAttachment render={<TooltipIconButton tooltip="Add Attachment" side="bottom" variant="ghost" size="icon" className="aui-composer-add-attachment hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30 size-7 rounded-full p-1 text-xs font-semibold" aria-label="Add Attachment" />}><PlusIcon className="aui-attachment-add-icon size-4.5 stroke-[1.5px]" /></ComposerPrimitive.AddAttachment>
  );
};
