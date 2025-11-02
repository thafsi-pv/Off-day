
import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import * as api from '../services/api';
import { User } from '../types';

type LoginCredentials = {
  email: string;
  password: string;
};

type RegisterCredentials = {
    name: string;
    email: string;
    password: string;
}

type UseLoginMutationOptions = Omit<UseMutationOptions<User, any, LoginCredentials>, 'mutationFn'>;
type UseRegisterMutationOptions = Omit<UseMutationOptions<User, any, RegisterCredentials>, 'mutationFn'>;


export const useLoginMutation = (options?: UseLoginMutationOptions) => {
  return useMutation({
    mutationFn: (credentials: LoginCredentials) => api.login(credentials),
    ...options,
  });
};

export const useRegisterMutation = (options?: UseRegisterMutationOptions) => {
    return useMutation({
        mutationFn: (credentials: RegisterCredentials) => api.register(credentials),
        ...options
    });
};