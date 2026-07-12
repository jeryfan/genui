"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { HiddenInteractionTriggerCandidate } from "@/lib/element-picker";
import { CrosshairIcon, LocateFixedIcon, Trash2Icon } from "lucide-react";
import { type FC } from "react";

type HiddenTriggerDialogState = {
  tabId: number;
  selector: string;
  candidates: HiddenInteractionTriggerCandidate[];
  loading: boolean;
};

type HiddenTriggerDialogProps = {
  dialog: HiddenTriggerDialogState | null;
  onLocate: (candidate: HiddenInteractionTriggerCandidate) => void;
  onRemove: (candidate: HiddenInteractionTriggerCandidate) => void;
  onAdd: () => void;
  onClear: () => void;
  onCancel: () => void;
  onSubmit: () => void;
};

function getCandidateLabel(candidate: HiddenInteractionTriggerCandidate) {
  return candidate.text || candidate.role || candidate.tagName;
}

export const HiddenTriggerDialog: FC<HiddenTriggerDialogProps> = ({
  dialog,
  onLocate,
  onRemove,
  onAdd,
  onClear,
  onCancel,
  onSubmit,
}) => {
  const candidates = dialog?.candidates ?? [];
  const loading = dialog?.loading ?? false;

  return (
    <Dialog open={dialog != null} onOpenChange={(open) => !open && !loading && onCancel()}>
      <DialogContent className="max-h-[min(620px,calc(100dvh-48px))] grid w-[min(520px,calc(100vw-32px))] grid-rows-[auto_minmax(0,1fr)_auto] p-0 sm:max-w-none">
        <DialogHeader className="gap-2 p-4 pb-3">
          <DialogTitle>确认隐藏元素触发器</DialogTitle>
          <DialogDescription>
            保留需要点击、悬浮或聚焦的元素。提交后会按列表逐个触发并生成 hidden-interactions 文件。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto border-y px-4 py-3">
          {candidates.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
              <CrosshairIcon className="size-5" />
              未发现候选触发器，可以手动添加。
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="rounded-lg border bg-background p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {getCandidateLabel(candidate)}
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {candidate.selector}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                        <span className="rounded-full bg-muted px-2 py-0.5">
                          {candidate.source === "manual" ? "手动添加" : "自动识别"}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5">
                          {candidate.actions.join(" / ")}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5">
                          {candidate.tagName}{candidate.role ? ` · ${candidate.role}` : ""}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="定位元素"
                      disabled={loading}
                      onClick={() => onLocate(candidate)}
                    >
                      <LocateFixedIcon className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="删除触发器"
                      disabled={loading}
                      onClick={() => onRemove(candidate)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="m-0 rounded-none">
          <Button type="button" variant="outline" disabled={loading} onClick={onCancel}>
            取消
          </Button>
          <Button type="button" variant="outline" disabled={loading || candidates.length === 0} onClick={onClear}>
            清空触发项
          </Button>
          <Button type="button" variant="secondary" disabled={loading} onClick={onAdd}>
            添加触发元素
          </Button>
          <Button type="button" disabled={loading || candidates.length === 0} onClick={onSubmit}>
            {loading ? "捕获中..." : "开始捕获"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
