import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it, describe, beforeEach } from "vitest";
import AdminApprovalQueuePage from "../AdminApprovalQueuePage";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

describe("AdminApprovalQueuePage", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it("renders the approval queue with items", async () => {
    render(<AdminApprovalQueuePage />, { wrapper });
    
    expect(screen.getByText(/Approval Queue/i)).toBeInTheDocument();

    expect(await screen.findByText("Buddy (Golden Retriever)", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText("Luna (Siamese Cat)", {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("filters overdue items when toggle is clicked", async () => {
    render(<AdminApprovalQueuePage />, { wrapper });

    expect(await screen.findByText("Luna (Siamese Cat)", {}, { timeout: 3000 })).toBeInTheDocument();

    const toggle = screen.getByText(/Show overdue only/i);
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.queryByText("Luna (Siamese Cat)")).not.toBeInTheDocument();
      expect(screen.getByText("Buddy (Golden Retriever)")).toBeInTheDocument();
      expect(screen.getAllByText(/SLA Breached/i).length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("stores the current page in the URL and restores it on refresh", async () => {
    window.history.replaceState({}, "", "/admin/approvals?page=2");
    render(<AdminApprovalQueuePage />, { wrapper });

    expect(await screen.findByText("Page 2", {}, { timeout: 3000 })).toBeInTheDocument();

    const nextButton = screen.getByRole("button", { name: /next/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(window.location.search).toContain("page=3");
    }, { timeout: 3000 });

    window.history.replaceState({}, "", "/admin/approvals?page=3");
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => {
      expect(screen.getByText("Page 3")).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
