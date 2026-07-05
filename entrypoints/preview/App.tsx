"use client";

import { useEffect, useState, type FC } from "react";

const Preview: FC = () => {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key");

    if (!key) {
      setError("Missing preview key.");
      return;
    }

    browser.storage.session
      .get(key)
      .then((result) => {
        const stored = result[key];
        if (typeof stored === "string") {
          setHtml(stored);
        } else {
          setError("Preview not found or expired.");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load preview.");
      });
  }, []);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (html === null) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-sm text-gray-500">
        Loading preview…
      </div>
    );
  }

  return (
    <iframe
      srcDoc={html}
      className="h-screen w-full border-0"
      sandbox="allow-scripts"
      title="Preview"
    />
  );
};

export default Preview;
