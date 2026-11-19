import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ScenarioEntry from "./ScenarioEntry";
import { createScenario } from "@/lib/scenarios";
import { useGameSavesStore } from "@/stores/game-saves";

beforeEach(() => {
  // Vault is module-scoped zustand; start every test empty.
  useGameSavesStore.getState().resetForTests();
});

describe("ScenarioEntry", () => {
  it("links to the inventory to forge a new world", () => {
    const entered: string[] = [];
    render(<ScenarioEntry onEnter={(s) => entered.push(s.id)} />);

    expect(screen.getByText("No saved adventures yet.")).toBeInTheDocument();
    const forge = screen.getByText("+ Forge a new world");
    expect(forge.closest("a")).toHaveAttribute("href", "/inventory");
    expect(entered).toHaveLength(0);
  });

  it("enters and deletes existing adventures", () => {
    const created = createScenario("Deep")!;
    const entered: string[] = [];
    render(<ScenarioEntry onEnter={(s) => entered.push(s.id)} />);

    fireEvent.click(screen.getByText("Deep"));
    expect(entered).toEqual([created.id]);

    fireEvent.click(screen.getByLabelText("Delete Deep"));
    expect(screen.getByText("No saved adventures yet.")).toBeInTheDocument();
  });

  it("offers to import a save file", () => {
    render(<ScenarioEntry onEnter={() => undefined} />);
    expect(screen.getByText("Have a save file? Import it")).toBeInTheDocument();
  });
});
