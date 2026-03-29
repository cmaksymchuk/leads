import { CaptureChat } from "@/components/capture/CaptureChat";
import { CAPTURE_POLICY_VERSION_MORTGAGE_V1, VERTICAL_MORTGAGE } from "@/lib/capture/constants";
import {
  getVerticalMessageResolvers,
  getVerticalValidators,
} from "@/lib/capture/verticals";
import { mortgageCaptureConfig } from "@/lib/capture/verticals/mortgage";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firstBotText = mortgageCaptureConfig.steps[0].botMessage;

const mortgageValidators = getVerticalValidators("mortgage");
const mortgageMessageResolvers = getVerticalMessageResolvers("mortgage");

async function flushTypingDelay() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 850));
  });
}

describe("CaptureChat", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders first bot message after typing delay", async () => {
    render(
      <CaptureChat
        config={mortgageCaptureConfig}
        searchParams={new URLSearchParams()}
        chatMode="scripted"
        validators={mortgageValidators}
        messageResolvers={mortgageMessageResolvers}
      />,
    );
    expect(screen.queryByText(firstBotText)).not.toBeInTheDocument();
    await flushTypingDelay();
    expect(screen.getByText(firstBotText)).toBeInTheDocument();
  });

  it("option click advances to next bot message", async () => {
    render(
      <CaptureChat
        config={mortgageCaptureConfig}
        searchParams={new URLSearchParams()}
        chatMode="scripted"
        validators={mortgageValidators}
        messageResolvers={mortgageMessageResolvers}
      />,
    );
    await flushTypingDelay();
    fireEvent.click(screen.getByRole("button", { name: "Within 6 months" }));
    await flushTypingDelay();
    const second = mortgageCaptureConfig.steps[1].botMessage;
    expect(screen.getByText(second)).toBeInTheDocument();
  });

  it("Enter key submits text input and advances", async () => {
    render(
      <CaptureChat
        config={mortgageCaptureConfig}
        searchParams={new URLSearchParams()}
        chatMode="scripted"
        validators={mortgageValidators}
        messageResolvers={mortgageMessageResolvers}
      />,
    );
    await flushTypingDelay();
    fireEvent.click(screen.getByRole("button", { name: "Within 6 months" }));
    await flushTypingDelay();
    fireEvent.click(screen.getByRole("button", { name: "ON" }));
    await flushTypingDelay();
    const input = screen.getByPlaceholderText("Your name");
    fireEvent.change(input, { target: { value: "Taylor" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await flushTypingDelay();
    expect(
      screen.getByText(/Nice to meet you, Taylor!/),
    ).toBeInTheDocument();
  });

  it("final step POSTs to /api/capture with expected shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    globalThis.fetch = fetchMock;

    render(
      <CaptureChat
        config={mortgageCaptureConfig}
        searchParams={
          new URLSearchParams(
            "utm_source=src&utm_medium=med&utm_campaign=cmp&utm_content=ct",
          )
        }
        chatMode="scripted"
        validators={mortgageValidators}
        messageResolvers={mortgageMessageResolvers}
      />,
    );

    await flushTypingDelay();
    fireEvent.click(screen.getByRole("button", { name: "Within 6 months" }));
    await flushTypingDelay();
    fireEvent.click(screen.getByRole("button", { name: "BC" }));
    await flushTypingDelay();
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Alex" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Your name"), {
      key: "Enter",
      code: "Enter",
    });
    await flushTypingDelay();
    fireEvent.change(screen.getByPlaceholderText("Phone number"), {
      target: { value: "6045551234" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Phone number"), {
      key: "Enter",
      code: "Enter",
    });
    await flushTypingDelay();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: new RegExp(mortgageCaptureConfig.consentText.slice(0, 20)),
      }),
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. M5V 2T6"), {
      target: { value: "V6B1A1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: mortgageCaptureConfig.submitButtonLabel }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const call = fetchMock.mock.calls.find((c) => c[0] === "/api/capture");
    expect(call).toBeDefined();
    const init = call![1] as RequestInit;
    const body = JSON.parse(init.body as string) as {
      vertical_id: string;
      identity: { name: string; phone: string };
      intent: {
        postal_code: string;
        province: string;
        renewal_timeframe: string;
      };
      consent: { given: boolean; policy_version: string; timestamp: string };
      attribution: Record<string, string | undefined>;
    };

    expect(body.vertical_id).toBe(VERTICAL_MORTGAGE);
    expect(body.identity).toEqual({ name: "Alex", phone: "6045551234" });
    expect(body.intent).toEqual({
      postal_code: "V6B1A1",
      province: "BC",
      renewal_timeframe: "0-6mo",
    });
    expect(body.consent.given).toBe(true);
    expect(body.consent.policy_version).toBe(CAPTURE_POLICY_VERSION_MORTGAGE_V1);
    expect(body.attribution.utm_source).toBe("src");
    expect(body.attribution.utm_medium).toBe("med");
    expect(body.attribution.utm_campaign).toBe("cmp");
    expect(body.attribution.utm_content).toBe("ct");
    expect(body.attribution.landing_page).toBeDefined();
  });

  it("error response shows retry bot message from config", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false }),
    });
    globalThis.fetch = fetchMock;

    render(
      <CaptureChat
        config={mortgageCaptureConfig}
        searchParams={new URLSearchParams()}
        chatMode="scripted"
        validators={mortgageValidators}
        messageResolvers={mortgageMessageResolvers}
      />,
    );

    await flushTypingDelay();
    fireEvent.click(screen.getByRole("button", { name: "Within 6 months" }));
    await flushTypingDelay();
    fireEvent.click(screen.getByRole("button", { name: "AB" }));
    await flushTypingDelay();
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Pat" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Your name"), {
      key: "Enter",
      code: "Enter",
    });
    await flushTypingDelay();
    fireEvent.change(screen.getByPlaceholderText("Phone number"), {
      target: { value: "4035559876" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Phone number"), {
      key: "Enter",
      code: "Enter",
    });
    await flushTypingDelay();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: new RegExp(mortgageCaptureConfig.consentText.slice(0, 20)),
      }),
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. M5V 2T6"), {
      target: { value: "T2P1J4" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: mortgageCaptureConfig.submitButtonLabel }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(mortgageCaptureConfig.submissionErrorBotMessage),
      ).toBeInTheDocument(),
    );
  });

  it("progress dots reflect step count", async () => {
    render(
      <CaptureChat
        config={mortgageCaptureConfig}
        searchParams={new URLSearchParams()}
        chatMode="scripted"
        validators={mortgageValidators}
        messageResolvers={mortgageMessageResolvers}
      />,
    );
    await flushTypingDelay();
    const list = screen.getByRole("list", { name: "Progress" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(
      mortgageCaptureConfig.steps.length,
    );
  });
});
