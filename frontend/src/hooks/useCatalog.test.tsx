import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AppConfig } from "@/config/appConfig";

import { useCatalog } from "./useCatalog";

const config: AppConfig = {
  rpcUrl: "http://127.0.0.1:8545",
  registryAddress: "0x1111111111111111111111111111111111111111",
  chainId: 31337
};

describe("useCatalog", () => {
  it("does not re-run native loading when native entries are skipped", async () => {
    let renderCount = 0;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    function Probe(): JSX.Element {
      renderCount += 1;
      const catalog = useCatalog({ config, skipNative: true });
      return <div data-testid="native-status">{catalog.nativeStatus}</div>;
    }

    try {
      render(<Probe />);

      await waitFor(() => {
        expect(screen.getByTestId("native-status")).toHaveTextContent("idle");
      });

      await new Promise((resolve) => globalThis.setTimeout(resolve, 0));

      expect(renderCount).toBeLessThan(5);
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining("Maximum update depth exceeded"),
        expect.anything()
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
