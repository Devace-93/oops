import { describe, expect, test } from "bun:test";
import { isInApp, parseStack } from "../src/stack";

const ORIGIN = "https://app.example";

describe("parseStack — V8", () => {
  const stack = [
    "TypeError: x is not a function",
    "    at init (https://app.example/js/x.js:12:4)",
    "    at Object.<anonymous> (https://app.example/js/main.js?v=3:1:200)",
    "    at async load (https://cdn.example/lib.min.js:5:1234)",
    "    at https://app.example/inline:3:7",
    "    at <anonymous>:1:5",
    "    at new Widget (http://localhost:8084/w.js:9:10)",
  ].join("\n");

  test("top frame first, with function, position and in_app", () => {
    const frames = parseStack(stack, ORIGIN);
    expect(frames).toHaveLength(6);
    expect(frames[0]).toEqual({ filename: "https://app.example/js/x.js", function: "init", lineno: 12, colno: 4, in_app: true });
    expect(frames[1]!.function).toBe("Object.<anonymous>");
    expect(frames[1]!.filename).toBe("https://app.example/js/main.js?v=3");
    expect(frames[2]).toEqual({ filename: "https://cdn.example/lib.min.js", function: "load", lineno: 5, colno: 1234, in_app: false });
    expect(frames[3]).toEqual({ filename: "https://app.example/inline", lineno: 3, colno: 7, in_app: true });
    expect(frames[4]).toEqual({ filename: "<anonymous>", lineno: 1, colno: 5, in_app: false });
    expect(frames[5]).toEqual({ filename: "http://localhost:8084/w.js", function: "new Widget", lineno: 9, colno: 10, in_app: false });
  });

  test("the header line is not a frame; empty / missing stacks give no frames", () => {
    expect(parseStack("Error: boom", ORIGIN)).toEqual([]);
    expect(parseStack("", ORIGIN)).toEqual([]);
    expect(parseStack(undefined, ORIGIN)).toEqual([]);
    expect(parseStack(null, ORIGIN)).toEqual([]);
  });

  test("caps at 50 frames", () => {
    const lines = ["Error: deep"];
    for (let i = 0; i < 80; i++) lines.push(`    at f${i} (https://app.example/a.js:${i}:1)`);
    expect(parseStack(lines.join("\n"), ORIGIN)).toHaveLength(50);
  });
});

describe("parseStack — Firefox / Safari", () => {
  const stack = ["init@https://app.example/js/x.js:12:4", "@https://app.example/js/main.js:1:200", "global code@https://cdn.example/lib.js:5:12", "fn@[native code]", "promiseReactionJob@[native code]"].join("\n");

  test("function@file:line:col, anonymous frames and native code", () => {
    const frames = parseStack(stack, ORIGIN);
    expect(frames).toHaveLength(3);
    expect(frames[0]).toEqual({ filename: "https://app.example/js/x.js", function: "init", lineno: 12, colno: 4, in_app: true });
    expect(frames[1]).toEqual({ filename: "https://app.example/js/main.js", lineno: 1, colno: 200, in_app: true });
    expect(frames[2]).toEqual({ filename: "https://cdn.example/lib.js", function: "global code", lineno: 5, colno: 12, in_app: false });
  });
});

describe("isInApp", () => {
  test("same origin and relative paths are in app; other origins and synthetic names are not", () => {
    expect(isInApp("https://app.example/x.js", ORIGIN)).toBe(true);
    expect(isInApp("https://app.example", ORIGIN)).toBe(true);
    expect(isInApp("/static/x.js", ORIGIN)).toBe(true);
    expect(isInApp("x.js", ORIGIN)).toBe(true);
    expect(isInApp("https://app.example.evil/x.js", ORIGIN)).toBe(false);
    expect(isInApp("https://cdn.example/x.js", ORIGIN)).toBe(false);
    expect(isInApp("chrome-extension://abc/x.js", ORIGIN)).toBe(false);
    expect(isInApp("<anonymous>", ORIGIN)).toBe(false);
    expect(isInApp(undefined, ORIGIN)).toBe(false);
  });
});
