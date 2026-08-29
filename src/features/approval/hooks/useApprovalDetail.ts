import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adoptionService } from "../../../api/adoptionService";
import type { AdminApprovalQueueItem } from "../../../types/adoption";

interface UseApprovalDetailOptions {
  id: string;
}

/**
 * Hook to fetch approval detail by ID with cache optimization.
 * 
 * Automatically seeds initialData from any matching list cache entry to avoid
 * showing a loading spinner when the user opens a detail view for an item
 * they've already seen in the list.
 * 
 * @example
 * ```tsx
 * import { useApprovalDetail } from '@/features/approval';
 * 
 * function ApprovalDetailModal({ approvalId }: { approvalId: string }) {
 *   const { data, isLoading, isError } = useApprovalDetail({ id: approvalId });
 * 
 *   if (isLoading) return <Spinner />;
 *   if (isError) return <ErrorMessage />;
 *   
 *   return (
 *     <div>
 *       <h2>{data.pet}</h2>
 *       <p>Adopter: {data.adopter}</p>
 *       <p>Shelter: {data.shelter}</p>
 *     </div>
 *   );
 * }
 * ```
 * 
 * **Cache Optimization:**
 * When a user opens a detail modal for an approval they've already seen in the
 * admin approval queue list, this hook will instantly show the cached data from
 * the list query (avoiding a loading spinner), while still fetching fresh data
 * in the background to ensure accuracy.
 */
export function useApprovalDetail({ id }: UseApprovalDetailOptions) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["approvals", id],
    queryFn: () => adoptionService.getApprovalById(id),
    enabled: !!id,
    initialData: () => {
      // Search through all list query caches to find matching approval
      const queries = queryClient.getQueriesData<{
        pages: Array<{ items: AdminApprovalQueueItem[]; nextCursor?: string }>;
        pageParams: unknown[];
      }>({
        queryKey: ["adminApprovals"],
        predicate: (query) => {
          // Only check queries that have data and start with ["adminApprovals"]
          return (
            query.queryKey[0] === "adminApprovals" &&
            query.state.data !== undefined
          );
        },
      });

      // Search through all pages in all matching queries
      for (const [, data] of queries) {
        if (!data?.pages) continue;

        for (const page of data.pages) {
          const found = page.items?.find((item) => item.id === id);
          if (found) {
            return found;
          }
        }
      }

      return undefined;
    },
  });
}
