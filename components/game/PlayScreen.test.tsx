import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import PlayScreen from "./PlayScreen";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/playClient", () => ({
  memoryExport: vi.fn(async () => ({ chunks: [], saved_at: 0 })),
  memoryRestore: vi.fn(async () => ({})),
  memoryClear: vi.fn(async () => ({})),
  queuePush: vi.fn(async () => ({})),
  stateSetField: vi.fn(async () => ({})),
  counterIncr: vi.fn(async () => ({})),
  outputGet: vi.fn(async () => null),
}));

import { queuePush, outputGet } from "@/lib/playClient";

const scenario = { id: "sid1", name: "Sunken Vault", created_at: 0, last_played_at: 0 };

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  pushMock.mockClear();
});

describe("PlayScreen", () => {
  it("renders the scenario and an empty prompt", async () => {
    render(<PlayScreen sid="sid1" scenario={scenario} />);
    await act(async () => {});
    expect(screen.getByText("Sunken Vault")).toBeInTheDocument();
    expect(screen.getByText(/The tale begins with a single action/)).toBeInTheDocument();
  });

  it("sends an action and prints the story", async () => {
    render(<PlayScreen sid="sid1" scenario={scenario} />);
    await act(async () => {});

    fireEvent.change(screen.getByPlaceholderText("What do you do?"), {
      target: { value: "go north" },
    });
    fireEvent.click(screen.getByText("Send"));

    expect(screen.getByText("go north")).toBeInTheDocument();
    expect(queuePush).toHaveBeenCalled();

    vi.mocked(outputGet).mockResolvedValueOnce({ story: "A dragon wakes." } as never);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText("A dragon wakes.")).toBeInTheDocument();
    expect(screen.getByText("Turn 1")).toBeInTheDocument();
  });

  it("opens the exit modal and saves on demand", async () => {
    render(<PlayScreen sid="sid1" scenario={scenario} />);
    await act(async () => {});
    fireEvent.click(screen.getByText("Exit"));
    expect(screen.getByText("Save this adventure?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Save & Exit"));
    await act(async () => {});
    expect(pushMock).toHaveBeenCalledWith("/play");
  });
});
