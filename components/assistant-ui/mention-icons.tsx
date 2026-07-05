"use client";

import { type FC } from "react";

type IconProps = {
  className?: string;
};

export const ReactIcon: FC<IconProps> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="2" fill="#61DAFB" />
    <ellipse
      cx="12"
      cy="12"
      rx="9"
      ry="3.5"
      stroke="#61DAFB"
      strokeWidth="1.2"
      transform="rotate(0 12 12)"
    />
    <ellipse
      cx="12"
      cy="12"
      rx="9"
      ry="3.5"
      stroke="#61DAFB"
      strokeWidth="1.2"
      transform="rotate(60 12 12)"
    />
    <ellipse
      cx="12"
      cy="12"
      rx="9"
      ry="3.5"
      stroke="#61DAFB"
      strokeWidth="1.2"
      transform="rotate(120 12 12)"
    />
  </svg>
);

export const VueIcon: FC<IconProps> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 22L1.5 5H6L12 15L18 5H22.5L12 22Z" fill="#41B883" />
    <path d="M12 22L6.5 12.5H9.5L12 17L14.5 12.5H17.5L12 22Z" fill="#35495E" />
  </svg>
);
