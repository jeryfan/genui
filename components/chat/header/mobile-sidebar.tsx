"use client";

import { ThreadList } from "@/components/assistant-ui/thread-list";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MenuIcon } from "lucide-react";
import { type FC } from "react";

export const MobileSidebar: FC = () => {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 md:hidden"
          />
        }
      >
        <MenuIcon className="size-4" />
        <span className="sr-only">Toggle menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-70 flex-col p-0">
        <div className="flex h-12 shrink-0 items-center px-4">
          {/* <Logo /> */}
        </div>
        <div className="relative flex-1 overflow-y-auto p-3">
          <ThreadList />
        </div>
      </SheetContent>
    </Sheet>
  );
};
