"use client";

import { useState, useEffect } from "react";
import { SelectMenu } from "@/components/SelectMenu";
import { SkeletonDropdown } from "@/components/ui/Skeleton";

interface Sprint {
  id: string;
  name: string;
  status: string;
}

interface SprintSelectorProps {
  ticketId: string;
  currentSprintId: string | null | undefined;
  currentSprintName?: string;
  teamId: string;
  onSprintChange?: (sprintId: string | null) => void;
  className?: string;
  disabled?: boolean;
}

export function SprintSelector({
  ticketId,
  currentSprintId,
  currentSprintName: _currentSprintName,
  teamId,
  onSprintChange,
  className,
  disabled = false,
}: SprintSelectorProps) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!teamId) return;

    const fetchSprints = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/sprints?teamId=${teamId}`);
        if (response.ok) {
          const data = await response.json();
          const activeSprints = Array.isArray(data)
            ? data.filter((s: Sprint) => s.status !== "CLOSED")
            : [];
          setSprints(activeSprints);
        }
      } catch (err) {
        console.error("Failed to load sprints:", err);
        setSprints([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchSprints();
  }, [teamId]);

  const handleSprintChange = async (value: string) => {
    const sprintId = value === "__backlog__" ? null : value;

    setUpdating(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sprintId }),
      });

      if (!response.ok) {
        throw new Error("Failed to update sprint");
      }

      onSprintChange?.(sprintId);
    } catch (err) {
      console.error("Failed to update sprint:", err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className={className}>
      {loading ? (
        <SkeletonDropdown className="h-8 w-full" />
      ) : (
        <SelectMenu
          value={currentSprintId || "__backlog__"}
          onChange={handleSprintChange}
          disabled={disabled || updating}
          options={[
            { value: "__backlog__", label: "Backlog" },
            ...sprints.map((sprint) => ({
              value: sprint.id,
              label: `${sprint.name}`,
            })),
          ]}
          size="sm"
          placeholder={updating ? "Updating..." : "Select sprint"}
          triggerClassName="border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white text-xs"
        />
      )}
    </div>
  );
}
