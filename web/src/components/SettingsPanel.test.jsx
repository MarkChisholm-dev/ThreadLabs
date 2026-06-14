import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsPanel from "./SettingsPanel.jsx";

const config = {
  categories: ["top", "bottom", "shoes", "accessory"],
  occasionTags: ["casual"],
  seasonTags: ["spring"],
  styleTags: ["minimal"],
  lockedDefaults: {
    categories: ["top", "bottom", "shoes", "accessory"],
    occasionTags: ["casual"],
    seasonTags: ["spring"],
    styleTags: [],
  },
};

describe("SettingsPanel", () => {
  it("adds custom style tag and saves updated config", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<SettingsPanel config={config} saving={false} onSave={onSave} />);

    const inputs = screen.getAllByPlaceholderText(/Add .* option/i);
    const addButtons = screen.getAllByRole("button", { name: "Add" });

    fireEvent.change(inputs[3], { target: { value: "smart-casual" } });
    fireEvent.click(addButtons[3]);

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload.styleTags).toContain("smart-casual");
  });
});
