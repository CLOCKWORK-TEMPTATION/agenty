'use client';

import { useState, useCallback } from 'react';
import type { TeamDesign } from '@repo/types';

export interface TeamBuilderState {
  design: Partial<TeamDesign>;
  isDraft: boolean;
  isModified: boolean;
}

export function useTeamBuilder(initialDesign?: Partial<TeamDesign>) {
  const [state, setState] = useState<TeamBuilderState>({
    design: initialDesign || {},
    isDraft: true,
    isModified: false,
  });

  const updateDesign = useCallback(
    (updates: Partial<TeamDesign>) => {
      setState((prev) => ({
        ...prev,
        design: { ...prev.design, ...updates },
        isModified: true,
      }));
    },
    []
  );

  const addRole = useCallback(
    (role: TeamDesign['roles'][0]) => {
      setState((prev) => ({
        ...prev,
        design: {
          ...prev.design,
          roles: [...(prev.design.roles || []), role],
        },
        isModified: true,
      }));
    },
    []
  );

  const removeRole = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      design: {
        ...prev.design,
        roles: prev.design.roles?.filter((_: any, i: number) => i !== index) || [],
      },
      isModified: true,
    }));
  }, []);

  const updateRole = useCallback(
    (index: number, updates: Partial<TeamDesign['roles'][0]>) => {
      setState((prev) => ({
        ...prev,
        design: {
          ...prev.design,
          roles:
            prev.design.roles?.map((role: any, i: number) =>
              i === index ? { ...role, ...updates } : role
            ) || [],
        },
        isModified: true,
      }));
    },
    []
  );

  const reset = useCallback(() => {
    setState({
      design: initialDesign || {},
      isDraft: true,
      isModified: false,
    });
  }, [initialDesign]);

  const markAsApproved = useCallback(() => {
    setState((prev) => ({ ...prev, isDraft: false }));
  }, []);

  return {
    ...state,
    updateDesign,
    addRole,
    removeRole,
    updateRole,
    reset,
    markAsApproved,
  };
}
