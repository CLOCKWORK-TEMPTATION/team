import { describe, it, expect } from "vitest";
import { EvidencePacketSchema } from "./evidence.js";

describe("EvidencePacketSchema", () => {
  it("validates a correct evidence packet", () => {
    const packet = {
      id: "cand_001",
      kind: "dead_code" as const,
      target: {
        file: "src/utils/old.ts",
        symbol: "unusedFunction",
        range: [10, 42] as [number, number],
      },
      evidence: {
        importGraph: {
          inboundCount: 0,
          inboundFiles: [],
        },
        callGraph: {
          callers: [],
        },
        tsReferences: {
          refCount: 0,
          refs: [],
        },
        toolHits: {
          knip: "unused-export",
          depcheck: null,
          jscpd: null,
        },
      },
      exceptions: {
        dynamicImportSuspicion: false,
        sideEffectModule: false,
        publicApiExposure: false,
      },
      risk: {
        score: 18,
        band: "low" as const,
        reasons: ["no inbound", "no refs"],
      },
      recommendedAction: "delete" as const,
      requiresHarness: false,
    };

    const result = EvidencePacketSchema.safeParse(packet);
    expect(result.success).toBe(true);
  });

  it("rejects invalid evidence packet", () => {
    const result = EvidencePacketSchema.safeParse({ id: 123 });
    expect(result.success).toBe(false);
  });
});
