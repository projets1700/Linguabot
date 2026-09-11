import { beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "../src/stores/toastStore";

describe("useToastStore", () => {
  beforeEach(() => {
    useToastStore.setState({ message: null });
  });

  it("starts with no message", () => {
    expect(useToastStore.getState().message).toBeNull();
  });

  it("showToast sets the message", () => {
    useToastStore.getState().showToast("Impossible de démarrer le scénario.");
    expect(useToastStore.getState().message).toBe("Impossible de démarrer le scénario.");
  });

  it("dismissToast clears the message", () => {
    useToastStore.getState().showToast("Une erreur est survenue.");
    useToastStore.getState().dismissToast();
    expect(useToastStore.getState().message).toBeNull();
  });

  it("a second showToast replaces the previous message", () => {
    useToastStore.getState().showToast("Premier message.");
    useToastStore.getState().showToast("Second message.");
    expect(useToastStore.getState().message).toBe("Second message.");
  });
});
