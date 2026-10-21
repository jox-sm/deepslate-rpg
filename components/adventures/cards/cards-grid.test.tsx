import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CardsGrid from "./cards-grid";
import type { CardProps } from "@/types/cards";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("posthog-js", () => ({
  default: { capture: vi.fn() },
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

function card(id: string): CardProps {
  return { id, name: `Delve ${id}`, description: "Dark halls", tags: ["dark"], image: "img", likes_count: 3 };
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true }) as Response));
});

describe("CardsGrid", () => {
  it("renders cards from the fetcher", async () => {
    render(<CardsGrid fetchCards={async () => [card("1"), card("2")]} batchSize={6} />);
    expect(await screen.findByText("Delve 1")).toBeInTheDocument();
    expect(screen.getByText("Delve 2")).toBeInTheDocument();
  });

  it("shows an empty state when there are no delves", async () => {
    render(<CardsGrid fetchCards={async () => []} batchSize={6} />);
    expect(await screen.findByText("The codex is empty")).toBeInTheDocument();
  });

  it("shows an error with retry on fetch failure", async () => {
    const fetchCards = vi.fn(async () => { throw new Error("down"); });
    render(<CardsGrid fetchCards={fetchCards} batchSize={6} />);
    expect(await screen.findByText("No path found")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Try again"));
    await waitFor(() => expect(fetchCards).toHaveBeenCalledTimes(2));
  });

  it("hydrates from session cache without fetching", async () => {
    sessionStorage.setItem(
      "cards-grid-cache",
      JSON.stringify({ cards: [card("9")], offset: 1, exhausted: true })
    );
    const fetchCards = vi.fn(async () => [card("x")]);
    render(<CardsGrid fetchCards={fetchCards} batchSize={6} />);
    expect(await screen.findByText("Delve 9")).toBeInTheDocument();
    expect(fetchCards).not.toHaveBeenCalled();
  });
});
