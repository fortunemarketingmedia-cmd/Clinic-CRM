'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Trash2, UserPlus, XCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/services/api';
import type { User } from '@/types/auth';

type UserListItem = User & {
  createdAt: string;
};

const userSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
  role: z.enum(['ADMIN', 'RECEPTIONIST']),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

type UserFormValues = z.infer<typeof userSchema>;

export function UsersView() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => apiRequest<{ data: UserListItem[] }>('/users'),
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'RECEPTIONIST',
      status: 'ACTIVE',
    },
  });

  const createUser = useMutation({
    mutationFn: (values: UserFormValues) =>
      apiRequest<{ data: UserListItem }>('/users', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      apiRequest<{ data: UserListItem }>(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => apiRequest(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">Create receptionists and manage active CRM access.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card>
          <h2 className="text-base font-semibold">Create User</h2>
          <form className="mt-4 space-y-4" onSubmit={form.handleSubmit((values) => createUser.mutate(values))}>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Name</span>
              <Input {...form.register('name')} />
              {form.formState.errors.name ? (
                <span className="text-xs text-red-600">{form.formState.errors.name.message}</span>
              ) : null}
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Email</span>
              <Input {...form.register('email')} />
              {form.formState.errors.email ? (
                <span className="text-xs text-red-600">{form.formState.errors.email.message}</span>
              ) : null}
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Password</span>
              <Input type="password" {...form.register('password')} />
              {form.formState.errors.password ? (
                <span className="text-xs text-red-600">{form.formState.errors.password.message}</span>
              ) : null}
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Role</span>
                <Select {...form.register('role')}>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Status</span>
                <Select {...form.register('status')}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </label>
            </div>
            {createUser.error ? (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{createUser.error.message}</div>
            ) : null}
            <Button type="submit" disabled={createUser.isPending} className="w-full">
              <UserPlus className="size-4" />
              {createUser.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </form>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">Team Access</h2>
          <div className="mt-4 overflow-hidden rounded-md border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data?.data.map((user) => (
                  <tr key={user.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">{user.role === 'ADMIN' ? 'Admin' : 'Receptionist'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                        {user.status === 'ACTIVE' ? (
                          <CheckCircle2 className="size-3 text-primary" />
                        ) : (
                          <XCircle className="size-3 text-red-600" />
                        )}
                        {user.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={updateUser.isPending}
                        onClick={() =>
                          updateUser.mutate({
                            id: user.id,
                            status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                          })
                        }
                      >
                        {user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={deleteUser.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete ${user.name}?`)) {
                            deleteUser.mutate(user.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!usersQuery.isLoading && usersQuery.data?.data.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                      No users found.
                    </td>
                  </tr>
                ) : null}
                {usersQuery.isLoading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                      Loading users...
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}
