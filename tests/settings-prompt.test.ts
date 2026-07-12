import assert from "node:assert/strict";
import { DEFAULT_SYSTEM_PROMPT } from "../components/chat/settings/types.ts";

assert.match(DEFAULT_SYSTEM_PROMPT, /视觉还原优先/);
assert.match(DEFAULT_SYSTEM_PROMPT, /不要重新设计/);
assert.match(DEFAULT_SYSTEM_PROMPT, /截图是最高优先级/);
assert.match(DEFAULT_SYSTEM_PROMPT, /bounding rect/);
assert.match(DEFAULT_SYSTEM_PROMPT, /trigger\.contains\(event\.target/);
assert.match(DEFAULT_SYSTEM_PROMPT, /closest\(\"button\"\)/);
assert.match(DEFAULT_SYSTEM_PROMPT, /event\.target !== addBtn/);
assert.doesNotMatch(DEFAULT_SYSTEM_PROMPT, /复杂组件必须拆分架构/);

console.log("settings prompt tests passed");
