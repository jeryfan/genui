"use client";

import { useEffect, useState, type FC } from "react";
import {
  Code2Icon,
  PencilIcon,
  PlayIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const Preview: FC = () => {
  const [html, setHtml] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const previewKey = params.get("key");

    if (!previewKey) {
      setIsEditing(true);
      setIsLoading(false);
      return;
    }

    setKey(previewKey);
    browser.storage.session
      .get(previewKey)
      .then((result) => {
        const stored = result[previewKey];
        if (typeof stored === "string") {
          setHtml(stored);
          setDraft(stored);
        } else {
          setError("Preview not found or expired.");
        }
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to load preview.",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handlePreview = () => {
    setHtml(draft);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!key) return;
    try {
      await browser.storage.session.set({ [key]: draft });
      setHtml(draft);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preview.");
    }
  };

  const handleEdit = () => {
    setDraft(html ?? "");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraft(html ?? "");
    setIsEditing(false);
  };

  const hasChanges = key ? draft !== html : true;

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-sm text-gray-500">
        Loading preview…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Code2Icon className="size-4" />
          <span>HTML Preview</span>
          {key && (
            <span className="text-muted-foreground text-xs">
              {isEditing ? "Editing" : "Viewing"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="gap-1.5"
              >
                <XIcon className="size-4" />
                Cancel
              </Button>
              {key && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasChanges}
                  className="gap-1.5"
                >
                  <SaveIcon className="size-4" />
                  Save
                </Button>
              )}
              <Button size="sm" onClick={handlePreview} className="gap-1.5">
                <PlayIcon className="size-4" />
                Preview
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="gap-1.5"
            >
              <PencilIcon className="size-4" />
              Edit
            </Button>
          )}
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden">
        {isEditing ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste or type HTML here..."
            className="h-full resize-none rounded-none border-0 px-3 py-2 font-mono text-sm focus-visible:ring-0"
            spellCheck={false}
          />
        ) : html !== null ? (
          <iframe
            srcDoc={html}
            className="h-full w-full border-0"
            sandbox="allow-scripts"
            title="Preview"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Enter HTML and click Preview
          </div>
        )}
      </main>
    </div>
  );
};

export default Preview;
