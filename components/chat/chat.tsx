"use client";

import { Header } from "./header";
import { ChatThread } from "./thread";

export const Chat = () => {
  return (
    <div className="bg-muted/30 flex h-full w-full">
      <div className="flex flex-1 flex-col overflow-hidden p-2">
        <div className="bg-background flex flex-1 flex-col overflow-hidden rounded-lg">
          <Header />
          <main className="flex-1 overflow-hidden">
            <ChatThread />
          </main>
        </div>
      </div>
    </div>
  );
};
