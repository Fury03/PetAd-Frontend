import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useApprovalDetail } from "./useApprovalDetail";
import { adoptionService } from "../../../api/adoptionService";
import type { AdminApprovalQueueItem } from "../../../types/adoption";

vi.mock("../../../api/adoptionService", () => ({
  adoptionService: {
    getApprovalById: vi.fn(),
  },
}));

describe("useApprovalDetail", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const mockApprovalItem: AdminApprovalQueueItem = {
    id: "approval-123",
    shelter: "Happy Paws Shelter",
    pet: "Buddy (Golden Retriever)",
    adopter: "John Doe",
    submitted: "2026-04-23T00:00:00Z",
    shelterApproved: true,
    daysWaiting: 2,
    isOverdue: false,
  };

  it("fetches approval detail by id", async () => {
    vi.mocked(adoptionService.getApprovalById).mockResolvedValue(
      mockApprovalItem
    );

    const { result } = renderHook(() => useApprovalDetail({ id: "approval-123" }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adoptionService.getApprovalById).toHaveBeenCalledWith("approval-123");
    expect(result.current.data).toEqual(mockApprovalItem);
  });

  it("does not fetch when id is empty", () => {
    const { result } = renderHook(() => useApprovalDetail({ id: "" }), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(adoptionService.getApprovalById).not.toHaveBeenCalled();
  });

  it("uses initialData from list cache when available - avoiding loading flash", async () => {
    // Seed the list cache first (simulating user viewing the list)
    queryClient.setQueryData(
      ["adminApprovals", "", [], false],
      {
        pages: [
          {
            items: [mockApprovalItem],
            nextCursor: undefined,
          },
        ],
        pageParams: [undefined],
      }
    );

    // Mock the API to return the same data (but we should never call it initially)
    vi.mocked(adoptionService.getApprovalById).mockResolvedValue(
      mockApprovalItem
    );

    const { result } = renderHook(
      () => useApprovalDetail({ id: "approval-123" }),
      { wrapper }
    );

    // ✅ KEY ACCEPTANCE CRITERIA: Data should be available immediately (no loading state)
    expect(result.current.data).toEqual(mockApprovalItem);
    expect(result.current.isLoading).toBe(false);
    // Note: isFetching may be true as React Query does a background refetch to validate the data
    // This is expected behavior - the user sees the data immediately, but it gets revalidated

    // The query should still run in the background to refresh data
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adoptionService.getApprovalById).toHaveBeenCalledWith("approval-123");
  });

  it("finds item in multiple pages of infinite query cache", async () => {
    // Seed cache with multiple pages
    queryClient.setQueryData(
      ["adminApprovals", "happy-paws", ["PENDING"], false],
      {
        pages: [
          {
            items: [
              {
                id: "approval-001",
                shelter: "Happy Paws",
                pet: "Max",
                adopter: "Alice",
                submitted: "2026-04-20T00:00:00Z",
                shelterApproved: false,
                daysWaiting: 5,
                isOverdue: true,
              },
            ],
            nextCursor: "page2",
          },
          {
            items: [mockApprovalItem], // Our target is in page 2
            nextCursor: undefined,
          },
        ],
        pageParams: [undefined, "page2"],
      }
    );

    vi.mocked(adoptionService.getApprovalById).mockResolvedValue(
      mockApprovalItem
    );

    const { result } = renderHook(
      () => useApprovalDetail({ id: "approval-123" }),
      { wrapper }
    );

    // Should find the item in the second page
    expect(result.current.data).toEqual(mockApprovalItem);
    expect(result.current.isLoading).toBe(false);
  });

  it("finds item across different filter combinations", async () => {
    // Seed a different filter combination cache
    queryClient.setQueryData(
      ["adminApprovals", "rescue-league", ["SHELTER_APPROVED"], true],
      {
        pages: [
          {
            items: [mockApprovalItem],
            nextCursor: undefined,
          },
        ],
        pageParams: [undefined],
      }
    );

    vi.mocked(adoptionService.getApprovalById).mockResolvedValue(
      mockApprovalItem
    );

    const { result } = renderHook(
      () => useApprovalDetail({ id: "approval-123" }),
      { wrapper }
    );

    // Should find the item regardless of filter combination
    expect(result.current.data).toEqual(mockApprovalItem);
    expect(result.current.isLoading).toBe(false);
  });

  it("fetches from API when item not in cache", async () => {
    // Cache has different items
    queryClient.setQueryData(
      ["adminApprovals", "", [], false],
      {
        pages: [
          {
            items: [
              {
                id: "different-id",
                shelter: "Other Shelter",
                pet: "Luna",
                adopter: "Jane",
                submitted: "2026-04-22T00:00:00Z",
                shelterApproved: false,
                daysWaiting: 3,
                isOverdue: false,
              },
            ],
            nextCursor: undefined,
          },
        ],
        pageParams: [undefined],
      }
    );

    vi.mocked(adoptionService.getApprovalById).mockResolvedValue(
      mockApprovalItem
    );

    const { result } = renderHook(
      () => useApprovalDetail({ id: "approval-123" }),
      { wrapper }
    );

    // Should show loading state since item not in cache
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockApprovalItem);
    expect(adoptionService.getApprovalById).toHaveBeenCalledWith("approval-123");
  });

  it("handles empty cache gracefully", async () => {
    vi.mocked(adoptionService.getApprovalById).mockResolvedValue(
      mockApprovalItem
    );

    const { result } = renderHook(
      () => useApprovalDetail({ id: "approval-123" }),
      { wrapper }
    );

    // Should show loading state
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockApprovalItem);
  });
});
