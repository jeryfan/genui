import assert from "node:assert/strict";
import { createMarkdownFile } from "../lib/element-picker.ts";

const snapshot = {
  kind: "viewport",
  selector: "div.card",
  rect: { x: 0, y: 0, width: 320, height: 120, top: 0, left: 0 },
  devicePixelRatio: 2,
  styles: {
    display: "flex",
    "background-color": "rgb(255, 255, 255)",
  },
  html: '<div class="card"><h2>Title</h2><button>Open</button></div>',
  tree: {
    tagName: "div",
    selector: "div.card",
    rect: { x: 0, y: 0, width: 320, height: 120, top: 0, left: 0 },
    attributes: { class: "card" },
    text: "Title Open",
    styles: { display: "flex" },
    children: [
      {
        tagName: "h2",
        selector: "div.card > h2",
        rect: { x: 16, y: 16, width: 120, height: 32, top: 16, left: 16 },
        attributes: {},
        text: "Title",
        styles: { "font-size": "24px", "font-weight": "700" },
        children: [],
      },
      {
        tagName: "button",
        selector: "div.card > button",
        rect: { x: 16, y: 64, width: 80, height: 36, top: 64, left: 16 },
        attributes: {},
        text: "Open",
        styles: { "border-radius": "999px" },
        children: [],
      },
    ],
  },
};

const file = createMarkdownFile(snapshot as any);
const markdown = await file.text();

assert.match(markdown, /## Snapshot Type/);
assert.match(markdown, /viewport/);
assert.match(markdown, /## Element Tree/);
assert.match(markdown, /div\.card > h2/);
assert.match(markdown, /font-size: 24px;/);
assert.match(markdown, /div\.card > button/);
assert.match(markdown, /border-radius: 999px;/);

const compactFile = createMarkdownFile(snapshot as any, {
  includeHtml: false,
  includeTree: false,
});
const compactMarkdown = await compactFile.text();

assert.doesNotMatch(compactMarkdown, /## Element Tree/);
assert.doesNotMatch(compactMarkdown, /## HTML/);

console.log("element picker tests passed");
