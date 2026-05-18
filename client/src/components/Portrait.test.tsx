import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createAssetRegistry, type InkUiManifest } from "../assets/assetRegistry";
import { Portrait } from "./Portrait";

const manifest: InkUiManifest = {
  schemaVersion: 1,
  assetSetId: "ink-ui-v1",
  assetRoot: "/assets/ui/",
  runtimeUsableReviewStatuses: ["approved"],
  fallbackCatalog: [
    {
      id: "fallback-paper-panel-v1",
      category: "fallback",
      type: "css_token",
      usage: ["global_fallback"],
      cssTokens: { backgroundColor: "#f5f0e6", borderColor: "#c9b898", textColor: "#241f18" },
      reviewStatus: "approved",
      ledgerId: "ui-fallback-paper-panel-v1"
    },
    {
      id: "fallback-role-silhouette-v1",
      category: "fallback",
      type: "css_token",
      usage: ["people_page"],
      cssTokens: { backgroundColor: "#e8dcc8", accentColor: "#a53a2a", textColor: "#241f18" },
      reviewStatus: "approved",
      ledgerId: "ui-fallback-role-silhouette-v1"
    }
  ],
  assets: [
    {
      id: "portrait-test-female-v1",
      category: "portrait",
      subcategory: "generic_npc_pool",
      usage: ["people_page"],
      role: "female_official",
      roleLabel: "女官",
      scene: null,
      path: "/assets/ui/portraits/portrait-test-female-v1.webp",
      thumbnailPath: "/assets/ui/thumbs/thumb-portrait-test-female-v1.webp",
      lowResPlaceholderPath: "/assets/ui/portraits/placeholders/placeholder-portrait-test-female-v1.webp",
      fallbackRef: "fallback-role-silhouette-v1",
      reviewStatus: "approved",
      visualReview: { status: "approved" },
      safetyReview: { status: "approved" },
      portraitRef: "portrait-test-female-v1",
      genderPresentation: "feminine",
      ageBand: "adult_young",
      statusVariant: "baseline",
      emotionVariant: "neutral",
      identityTags: ["female_style"],
      emotionTags: ["neutral"],
      lazyLoad: {
        group: "portrait_pool_generic_npc_s73_10",
        allowEagerLoad: false,
        thumbnailFirst: true,
        lowResPlaceholder: true,
        maxInitialPortraits: 8
      },
      source: { localHighResSource: "kept_outside_public_manifest" }
    }
  ]
};

describe("S74.5 Portrait component", () => {
  afterEach(() => cleanup());

  it("renders a manifest thumbnail lazily and never asks for a hard-coded public path prop", () => {
    const registry = createAssetRegistry(manifest);
    render(<Portrait registry={registry} portraitRef="portrait-test-female-v1" label="女官" />);

    const image = screen.getByRole("img", { name: "女官" }) as HTMLImageElement;
    expect(image.getAttribute("src")).toBe("/assets/ui/thumbs/thumb-portrait-test-female-v1.webp");
    expect(image.getAttribute("loading")).toBe("lazy");
    expect(image.closest("[data-portrait-ref='portrait-test-female-v1']")?.getAttribute("data-portrait-remastered")).toBe("true");
    expect(document.body.textContent || "").not.toMatch(/prompt|provider payload|hiddenNotes|OPENAI_API_KEY|artifacts/i);
  });

  it("falls back to a paper silhouette when the portrait ref or image is missing", () => {
    const registry = createAssetRegistry(manifest);
    const { rerender } = render(<Portrait registry={registry} portraitRef="portrait-missing-v1" label="未见其人" />);

    expect(screen.getByLabelText("未见其人，纸底占位").getAttribute("data-asset-fallback")).toBe("fallback-role-silhouette-v1");

    rerender(<Portrait registry={registry} portraitRef="portrait-test-female-v1" label="女官" />);
    fireEvent.error(screen.getByRole("img", { name: "女官" }));

    expect(screen.getByLabelText("女官，纸底占位")).toBeTruthy();
  });
});
