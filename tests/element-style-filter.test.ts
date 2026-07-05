import assert from "node:assert/strict";
import { filterComputedStylesByDefault } from "../lib/element-picker.ts";

// 模拟 <div> 的默认样式（只列测试中会用到的字段）
const divDefaults: Record<string, string> = {
  display: "block",
  "font-size": "16px",
  "font-family": "Times",
  color: "rgb(0, 0, 0)",
  "background-color": "rgba(0, 0, 0, 0)",
  "border-top-width": "0px",
  "border-top-style": "none",
  "border-top-color": "rgb(0, 0, 0)",
  "border-radius": "0px",
  "box-shadow": "none",
  "margin-top": "0px",
  width: "auto",
  position: "static",
  overflow: "visible",
  opacity: "1",
  "unicode-bidi": "isolate",
  "text-rendering": "auto",
  "pointer-events": "auto",
};

const filtered = filterComputedStylesByDefault(
  {
    display: "flex", // 与默认不同，保留
    "font-size": "16px", // 与默认相同，过滤
    "font-family": "Inter", // 与默认不同，保留
    color: "rgb(17, 17, 17)", // 与默认不同，保留
    "background-color": "rgba(0, 0, 0, 0)", // 与默认相同，过滤
    "border-top-width": "0px", // 与默认相同，过滤
    "border-radius": "12px", // 与默认不同，保留
    "box-shadow": "none", // 与默认相同，过滤
    "unicode-bidi": "isolate", // 与默认相同，过滤
    "text-rendering": "auto", // 与默认相同，过滤
    "pointer-events": "auto", // 与默认相同，过滤
    "margin-top": "0px", // 与默认相同，过滤
    width: "320px", // 与默认不同，保留
  },
  divDefaults,
);

assert.deepEqual(filtered, {
  display: "flex",
  "font-family": "Inter",
  color: "rgb(17, 17, 17)",
  "border-radius": "12px",
  width: "320px",
});

console.log("element style filter tests passed");
