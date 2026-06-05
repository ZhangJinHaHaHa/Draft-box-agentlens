import { describe, expect, it } from "vitest";

import { readAppConfig } from "./appConfig";

describe("readAppConfig", () => {
  it("returns a configuration error when RPC url is missing", () => {
    expect(
      readAppConfig({
        VITE_AUDIT_RPC_URL: "",
        VITE_AUDIT_REGISTRY_ADDRESS: "0x1111111111111111111111111111111111111111",
        VITE_AUDIT_CHAIN_ID: "31337"
      })
    ).toEqual({
      ok: false,
      error: "VITE_AUDIT_RPC_URL is required."
    });
  });

  it("returns a configuration error when registry address is missing", () => {
    expect(
      readAppConfig({
        VITE_AUDIT_RPC_URL: "https://rpc.edge.local",
        VITE_AUDIT_REGISTRY_ADDRESS: "",
        VITE_AUDIT_CHAIN_ID: "31337"
      })
    ).toEqual({
      ok: false,
      error: "VITE_AUDIT_REGISTRY_ADDRESS is required."
    });
  });

  it("returns a configuration error when chain id is invalid", () => {
    expect(
      readAppConfig({
        VITE_AUDIT_RPC_URL: "https://rpc.edge.local",
        VITE_AUDIT_REGISTRY_ADDRESS: "0x1111111111111111111111111111111111111111",
        VITE_AUDIT_CHAIN_ID: "31337.5"
      })
    ).toEqual({
      ok: false,
      error: "VITE_AUDIT_CHAIN_ID must be a non-negative integer."
    });
  });

  it("returns canonical config when environment is valid", () => {
    expect(
      readAppConfig({
        VITE_AUDIT_RPC_URL: "https://rpc.edge.local",
        VITE_AUDIT_REGISTRY_ADDRESS: "0x1111111111111111111111111111111111111111",
        VITE_AUDIT_CHAIN_ID: "31337",
        VITE_AUDIT_REPORT_GATEWAY_URL: "https://gateway.example/ipfs/",
        VITE_AUDIT_APPEAL_API_URL: "https://api.example.com/appeals",
        VITE_PLATFORM_RECOMMENDATION_API_URL: "https://recommend.example.com",
        VITE_PLATFORM_API_URL: "https://platform.example.com"
      })
    ).toEqual({
      ok: true,
      config: {
        rpcUrl: "https://rpc.edge.local",
        registryAddress: "0x1111111111111111111111111111111111111111",
        chainId: 31337,
        reportGatewayUrl: "https://gateway.example/ipfs/",
        appealApiUrl: "https://api.example.com/appeals",
        recommendationApiUrl: "https://recommend.example.com",
        platformApiUrl: "https://platform.example.com"
      }
    });
  });
});
