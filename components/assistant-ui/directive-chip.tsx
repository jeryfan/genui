"use client";

import { WrenchIcon } from "lucide-react";
import { type FC } from "react";
import type { DirectiveChipProps } from "@assistant-ui/react-lexical";

export const DirectiveChip: FC<DirectiveChipProps> = (props) => {
  const { directiveId, directiveType, label } = props;
  const showWrench = directiveType !== "command";
  return (
    <span
      className="aui-directive-chip"
      data-directive-type={directiveType}
      data-directive-id={directiveId}
    >
      {showWrench && (
        <span className="aui-directive-chip-icon">
          <WrenchIcon className="size-3" />
        </span>
      )}
      <span className="aui-directive-chip-label">{label}</span>
    </span>
  );
};
