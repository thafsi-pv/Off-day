import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import { Config } from '../types';

export const useConfig = () => {
  return useQuery<Config>({
    queryKey: ['config'],
    queryFn: api.getConfig,
  });
};

export const useUpdateConfigMutation = (options?: any) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (newConfig: Config) => api.updateConfig(newConfig),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['config'] });
            // FIX: Invalidate slots query as config changes can affect slot availability.
            queryClient.invalidateQueries({ queryKey: ['slots'] });
        },
        ...options
    });
};