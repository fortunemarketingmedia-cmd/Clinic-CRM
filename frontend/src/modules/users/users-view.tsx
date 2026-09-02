'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, ShieldCheck, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/services/api';
import type { User } from '@/types/auth';

type UserListItem = User & {
  createdAt: string;
};

export function UsersView() {
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => apiRequest<{ data: UserListItem[] }>('/users'),
  });

  return (
    <section className="space-y-5">
      <Card className="border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><KeyRound className="size-5" /></div><div><h2 className="font-semibold">Licensed access</h2><p className="mt-1 text-sm text-muted-foreground">User IDs, passwords and role licences are provisioned by the system administrator.</p></div></div>
      </Card>
      <Card>
          <div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">Team & access</h2><p className="mt-1 text-sm text-muted-foreground">Read-only view of licensed accounts and their assigned roles.</p></div><ShieldCheck className="size-5 text-primary" /></div>
          <div className="mt-4 overflow-hidden rounded-md border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Provisioning</th>
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
                    <td className="px-4 py-3 text-muted-foreground">Licence managed</td>
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
                  Array.from({ length: 6 }, (_, row) => <tr key={row} className="border-t border-border">{Array.from({ length: 5 }, (_, column) => <td key={column} className="px-4 py-4"><Skeleton className={column === 0 ? 'h-5 w-32' : 'h-4 w-24'} /></td>)}</tr>)
                ) : null}
              </tbody>
            </table>
          </div>
      </Card>
    </section>
  );
}
