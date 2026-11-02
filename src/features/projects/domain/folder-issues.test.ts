import { describe, expect, test } from "vitest";

import { newFolderId } from "~/shared/ids";

import { folderIssues } from "./folder-issues";

const [first, second, third] = [newFolderId(), newFolderId(), newFolderId()];

describe("folderIssues", () => {
  test("flat folders give no issues", () => {
    expect(folderIssues([{ id: first }, { id: second }])).toEqual([]);
  });
  test("nesting three deep gives no issues", () => {
    expect(
      folderIssues([
        { id: first },
        { id: second, parentId: first },
        { id: third, parentId: second },
      ]),
    ).toEqual([]);
  });
  test("a parent that names no folder is one issue at that folder", () => {
    expect(folderIssues([{ id: first }, { id: second, parentId: third }])).toEqual([
      { path: ["folders", 1], message: "folder parent names no folder" },
    ]);
  });
  test("a folder that is its own parent is a cycle", () => {
    expect(folderIssues([{ id: first, parentId: first }])).toEqual([
      { path: ["folders", 0], message: "folder parents form a cycle" },
    ]);
  });
  test("A to B to A is a cycle on both", () => {
    expect(
      folderIssues([
        { id: first, parentId: second },
        { id: second, parentId: first },
      ]),
    ).toEqual([
      { path: ["folders", 0], message: "folder parents form a cycle" },
      { path: ["folders", 1], message: "folder parents form a cycle" },
    ]);
  });
  test("a folder below a cycle is also reported", () => {
    expect(
      folderIssues([
        { id: first, parentId: second },
        { id: second, parentId: first },
        { id: third, parentId: first },
      ]),
    ).toHaveLength(3);
  });
  test("duplicate ids are an issue", () => {
    expect(folderIssues([{ id: first }, { id: first }])).toEqual([
      { path: ["folders", 1], message: "folder ids must be unique" },
    ]);
  });
});
