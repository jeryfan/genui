import assert from "node:assert/strict";
import {
  createHiddenInteractionsMarkdownFile,
  createMarkdownFile,
} from "../lib/element-picker.ts";

const snapshot = {
  kind: "viewport",
  selector: "div.card",
  rect: { x: 0, y: 0, width: 320, height: 120, top: 0, left: 0 },
  devicePixelRatio: 2,
  styles: {
    display: "flex",
    "background-color": "rgb(255, 255, 255)",
    "padding-top": "8px",
    "padding-right": "8px",
    "padding-bottom": "8px",
    "padding-left": "8px",
  },
  html: '<div class="card"><h2>Title</h2><button>Open</button></div>',
  hiddenInteractions: [
    {
      triggerSelector: "div.card > button.menu-trigger",
      triggerText: "Open",
      action: "click",
      revealedSelector: "div.menu",
      revealedRole: "menu",
      matchedBy: "role=menu",
      waitTimeMs: 100,
      depth: 1,
      parentTriggerSelector: "button.parent-trigger",
      rect: { x: 10, y: 40, width: 160, height: 120, top: 40, left: 10 },
      html: '<div role="menu" class="menu"><button>Item</button></div>',
      styles: { position: "absolute", "z-index": "50" },
      tree: {
        tagName: "div",
        selector: "div.menu",
        rect: { x: 10, y: 40, width: 160, height: 120, top: 40, left: 10 },
        attributes: { role: "menu", class: "menu" },
        text: "",
        styles: { position: "absolute", "z-index": "50" },
        children: [
          {
            tagName: "button",
            selector: "div.menu > button",
            rect: { x: 18, y: 48, width: 80, height: 32, top: 48, left: 18 },
            attributes: {},
            text: "Item",
            styles: { display: "block" },
            children: [],
          },
        ],
      },
    },
  ],
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
        styles: {
          "border-top-left-radius": "999px",
          "border-top-right-radius": "999px",
          "border-bottom-right-radius": "999px",
          "border-bottom-left-radius": "999px",
        },
        children: [
          {
            tagName: "svg",
            selector: "div.card > button > svg",
            rect: { x: 20, y: 72, width: 16, height: 16, top: 72, left: 20 },
            attributes: { "aria-hidden": "true" },
            text: "",
            styles: { display: "block" },
            children: [
              {
                tagName: "path",
                selector: "div.card > button > svg > path",
                rect: { x: 20, y: 72, width: 16, height: 16, top: 72, left: 20 },
                attributes: { d: "M0 0h16v16H0z" },
                text: "",
                styles: {},
                children: [],
              },
            ],
          },
        ],
      },
      {
        tagName: "img",
        selector: "div.card > img",
        rect: { x: 240, y: 16, width: 48, height: 48, top: 16, left: 240 },
        attributes: { src: "https://example.com/avatar.png", alt: "Avatar" },
        text: "",
        styles: { width: "48px", height: "48px" },
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
assert.match(markdown, /padding: 8px;/);
assert.doesNotMatch(markdown, /padding-top: 8px;/);
assert.match(markdown, /font-size: 24px;/);
assert.match(markdown, /div\.card > button/);
assert.match(markdown, /div\.card > button > svg/);
assert.doesNotMatch(markdown, /div\.card > button > svg > path/);
assert.match(markdown, /div\.card > img/);
assert.match(markdown, /border-radius: 999px;/);
assert.doesNotMatch(markdown, /border-top-left-radius: 999px;/);
assert.doesNotMatch(markdown, /pointer-events: auto;/);
assert.doesNotMatch(markdown, /transform-origin:/);
assert.match(markdown, /## Hidden Interaction Elements/);
assert.match(markdown, /Trigger Selector: div\.card > button\.menu-trigger/);
assert.match(markdown, /Action: click/);
assert.match(markdown, /Revealed Role: menu/);
assert.match(markdown, /Matched By: role=menu/);
assert.match(markdown, /Wait Time: 100ms/);
assert.match(markdown, /Depth: 1/);
assert.match(markdown, /Parent Trigger Selector: button\.parent-trigger/);
assert.match(markdown, /div\.menu/);
assert.match(markdown, /z-index: 50;/);

const compactFile = createMarkdownFile(snapshot as any, {
  includeHtml: false,
  includeTree: false,
});
const compactMarkdown = await compactFile.text();

assert.doesNotMatch(compactMarkdown, /## Element Tree/);
assert.doesNotMatch(compactMarkdown, /## HTML/);

const fullFile = createMarkdownFile(snapshot as any, { detail: "full" });
const fullMarkdown = await fullFile.text();
assert.match(fullMarkdown, /padding-top: 8px;/);
assert.match(fullMarkdown, /border-top-left-radius: 999px;/);
assert.match(fullMarkdown, /div\.card > button > svg > path/);
assert.match(fullMarkdown, /z-index: 50;/);

const hiddenFile = createHiddenInteractionsMarkdownFile(
  "div.card",
  snapshot.hiddenInteractions as any,
);
const hiddenMarkdown = await hiddenFile.text();

assert.match(hiddenMarkdown, /## Interaction Implementation Notes/);
assert.match(hiddenMarkdown, /trigger\.contains\(event\.target\)/);
assert.match(hiddenMarkdown, /closest\("button"\)/);
assert.match(hiddenMarkdown, /event\.target !== trigger/);
assert.match(hiddenMarkdown, /## Source Selector/);
assert.match(hiddenMarkdown, /div\.card/);

console.log("element picker tests passed");
