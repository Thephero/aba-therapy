'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, CheckCircle2, XCircle, Info } from 'lucide-react';
import { useParentStudent } from '@/contexts/ParentStudentContext';

export default function ParentBillingPage() {
  const { student } = useParentStudent();

  const { data: billing } = useQuery({
    queryKey: ['parent-billing'],
    queryFn: async () => {
      const { data } = await api.get('/attendance/billing-summary');
      return data;
    },
  });

  const mine = (billing?.billing || []).filter(
    (b: any) => !student || b.studentId === student.id
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sessions & Payments</h1>
        <p className="mt-1 text-sm text-gray-500">
          A simple running record of sessions attended. Your center invoices you based on these.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-gray-400" />
            Session balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mine.length === 0 ? (
            <div className="py-8 text-center">
              <Wallet className="h-8 w-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No billing data yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {mine.map((b: any) => (
                <div key={b.studentId} className="rounded-lg border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-900">{b.studentName}</h3>
                  <div className="mt-3 grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <div>
                        <p className="text-lg font-bold text-gray-900">{b.attendedSessions}</p>
                        <p className="text-xs text-gray-500">Attended</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-400" />
                      <div>
                        <p className="text-lg font-bold text-gray-900">{b.missedSessions}</p>
                        <p className="text-xs text-gray-500">Missed</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">
                        {b.currency} {b.amountOwed.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">Estimated owe</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!billing?.sessionRate && mine.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Session counts are live. Your center will confirm exact amounts — ask them anytime via
                Messages.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
