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
    useToastStore.getState().showToast("Unable to start the scenario.");
    expect(useToastStore.getState().message).toBe("Unable to start the scenario.");
  });

  it("dismissToast clears the message", () => {
    useToastStore.getState().showToast("Something went wrong.");
    useToastStore.getState().dismissToast();
    expect(useToastStore.getState().message).toBeNull();
  });

  it("a second showToast replaces the previous message", () => {
    useToastStore.getState().showToast("First message.");
    useToastStore.getState().showToast("Second message.");
    expect(useToastStore.getState().message).toBe("Second message.");
  });
});
