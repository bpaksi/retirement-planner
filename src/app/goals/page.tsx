"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent } from "@/components/ui/Card";
import { Target } from "lucide-react";

export default function GoalsPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold">Goals</h1>
            <p className="text-muted-foreground mt-1">
              Track your retirement milestones and targets
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold mb-2">Coming Soon</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Retirement countdown, net worth milestones, and savings targets
                  will be available in the next phase.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
