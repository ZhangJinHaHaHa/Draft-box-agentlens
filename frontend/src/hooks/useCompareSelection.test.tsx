import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { useCompareSelection } from "./useCompareSelection";

function Probe(): JSX.Element {
  const { ids, compareHref } = useCompareSelection();
  return (
    <>
      <span data-testid="ids">{ids.join(",")}</span>
      <span data-testid="href">{compareHref}</span>
      <Link to="/en/recommend">Recommend</Link>
    </>
  );
}

function renderProbe(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/en/agents" element={<Probe />} />
        <Route path="/en/compare" element={<Probe />} />
        <Route path="/en/recommend" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("useCompareSelection", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("normalizes duplicate and over-limit ids while preserving unrelated query params", () => {
    renderProbe("/en/agents?risk=low&ids=cursor,,cursor,claude-code,aider,v0,extra");

    expect(screen.getByTestId("ids")).toHaveTextContent("cursor,claude-code,aider,v0");
    expect(screen.getByTestId("href")).toHaveTextContent(
      "/compare?risk=low&ids=cursor%2Cclaude-code%2Caider%2Cv0"
    );
  });

  it("keeps compare ids available after navigating to a route without ids in the query", () => {
    renderProbe("/en/agents?ids=cursor,claude-code");

    fireEvent.click(screen.getByRole("link", { name: "Recommend" }));

    expect(screen.getByTestId("ids")).toHaveTextContent("cursor,claude-code");
    expect(screen.getByTestId("href")).toHaveTextContent(
      "/compare?ids=cursor%2Cclaude-code"
    );
  });
});
