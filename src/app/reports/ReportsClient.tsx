"use client";

import { BarChart, DonutChart } from "@tremor/react";
import { DollarSign, TrendingUp, CheckCircle2, Building2 } from "lucide-react";
import AppShell from "../../components/AppShell";

const STAGES = [
  "New Leads",
  "Contacted",
  "Property Tours",
  "Fav Offers",
  "Closed Deals",
];

export default function ReportsClient({
  userEmail,
  leads,
  listings,
  tasks,
}: {
  userEmail: string;
  leads: any[];
  listings: any[];
  tasks: any[];
}) {
  const totalPipelineValue = leads.reduce(
    (sum, l) => sum + Number(l.estimated_value || 0),
    0
  );

  const closedDeals = leads.filter((l) => l.status === "Closed Deals");
  const closedRevenue = closedDeals.reduce(
    (sum, l) => sum + Number(l.estimated_value || 0),
    0
  );

  const winRate =
    leads.length > 0 ? Math.round((closedDeals.length / leads.length) * 100) : 0;

  const completedTasks = tasks.filter((t) => t.status === "Completed").length;
  const taskCompletionRate =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const activeInventoryValue = listings
    .filter((item) => item.status !== "Sold")
    .reduce((sum, item) => sum + Number(item.price || 0), 0);

  // Chart 1: Pipeline Value by Stage
  const pipelineChartData = STAGES.map((stage) => {
    const stageLeads = leads.filter((l) => l.status === stage);
    return {
      stage,
      "Pipeline Value ($)": stageLeads.reduce(
        (sum, l) => sum + Number(l.estimated_value || 0),
        0
      ),
      "Lead Count": stageLeads.length,
    };
  });

  // Chart 2: Listings Breakdown by Status
  const listingStatusData = [
    {
      status: "For Sale",
      count: listings.filter((l) => l.status === "For Sale").length,
    },
    {
      status: "Under Contract",
      count: listings.filter((l) => l.status === "Under Contract").length,
    },
    {
      status: "Sold",
      count: listings.filter((l) => l.status === "Sold").length,
    },
  ];

  return (
    <AppShell userEmail={userEmail} searchPlaceholder="Executive reports...">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Executive Reports & Analytics</h1>
        <p className="text-sm text-gray-400">
          Live brokerage performance across pipeline deals, inventory, and team tasks
        </p>
      </div>

      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-[#24282B] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
            <span>Closed Revenue</span>
            <DollarSign size={16} className="text-green-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            ${closedRevenue.toLocaleString()}
          </div>
          <div className="text-xs text-green-400 mt-1">
            {closedDeals.length} closed deals
          </div>
        </div>

        <div className="bg-[#24282B] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
            <span>Total Pipeline Volume</span>
            <TrendingUp size={16} className="text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            ${totalPipelineValue.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {winRate}% close conversion rate
          </div>
        </div>

        <div className="bg-[#24282B] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
            <span>Active Listing Inventory</span>
            <Building2 size={16} className="text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            ${activeInventoryValue.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {listings.length} total properties tracked
          </div>
        </div>

        <div className="bg-[#24282B] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
            <span>Task Execution Rate</span>
            <CheckCircle2 size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {taskCompletionRate}%
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {completedTasks} of {tasks.length} tasks completed
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#24282B] border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-medium mb-1">Pipeline Value by Stage</h2>
          <p className="text-xs text-gray-400 mb-6">
            Estimated deal volume across each Kanban stage
          </p>
          <BarChart
            className="h-72"
            data={pipelineChartData}
            index="stage"
            categories={["Pipeline Value ($)"]}
            colors={["green"]}
            valueFormatter={(number) => `$${Intl.NumberFormat("us").format(number)}`}
            showGridLines={false}
          />
        </div>

        <div className="bg-[#24282B] border border-gray-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-medium mb-1">Listings Breakdown</h2>
            <p className="text-xs text-gray-400 mb-6">
              Distribution by current property status
            </p>
            <DonutChart
              className="h-56"
              data={listingStatusData}
              category="count"
              index="status"
              colors={["green", "yellow", "red"]}
            />
          </div>

          <div className="space-y-2 pt-4 border-t border-gray-800 text-xs">
            {listingStatusData.map((item) => (
              <div key={item.status} className="flex justify-between text-gray-300">
                <span>{item.status}</span>
                <span className="font-semibold">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}