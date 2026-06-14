import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UploadForm from "./UploadForm.jsx";

const config = {
  categories: ["top", "bottom", "shoes", "accessory"],
  occasionTags: ["casual", "office"],
  seasonTags: ["spring", "summer"],
  styleTags: ["minimal"],
};

describe("UploadForm", () => {
  it("submits form data with selected image", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(<UploadForm onCreate={onCreate} loading={false} config={config} onAddConfigTag={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("White Oxford Shirt"), {
      target: { value: "Blue Tee" },
    });

    const file = new File(["hello"], "tee.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Photo"), {
      target: { files: [file] },
    });

    fireEvent.submit(screen.getByRole("button", { name: "Add Item" }).closest("form"));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
    });
    const fd = onCreate.mock.calls[0][0];
    expect(fd.get("name")).toBe("Blue Tee");
    expect(fd.get("category")).toBe("top");
    expect(fd.get("image")).toBeTruthy();
  });
});
