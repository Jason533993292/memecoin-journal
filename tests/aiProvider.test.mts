import assert from "node:assert/strict";
import test from "node:test";

import { getAiProviderKeyError, isAiProvider } from "../src/lib/aiProvider.ts";

test("recognizes only supported AI providers", () => {
  assert.equal(isAiProvider("deepseek"), true);
  assert.equal(isAiProvider("gemini"), true);
  assert.equal(isAiProvider("openai"), true);
  assert.equal(isAiProvider("google"), false);
});

test("rejects a DeepSeek-style key when Google Gemini is selected", () => {
  assert.match(
    getAiProviderKeyError("gemini", "sk-deepseekExampleKey123456789") || "",
    /does not match Google Gemini/
  );
});

test("accepts representative provider key formats", () => {
  assert.equal(getAiProviderKeyError("gemini", "AIzaSyExampleKey_1234567890123456"), null);
  assert.equal(getAiProviderKeyError("deepseek", "sk-deepseekExampleKey123456789"), null);
  assert.equal(getAiProviderKeyError("openai", "sk-proj-exampleKey123456789012345"), null);
});

test("rejects whitespace, short keys, and the wrong provider prefix", () => {
  assert.ok(getAiProviderKeyError("deepseek", "short"));
  assert.ok(getAiProviderKeyError("openai", "sk-key with spaces"));
  assert.ok(getAiProviderKeyError("deepseek", "AIzaSyExampleKey_1234567890123456"));
});
