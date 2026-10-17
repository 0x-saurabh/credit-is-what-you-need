import { ActivityTable } from "../activity-table";
import { PageHeader } from "../page-header";

export const metadata = { title: "Activity — Kredit" };

export default function Activity() {
  return (
    <>
      <PageHeader title="Activity" lede="Every credit that came in or went out of your account, newest first." />
      <div className="animate-rise">
        <ActivityTable />
      </div>
    </>
  );
}
