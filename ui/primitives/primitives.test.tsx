import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Label } from "./label";

describe("primitives", () => {
  it("renders button variants and sizes", () => {
    const { rerender } = render(<Button>Delve</Button>);
    expect(screen.getByRole("button", { name: "Delve" })).toBeInTheDocument();
    rerender(
      <Button variant="destructive" size="sm">
        Ruin
      </Button>
    );
    expect(screen.getByRole("button", { name: "Ruin" }).className).toContain("bg-destructive");
  });

  it("renders the card kit", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Vault</CardTitle>
          <CardDescription>Deep halls</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Foot</CardFooter>
      </Card>
    );
    expect(screen.getByText("Vault")).toBeInTheDocument();
    expect(screen.getByText("Deep halls")).toBeInTheDocument();
  });

  it("renders labeled fields", () => {
    render(
      <div>
        <Label htmlFor="n">Name</Label>
        <Input id="n" placeholder="Name" />
        <Textarea placeholder="Desc" />
      </div>
    );
    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Desc")).toBeInTheDocument();
  });
});
