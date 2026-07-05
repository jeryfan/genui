"use client";

import { SettingsProvider } from "@/components/chat/settings/context";
import { SettingsPage } from "@/components/chat/settings/page";
import { type FC } from "react";

const App: FC = () => {
  return (
    <SettingsProvider>
      <div className="h-full w-full">
        <SettingsPage />
      </div>
    </SettingsProvider>
  );
};

export default App;
