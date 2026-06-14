import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WardrobeGrid from "./WardrobeGrid.jsx";

describe("WardrobeGrid", () => {
  it("renders wardrobe items and handles remove", () => {
    const onDelete = vi.fn();

    render(
      <WardrobeGrid
        items={[
          {
            id: "1",
            name: "White Shirt",
            category: "top",
            occasions: ["casual"],
            imageUrl: "/uploads/1.jpg",
          },
        ]}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("White Shirt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
