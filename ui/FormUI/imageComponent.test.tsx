import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ImageUpload from "@/ui/FormUI/imageComponent";

const DATA_URL = "data:image/png;base64,iVBORw0KGgo=";

describe("ImageUpload", () => {
  it("renders a preview restored from the value prop", () => {
    render(<ImageUpload label="Image" value={DATA_URL} onSelect={vi.fn()} />);
    expect(screen.getByAltText("Preview")).toHaveAttribute("src", DATA_URL);
  });

  it("keeps the preview when the component remounts with the same value", () => {
    // This is the "go back to a previous wizard step" case: the step
    // component unmounts and remounts. The preview must survive.
    const { unmount } = render(
      <ImageUpload label="Image" value={DATA_URL} onSelect={vi.fn()} />
    );
    expect(screen.getByAltText("Preview")).toHaveAttribute("src", DATA_URL);

    unmount();
    render(<ImageUpload label="Image" value={DATA_URL} onSelect={vi.fn()} />);
    expect(screen.getByAltText("Preview")).toHaveAttribute("src", DATA_URL);
  });

  it("shows the upload placeholder when there is no preview", () => {
    render(<ImageUpload label="Image" onSelect={vi.fn()} />);
    expect(screen.queryByAltText("Preview")).toBeNull();
    expect(screen.getByText("Upload Image")).toBeInTheDocument();
  });

  it("emits a data URL preview (not an object URL) so it can be persisted", async () => {
    const onSelect = vi.fn();
    const onPreviewChange = vi.fn();

    const file = new File([new Uint8Array([1, 2, 3, 4])], "pic.png", {
      type: "image/png",
    });

    render(
      <ImageUpload
        label="Image"
        onSelect={onSelect}
        onPreviewChange={onPreviewChange}
      />
    );

    const fileInput = document.querySelector<HTMLInputElement>(
      'input[type="file"]'
    )!;
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(onSelect).toHaveBeenCalled());
    expect(onPreviewChange).toHaveBeenCalled();
    const preview = onPreviewChange.mock.calls[0][0] as string;
    expect(preview.startsWith("data:image/png;base64,")).toBe(true);
    expect(preview).not.toContain("blob:");
  });

  it("rejects a non-image file", async () => {
    const onSelect = vi.fn();
    render(<ImageUpload label="Image" onSelect={onSelect} />);

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["nope"], "notes.txt", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText("File must be an image.")).toBeInTheDocument()
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("rejects a file over the size limit", async () => {
    const onSelect = vi.fn();
    render(<ImageUpload label="Image" onSelect={onSelect} maxSizeMB={0.001} />);

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([new Uint8Array(4096)], "big.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText(/Image exceeds/)).toBeInTheDocument()
    );
    expect(onSelect).not.toHaveBeenCalled();
  });
});
