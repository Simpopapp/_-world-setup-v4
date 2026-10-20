import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AudioPlayer } from "./shared";

describe("AudioPlayer sem voz (modo degradado)", () => {
  it("não expõe o conteúdo do áudio — gabarito protegido antes do envio", () => {
    render(<AudioPlayer text="Climate change is real" />);
    expect(screen.queryByText(/Climate change is real/)).toBeNull();
    expect(screen.getByText(/não revelar o gabarito/)).toBeTruthy();
  });

  it("exibe o enunciado como texto apenas quando o tipo permite (allowText)", () => {
    render(<AudioPlayer text="What is the capital of France?" allowText />);
    expect(screen.getByText("What is the capital of France?")).toBeTruthy();
    expect(screen.getByText(/Modo degradado/)).toBeTruthy();
  });
});
